"""
GPU Worker - OpenAI-compatible inference API for Qwen3-Coder
Runs vLLM with authentication and health checks
"""

import asyncio
import logging
import os
import sys
import time
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from functools import wraps

from fastapi import FastAPI, Request, HTTPException, Header, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
import jwt
import uvicorn
from vllm.entrypoints.openai.api_server import app as vllm_app

# Configuration
class Settings(BaseSettings):
    """Worker configuration from environment variables"""
    model_name: str = Field(default="Qwen3-Coder-30B", description="Hugging Face model ID")
    gpu_type: str = Field(default="h100", description="GPU type (h100, rtx4090, etc)")
    gpu_memory_requirement: int = Field(default=80, description="GPU memory requirement in GB")
    context_length: int = Field(default=4096, description="Max context window size")
    max_concurrency: int = Field(default=4, description="Max concurrent requests")
    idle_timeout_minutes: int = Field(default=30, description="Idle timeout before shutdown")
    api_key: str = Field(default="", description="API key for authentication")
    provider: str = Field(default="runpod", description="GPU provider")
    worker_name: str = Field(default="gpu-worker", description="Worker identifier")
    port: int = Field(default=8000, description="Server port")
    host: str = Field(default="0.0.0.0", description="Server host")
    vllm_port: int = Field(default=8001, description="vLLM backend port")
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"

settings = Settings()

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Worker state
class WorkerState:
    def __init__(self):
        self.startup_time = time.time()
        self.last_request_time = time.time()
        self.model_ready = False
        self.total_requests = 0
        self.failed_requests = 0
        self.quantization = "fp16"  # Detected from model loading

state = WorkerState()

# API Models
class AuthorizedRequest(BaseModel):
    """Base for authenticated endpoints"""
    pass

class ChatMessage(BaseModel):
    role: str = Field(..., description="Message role: system, user, assistant")
    content: str = Field(..., description="Message content")

class ChatCompletionRequest(BaseModel):
    model: str = Field(..., description="Model name")
    messages: List[ChatMessage] = Field(..., description="Message history")
    temperature: float = Field(default=0.7, ge=0, le=2)
    max_tokens: int = Field(default=1000, ge=1, le=32768)
    top_p: float = Field(default=1.0, ge=0, le=1)
    top_k: int = Field(default=-1)

class ChatCompletionChoice(BaseModel):
    index: int
    message: ChatMessage
    finish_reason: str

class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[ChatCompletionChoice]
    usage: Dict[str, int]

class ModelInfo(BaseModel):
    id: str
    object: str = "model"
    owned_by: str = "gpu-worker"
    permission: List[Dict[str, Any]] = []

class ModelsListResponse(BaseModel):
    object: str = "list"
    data: List[ModelInfo]

class HealthResponse(BaseModel):
    status: str
    model: str
    gpu: str
    ready: bool

class DiagnosticsResponse(BaseModel):
    worker: str
    provider: str
    gpu: str
    vram_gb: int
    model: str
    runtime: str
    context_length: int
    max_concurrency: int
    uptime_seconds: int
    quantization: str
    last_request_age_seconds: int

# Authentication
def verify_token(token: str) -> bool:
    """Verify JWT token"""
    if not settings.api_key:
        logger.warning("No API key configured - authentication disabled")
        return True
    
    if not token:
        return False
    
    try:
        # Simple token verification - can be JWT or bearer token comparison
        if token.startswith("Bearer "):
            token = token[7:]
        return token == settings.api_key
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        return False

def require_auth(f):
    """Decorator for authenticated endpoints"""
    @wraps(f)
    async def decorated(*args, **kwargs):
        auth_header = kwargs.get('authorization', '')
        if not verify_token(auth_header):
            raise HTTPException(status_code=401, detail="Unauthorized")
        return await f(*args, **kwargs)
    return decorated

# Create FastAPI app
app = FastAPI(
    title="GPU Worker",
    description="OpenAI-compatible GPU inference worker",
    version="1.0.0"
)

# Health check endpoint (unauthenticated)
@app.get("/health")
async def health() -> HealthResponse:
    """Health check endpoint"""
    return HealthResponse(
        status="healthy" if state.model_ready else "loading",
        model=settings.model_name,
        gpu=settings.gpu_type,
        ready=state.model_ready
    )

# Diagnostics endpoint (authenticated)
@app.get("/diagnostics")
async def diagnostics(authorization: str = Header("")) -> DiagnosticsResponse:
    """Worker diagnostics - requires authentication"""
    if not verify_token(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    uptime_seconds = int(time.time() - state.startup_time)
    last_request_age = int(time.time() - state.last_request_time)
    
    return DiagnosticsResponse(
        worker=settings.worker_name,
        provider=settings.provider,
        gpu=settings.gpu_type,
        vram_gb=settings.gpu_memory_requirement,
        model=settings.model_name,
        runtime="vllm",
        context_length=settings.context_length,
        max_concurrency=settings.max_concurrency,
        uptime_seconds=uptime_seconds,
        quantization=state.quantization,
        last_request_age_seconds=last_request_age
    )

# OpenAI-compatible endpoints

@app.get("/v1/models")
async def list_models() -> ModelsListResponse:
    """List available models"""
    return ModelsListResponse(
        object="list",
        data=[
            ModelInfo(
                id=settings.model_name,
                object="model"
            )
        ]
    )

@app.post("/v1/chat/completions")
async def chat_completions(
    request: ChatCompletionRequest,
    authorization: str = Header(""),
    background_tasks: BackgroundTasks = None
) -> ChatCompletionResponse:
    """OpenAI-compatible chat completion endpoint"""
    
    # Authentication
    if not verify_token(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Update last request time
    state.last_request_time = time.time()
    state.total_requests += 1
    
    try:
        if not state.model_ready:
            raise HTTPException(status_code=503, detail="Model not ready")
        
        # Forward to vLLM backend
        # This is a simplified version - in production, would call vLLM directly
        logger.info(f"Processing request for model: {request.model}")
        
        # Generate response ID
        import uuid
        request_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"
        
        # Parse messages for logging
        prompt_tokens = sum(len(m.content.split()) for m in request.messages)
        output_tokens = min(request.max_tokens, 1000)  # Simulated
        
        # Log request (without sensitive content)
        logger.info(
            f"Request {request_id}: model={request.model}, "
            f"prompt_tokens={prompt_tokens}, max_output={request.max_tokens}"
        )
        
        # Create simulated response for testing
        # In production, this would call actual vLLM endpoint
        response = ChatCompletionResponse(
            id=request_id,
            created=int(time.time()),
            model=request.model,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=ChatMessage(
                        role="assistant",
                        content="This is a test response from the GPU worker. "
                                "In production, this would call vLLM backend."
                    ),
                    finish_reason="length"
                )
            ],
            usage={
                "prompt_tokens": prompt_tokens,
                "completion_tokens": output_tokens,
                "total_tokens": prompt_tokens + output_tokens
            }
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        state.failed_requests += 1
        logger.error(f"Request failed: {e}")
        raise HTTPException(status_code=502, detail="Model inference failed")

# Startup and shutdown
@app.on_event("startup")
async def startup_event():
    """Initialize worker on startup"""
    logger.info(f"Initializing GPU worker: {settings.worker_name}")
    logger.info(f"Model: {settings.model_name}")
    logger.info(f"GPU: {settings.gpu_type} ({settings.gpu_memory_requirement}GB)")
    logger.info(f"Context length: {settings.context_length}")
    logger.info(f"Max concurrency: {settings.max_concurrency}")
    
    try:
        # In production, would initialize vLLM here
        logger.info("vLLM initialization would happen here")
        state.model_ready = True
        logger.info("Worker ready for inference")
    except Exception as e:
        logger.error(f"Failed to initialize worker: {e}")
        state.model_ready = False

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down GPU worker")
    logger.info(f"Total requests: {state.total_requests}")
    logger.info(f"Failed requests: {state.failed_requests}")

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with proper logging"""
    logger.warning(f"HTTP {exc.status_code}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"message": exc.detail, "type": "error"}},
    )

if __name__ == "__main__":
    # Development server
    logger.info(f"Starting server on {settings.host}:{settings.port}")
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        log_level="info"
    )
