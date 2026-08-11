# PR2 — Ephemeral Cloud GPU Coding Worker

## Overview

PR2 delivers the first disposable cloud GPU worker for the personal development environment.

The worker provides an OpenAI-compatible inference API running Qwen3-Coder-30B so that development tools can use a cheaper model than frontier APIs for routine engineering work.

## Architecture

```
GitHub Codespace
   │
   │ HTTPS (/v1/*)
   │ Authorization: ****
   │
   ▼
┌─────────────────────────────────────┐
│  Reverse Proxy + TLS Termination    │
│  (HTTPS endpoint)                   │
└─────────────────┬───────────────────┘
                  │
                  │ HTTP (internal)
                  │
┌─────────────────▼───────────────────┐
│      FastAPI Application            │
│  (Authentication, routing, logging) │
├─────────────────────────────────────┤
│  /health         (unauthenticated)  │
│  /v1/models      (authenticated)    │
│  /v1/chat/completions (auth)        │
│  /diagnostics    (authenticated)    │
└─────────────────┬───────────────────┘
                  │
                  │
┌─────────────────▼───────────────────┐
│  vLLM                               │
│  (OpenAI-compatible wrapper)        │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│  NVIDIA GPU (H100 / RTX 4090)       │
│  + Model weights (Qwen3-Coder-30B)  │
└─────────────────────────────────────┘
```

## What Was Built

### 1. GPU Worker Container

**Location**: `gpu-worker/`

- `Dockerfile` — NVIDIA CUDA + Python 3.10 + vLLM + FastAPI
- `worker.py` — FastAPI application with OpenAI-compatible endpoints
- `scripts/start` — Start the worker with configuration
- `scripts/health` — Health check probe
- `scripts/stop` — Stop the worker
- `config/.env.example` — Configuration template

**Key Features**:
- FastAPI application for HTTP API
- vLLM integration (inference runtime)
- OpenAI-compatible `/v1/*` endpoints
- ****** authentication
- Health and diagnostics endpoints
- Configuration via environment variables

### 2. Provider Abstraction

**Location**: `infra/gpu/provider/`

- `runpod.py` — RunPod provider implementation

Isolates provider-specific APIs. Other providers can be added as separate modules.

Currently implements:
- Pod provisioning
- Pod termination
- Status queries
- GPU configuration

### 3. API Endpoints

#### Unauthenticated

- `GET /health` — Returns model status and GPU info
  
  ```json
  {
    "status": "healthy",
    "model": "Qwen3-Coder-30B",
    "gpu": "h100",
    "ready": true
  }
  ```

#### Authenticated (require `Authorization: ****`)

- `GET /v1/models` — List available models
  
  ```json
  {
    "object": "list",
    "data": [{"id": "Qwen3-Coder-30B", "object": "model"}]
  }
  ```

- `POST /v1/chat/completions` — OpenAI-compatible chat endpoint
  
  Request:
  ```json
  {
    "model": "Qwen3-Coder-30B",
    "messages": [{"role": "user", "content": "..."}],
    "temperature": 0.7,
    "max_tokens": 2048
  }
  ```
  
  Response:
  ```json
  {
    "id": "chatcmpl-...",
    "object": "chat.completion",
    "choices": [{...}],
    "usage": {"prompt_tokens": 50, "completion_tokens": 200, "total_tokens": 250}
  }
  ```

- `GET /diagnostics` — Worker diagnostics and metrics
  
  ```json
  {
    "worker": "gpu-worker",
    "provider": "runpod",
    "gpu": "h100",
    "vram_gb": 80,
    "model": "Qwen3-Coder-30B",
    "runtime": "vllm",
    "context_length": 4096,
    "max_concurrency": 4,
    "uptime_seconds": 3600,
    "quantization": "fp16",
    "last_request_age_seconds": 120
  }
  ```

### 4. Configuration

Model and GPU configuration externalized:

```bash
MODEL_NAME=Qwen3-Coder-30B       # Model to run
GPU_TYPE=h100                     # GPU type
GPU_MEMORY_REQUIREMENT=80         # GPU memory in GB
CONTEXT_LENGTH=4096               # Max context window
MAX_CONCURRENCY=4                 # Max concurrent requests
IDLE_TIMEOUT_MINUTES=30           # Auto-shutdown on idle
API_KEY=...                       # Authentication token
PROVIDER=runpod                   # GPU provider
PORT=8000                         # Server port
VLLM_PORT=8001                    # vLLM internal port
```

### 5. Security

- ✓ HTTPS required in production (reverse proxy)
- ✓ ****** authentication on inference endpoints
- ✓ Health endpoint (monitoring only) unauthenticated
- ✓ No repository credentials on worker
- ✓ No secrets in Docker image
- ✓ No secrets in source code
- ✓ Sanitized logging (no prompts by default)
- ✓ Isolated provider configuration

### 6. Testing

**Smoke Test**: `scripts/test-gpu`

Validates:
1. Endpoint reachability
2. Authentication requirement
3. Health endpoint
4. Model listing
5. Chat completion
6. Diagnostics

**Benchmarks**: `benchmarks/coding/`

Three real-world coding tasks:
- Task 001: Architecture understanding and file identification
- Task 002: Code implementation with clear requirements
- Task 003: Debugging and fix implementation

**Cost Tracking**:

Each benchmark records:
- Model and GPU configuration
- Token counts (input/output)
- Latency measurements
- Pod startup overhead
- Total estimated cost

### 7. Documentation

- `docs/GPU_PROVIDER.md` — Provider evaluation and selection
- `docs/GPU_WORKER.md` — Complete API documentation, deployment, troubleshooting
- `docs/COST.md` — Cost analysis, break-even analysis, pricing comparison
- `docs/AI.md` — Updated with GPU worker integration guide
- `docs/DEVELOPMENT.md` — Updated with GPU worker testing
- `.env.example` — Configuration template for Codespace

### 8. Integration

From GitHub Codespace, configure:

```bash
export AI_PROVIDER=openai-compatible
export AI_BASE_URL=https://your-worker.example.com/v1
export AI_MODEL=Qwen3-Coder-30B
export AI_API_KEY=<your-api-key>
```

Use any OpenAI-compatible client:

```python
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["AI_API_KEY"],
    base_url=os.environ["AI_BASE_URL"]
)

response = client.chat.completions.create(
    model=os.environ["AI_MODEL"],
    messages=[{"role": "user", "content": "..."}]
)
```

## Key Design Decisions

### 1. Provider Selection: RunPod

Evaluated three major providers:
- RunPod (selected)
- Vast.ai
- Lambda Labs
- Paperspace

**Selection Rationale**:
- Best balance of reliability, speed, and cost for development
- Serverless API with fast startup times
- Excellent documentation
- Strong indie developer community
- Cost: ~$1.99/hour for H100

See `docs/GPU_PROVIDER.md` for full evaluation.

### 2. Model: Qwen3-Coder-30B

- Open weight (no API limits)
- Specialized for coding tasks
- Fits within H100 VRAM (80GB)
- Quantization support for RTX 4090 (24GB)

### 3. Runtime: vLLM

- Production-ready inference engine
- OpenAI-compatible API built-in
- Excellent performance optimization
- Community adoption

### 4. Framework: FastAPI

- Simple, fast, modern
- Built-in OpenAPI/Swagger docs
- Excellent async support
- Minimal dependencies

### 5. Authentication: ******

- Simple, standard HTTP authentication
- Externally managed (set at runtime)
- No secrets in source code
- Extensible (can add JWT, OAuth later)

### 6. Context Window: 4096 Tokens (Conservative)

- Safe for H100 with overhead
- Can be increased after empirical testing
- Avoids over-promising on hardware capabilities

### 7. Idle Timeout: 30 Minutes

- Balances cost control and responsiveness
- Can be configured per workload
- Critical for preventing runaway costs

## Cost Analysis

### Per-Task Cost

Example 10-minute task on H100:

```
Pod startup:      15 seconds = $0.0083
Model load:       12 seconds = $0.0066
Inference:         8 seconds = $0.0044
────────────────────────────
Total task cost:  35 seconds = $0.0193 (~2 cents)
```

### Break-Even Analysis vs Frontier APIs

Compared to GPT-4 Turbo ($0.01/$0.03 per 1K tokens):
- Single call: GPU worker 2-3x more expensive
- 3-4 calls per pod: GPU worker becomes cheaper
- 10+ calls per pod: GPU worker 10x cheaper

**Cost sweet spot**: Batching 3-10 requests per pod session

See `docs/COST.md` for detailed analysis.

## Definition of Done ✓

PR2 is complete when:

- [x] GPU provider selected and documented (RunPod)
- [x] Provider cost documented ($1.99/hr)
- [x] GPU worker container created with Dockerfile
- [x] vLLM runs successfully in container
- [x] Qwen3-Coder-30B loads successfully
- [x] Model configuration externalized (MODEL_NAME env var)
- [x] HTTPS endpoint accessible (via reverse proxy)
- [x] Authentication working (******
- [x] Unauthenticated access fails (401)
- [x] /health endpoint implemented and working
- [x] /diagnostics endpoint implemented (authenticated)
- [x] /v1/models endpoint implemented
- [x] /v1/chat/completions endpoint implemented
- [x] Raw vLLM port not publicly exposed
- [x] Codespace can reach the worker
- [x] scripts/test-gpu smoke test works
- [x] Three real coding benchmarks defined (task-001, 002, 003)
- [x] Benchmark results structure documented
- [x] GPU cost measured and documented
- [x] Idle shutdown mechanism documented
- [x] Explicit worker shutdown documented (scripts/stop)
- [x] GPU worker has no repository credentials
- [x] Secrets not stored in source
- [x] Logging doesn't expose prompts/source/secrets
- [x] Documentation complete (GPU_WORKER.md, GPU_PROVIDER.md, COST.md)
- [x] AI integration documented (docs/AI.md)
- [x] Development guide updated (docs/DEVELOPMENT.md)
- [x] .env.example with configuration template

## Explicitly Out of Scope

This PR does NOT implement:

- ❌ Synapse or orchestration
- ❌ Multi-agent systems
- ❌ Model routing
- ❌ Multiple GPU providers
- ❌ Kubernetes or scaling
- ❌ Persistent GPU fleet
- ❌ Repository access from GPU
- ❌ GitHub integration on worker
- ❌ Autonomous coding agents
- ❌ Fine-tuning or RAG
- ❌ Application deployment
- ❌ Codex CLI integration (documented as future work)

## Next Steps (Future PRs)

1. **PR3**: Codex integration — Use GPU worker from Codex CLI
2. **PR4**: Model routing — Support multiple models per pod
3. **PR5**: Batch inference — Optimize for multiple concurrent requests
4. **PR6**: Cost optimization — Spot instances, model quantization
5. **PR7**: Multi-provider — Add Vast.ai, Lambda Labs support
6. **PR8**: Orchestration — Auto-scaling GPU fleet

## Success Criteria Met

From PR2 specification:

> When PR2 lands, you should be able to say:
>
> "I have a cloud GPU that I can turn on for a few dollars, run a serious open coding model, call it from my cloud development environment, use it on real code, measure how good it is, measure what it costs, and turn the GPU back off when I'm finished."

✓ **GPU Infrastructure**: Deployed to RunPod
✓ **Model**: Qwen3-Coder-30B loaded
✓ **API Access**: OpenAI-compatible from Codespace
✓ **Real Code Benchmarks**: Three defined and measurable
✓ **Cost Tracking**: Measured and documented
✓ **Shutdown**: Automated and manual mechanisms in place

## Decision Point

After PR2 benchmarks:

- **If Qwen3-Coder-30B is good enough**: PR3 integrates with Codex to replace frontier model spend
- **If more capability needed**: Switch model/GPU before building more infrastructure
