# GPU Worker

Ephemeral cloud GPU worker providing OpenAI-compatible inference API for Qwen3-Coder-30B.

## Overview

The GPU worker is a disposable container that:

- Runs on a cloud GPU provider (RunPod)
- Loads Qwen3-Coder-30B using vLLM
- Exposes OpenAI-compatible `/v1/*` API endpoints
- Requires authentication for all inference endpoints
- Provides health and diagnostic endpoints
- Auto-shutdown on idle timeout

The worker is **independent** of the development environment and **independent** of application deployments. It exists purely for inference.

## Architecture

```
Internet (GitHub Codespace)
    ↓ HTTPS
    ↓ ******
    ↓
Reverse Proxy (TLS termination)
    ↓
Authentication Layer
    ↓
FastAPI Application
    ├── /health (unauthenticated)
    ├── /v1/models
    ├── /v1/chat/completions
    └── /diagnostics (authenticated)
    ↓
vLLM
    ↓
GPU (NVIDIA H100 or RTX 4090)
```

## Deployment

### Prerequisites

- RunPod account with API key
- NVIDIA GPU (H100 or RTX 4090)
- Docker
- Python 3.10+

### Environment Configuration

Create `.env` file based on `gpu-worker/config/.env.example`:

```bash
MODEL_NAME=Qwen3-Coder-30B
GPU_TYPE=h100
GPU_MEMORY_REQUIREMENT=80
CONTEXT_LENGTH=4096
MAX_CONCURRENCY=4
IDLE_TIMEOUT_MINUTES=30
PROVIDER=runpod
PORT=8000
VLLM_PORT=8001
API_KEY=<runtime-secret-not-committed>
```

**Never commit API keys** to the repository.

### Building the Container

```bash
cd gpu-worker
docker build -t station-gpu-worker:latest .
```

### Running Locally (without GPU)

For testing, run with CPU:

```bash
docker run -e MODEL_NAME=Qwen3-Coder-30B \
           -e API_KEY=test-key-12345 \
           -p 8000:8000 \
           station-gpu-worker:latest
```

### Deploying to RunPod

1. Push image to container registry
2. Use RunPod API or CLI to provision pod
3. Mount persistent storage for model cache
4. Expose HTTPS endpoint through reverse proxy
5. Configure idle timeout

## Health Monitoring

### Health Endpoint

```bash
curl http://localhost:8000/health
```

Response when ready:

```json
{
  "status": "healthy",
  "model": "Qwen3-Coder-30B",
  "gpu": "h100",
  "ready": true
}
```

Response during model loading:

```json
{
  "status": "loading",
  "model": "Qwen3-Coder-30B",
  "gpu": "h100",
  "ready": false
}
```

**Never consider** the container started to mean the model is ready. Wait for `"ready": true`.

### Diagnostics Endpoint

Requires authentication:

```bash
curl -H "Authorization: ******" \
     http://localhost:8000/diagnostics
```

Response:

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

## API Endpoints

### List Models

```bash
GET /v1/models

curl http://localhost:8000/v1/models
```

Response:

```json
{
  "object": "list",
  "data": [
    {
      "id": "Qwen3-Coder-30B",
      "object": "model"
    }
  ]
}
```

### Chat Completions

```bash
POST /v1/chat/completions
Authorization: ******
Content-Type: application/json

{
  "model": "Qwen3-Coder-30B",
  "messages": [
    {"role": "user", "content": "Explain this code..."}
  ],
  "temperature": 0.7,
  "max_tokens": 2048
}
```

Response:

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "Qwen3-Coder-30B",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "This code..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 200,
    "total_tokens": 250
  }
}
```

## Authentication

All inference endpoints require authentication:

```bash
curl -H "Authorization: ******" \
     -X POST http://localhost:8000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{"model":"...","messages":[...]}'
```

### Without Authentication

```bash
curl http://localhost:8000/v1/chat/completions
# Returns 401 Unauthorized
```

### Health Check (Unauthenticated)

```bash
curl http://localhost:8000/health
# No authentication required
```

## Configuration

### Model

Change model by setting `MODEL_NAME`:

```bash
MODEL_NAME=Mistral-7B-Instruct
```

Supported models:
- `Qwen3-Coder-30B` (default)
- `Mistral-7B-Instruct` (requires quantization)
- Others via Hugging Face model IDs

### GPU Memory

Set target GPU memory:

```bash
GPU_MEMORY_REQUIREMENT=80  # H100
GPU_MEMORY_REQUIREMENT=24  # RTX 4090 (requires quantization)
```

### Context Length

Conservative defaults:

```bash
CONTEXT_LENGTH=4096  # Safe default
# Increase only after testing with actual workload
# Theoretical model max: 128,000 tokens
```

### Idle Timeout

Auto-shutdown after idle period:

```bash
IDLE_TIMEOUT_MINUTES=30  # Default
IDLE_TIMEOUT_MINUTES=5   # Aggressive cost control
```

The worker will terminate itself if no requests received for this period.

## Testing

### Smoke Test

```bash
# From Codespace
export AI_BASE_URL=https://your-worker.example.com
export AI_API_KEY=<your-api-key>
export AI_MODEL=Qwen3-Coder-30B

./scripts/test-gpu
```

Expected output:

```
GPU Worker Smoke Test
✓ Endpoint reachable
✓ Authentication accepted
✓ Worker healthy
✓ Model available
✓ Completion successful
Model: Qwen3-Coder-30B
Latency: 245ms
```

### Manual Testing

```bash
# Check health
curl http://localhost:8000/health

# List models (no auth for list)
curl http://localhost:8000/v1/models

# Test completion (with auth)
curl -H "Authorization: ******" \
     -X POST http://localhost:8000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "Qwen3-Coder-30B",
       "messages": [{"role": "user", "content": "Say hello"}]
     }'
```

## Troubleshooting

### Model Not Ready

**Issue**: Health endpoint returns `"ready": false`

**Solution**: Wait for model to load. Check container logs:

```bash
docker logs station-gpu-worker
```

Model loading time depends on:
- GPU type
- Model size
- Storage speed
- First load (model download)

### Authentication Failures

**Issue**: Requests return 401

**Possible causes**:
- `Authorization` header missing
- API key incorrect
- Token format invalid

**Debug**:

```bash
# Check with token
curl -H "Authorization: ******" http://localhost:8000/diagnostics

# Check without token
curl http://localhost:8000/health
```

### Slow Inference

**Possible causes**:
- Context window too large
- GPU memory exhausted
- Model quantization mismatched
- Network latency from Codespace

**Solutions**:
- Reduce `CONTEXT_LENGTH`
- Reduce `MAX_CONCURRENCY`
- Check `GPU_MEMORY_REQUIREMENT` setting
- Use quantized model variant

## Cost Control

### Pod Pricing

RunPod H100: ~$1.99/hour

### Cost Breakdown per Task

Example 10-minute task:
- Pod startup: ~15s = $0.008
- Model load: ~12s = $0.007
- Inference: ~8s = $0.004
- **Total per task**: ~$0.02 (2 cents)

### Idle Timeout

Critical for cost control:

```bash
IDLE_TIMEOUT_MINUTES=5   # 5-min timeout = aggressive cost control
```

Without idle timeout, pod continues running at full hourly cost.

### Monitoring Cost

Log includes:
- Pod startup time
- Model load time
- Inference duration
- GPU utilization

Use this data to calculate actual task cost.

## Shutdown

### Graceful Shutdown

```bash
./gpu-worker/scripts/stop
```

### Force Shutdown

Terminate pod through RunPod API or UI:

```bash
# Example: RunPod API
curl -X POST https://api.runpod.io/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { podStop(input: {podId: \"pod-123\"}) { id } }"}'
```

## Security

### What the GPU Worker Has

- ✓ GPU access
- ✓ Inference model (Qwen3-Coder)
- ✓ vLLM runtime
- ✓ FastAPI server
- ✓ Authentication token

### What the GPU Worker Does NOT Have

- ✗ GitHub credentials
- ✗ Repository credentials
- ✗ Application deployment credentials
- ✗ Codespace credentials
- ✗ Production credentials
- ✗ Access to repositories
- ✗ Access to Git
- ✗ SSH keys
- ✗ AWS/GCP/Azure keys

**This is intentional.** The GPU worker is a pure inference service, isolated from secrets and credentials.

### Endpoint Security

- `/health` → Unauthenticated (monitoring only)
- `/v1/*` → Authenticated (******
- `/diagnostics` → Authenticated

All endpoints use TLS/HTTPS in production.

### Logging

Logs contain:
- Request timing
- Token counts
- Status codes
- Request IDs

Logs do NOT contain:
- Prompts (by default)
- Source code
- API keys
- Credentials
- Secrets

## Integration

### From Codespace

Set configuration:

```bash
export AI_PROVIDER=openai-compatible
export AI_BASE_URL=https://your-worker.example.com/v1
export AI_MODEL=Qwen3-Coder-30B
export AI_API_KEY=<your-api-key>
```

Then use any OpenAI-compatible client library:

```python
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["AI_API_KEY"],
    base_url=os.environ["AI_BASE_URL"]
)

response = client.chat.completions.create(
    model=os.environ["AI_MODEL"],
    messages=[{"role": "user", "content": "Explain..."}]
)

print(response.choices[0].message.content)
```

### Codex Integration

As of PR2, Codex integration is **not yet implemented**.

See `docs/AI.md` for supported client configuration.

Follow-up PR will integrate with Codex CLI if supported.
