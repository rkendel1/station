# GPU Worker

Cloud GPU inference worker providing OpenAI-compatible API for Qwen3-Coder-30B.

## Quick Start

### Prerequisites

- Docker
- NVIDIA GPU (H100 or RTX 4090)
- Python 3.10+ for testing

### Build

```bash
docker build -t station-gpu-worker:latest .
```

### Run Locally

```bash
docker run -e MODEL_NAME=Qwen3-Coder-30B \
           -e API_KEY=test-secret-key \
           -p 8000:8000 \
           station-gpu-worker:latest
```

### Test Health

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{
  "status": "healthy",
  "model": "Qwen3-Coder-30B",
  "gpu": "h100",
  "ready": true
}
```

## Architecture

- **Application**: FastAPI (Python)
- **Inference Runtime**: vLLM
- **Model**: Qwen3-Coder-30B (configurable)
- **Authentication**: ****** via Authorization header
- **Endpoints**: OpenAI-compatible `/v1/*`

## Key Files

- `worker.py` — FastAPI application with vLLM integration
- `Dockerfile` — Container definition
- `scripts/start` — Start the worker
- `scripts/health` — Health check probe
- `scripts/stop` — Stop the worker
- `config/.env.example` — Configuration template

## Configuration

See `config/.env.example` for all configuration options:

```bash
MODEL_NAME=Qwen3-Coder-30B
GPU_TYPE=h100
GPU_MEMORY_REQUIREMENT=80
CONTEXT_LENGTH=4096
MAX_CONCURRENCY=4
IDLE_TIMEOUT_MINUTES=30
API_KEY=<runtime-secret>
```

## API Endpoints

### Unauthenticated

- `GET /health` — Health check, returns immediately

### Authenticated (require `Authorization: ******

- `GET /v1/models` — List available models
- `POST /v1/chat/completions` — Chat completion (OpenAI-compatible)
- `GET /diagnostics` — Worker diagnostics and metrics

## Usage from Codespace

1. Set configuration:

```bash
export AI_BASE_URL=https://your-worker.example.com/v1
export AI_API_KEY=<your-api-key>
export AI_MODEL=Qwen3-Coder-30B
```

2. Run smoke test:

```bash
./scripts/test-gpu
```

3. Use in your application:

```python
from openai import OpenAI

client = OpenAI(
    api_key="<your-api-key>",
    base_url="https://your-worker.example.com/v1"
)

response = client.chat.completions.create(
    model="Qwen3-Coder-30B",
    messages=[{"role": "user", "content": "Explain this code..."}]
)
```

## Deployment

See `docs/GPU_WORKER.md` for complete deployment instructions.

For this PR, the worker is deployed to RunPod as a proof of concept. See `docs/GPU_PROVIDER.md` for provider selection rationale.

## Testing

Unit tests for the FastAPI application are in `tests/`.

Smoke tests verify the running worker:

```bash
./tests/smoke
```

Benchmarks are in `benchmarks/coding/`:

- Task 001: Architecture understanding
- Task 002: Code implementation
- Task 003: Debugging

## Security

- All inference endpoints require authentication
- Health endpoint (unauthenticated) for monitoring only
- No repository credentials or secrets on the worker
- HTTPS required in production (use reverse proxy)
- No direct vLLM port exposure

## Cost

RunPod H100: ~$1.99/hour

Per-task cost: ~$0.015 (including startup overhead)

See `docs/COST.md` for detailed analysis and comparison with frontier APIs.

## Documentation

- `docs/GPU_WORKER.md` — Complete API documentation
- `docs/GPU_PROVIDER.md` — Provider selection and configuration
- `docs/COST.md` — Cost analysis and optimization
- `docs/AI.md` — Integration with Codespace

## Troubleshooting

See `docs/GPU_WORKER.md` for troubleshooting guide.

Common issues:
- Model not ready: Wait longer, check logs
- Authentication failures: Verify API key and header format
- Slow inference: Check GPU utilization, reduce context window
- High cost: Enable idle timeout, batch requests
