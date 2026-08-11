# GPU Management & Model Selection

This directory contains scripts for managing the GPU worker lifecycle and selecting which AI model to use for development tasks.

## Quick Start

### Start GPU Worker

```bash
./scripts/gpu-start
```

Provisions a new H100 GPU pod on RunPod and returns the pod ID.

### Configure Environment

```bash
export RUNPOD_POD_ID=<pod-id-from-gpu-start>
export AI_BASE_URL=https://${RUNPOD_POD_ID}.runpod.net/v1
export AI_MODEL=Qwen3-Coder-30B
export AI_API_KEY=<worker-token>
```

### Select Model

```bash
# Use Qwen3 (cheap, default)
./scripts/ai-model qwen

# Use frontier model (expensive, best quality)
./scripts/ai-model frontier

# Check current config
./scripts/ai-model status
```

### Verify GPU Status

```bash
./scripts/gpu-status
```

Shows worker status, diagnostics, and runs a quick inference test.

### Stop GPU Worker

```bash
./scripts/gpu-stop
```

Terminates the GPU pod and stops billing.

---

## Scripts

### `gpu-start`

**Purpose**: Provision a new RunPod GPU worker

**Prerequisites**:
- Set `RUNPOD_API_KEY` environment variable

**Usage**:
```bash
./scripts/gpu-start
```

**Output**: Returns pod ID and configuration instructions

**Cost**: ~$0.025-0.035 per task (or ~$0.00055/second)

### `gpu-status`

**Purpose**: Check GPU worker health and get diagnostics

**Prerequisites**:
- Set `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`

**Usage**:
```bash
./scripts/gpu-status
```

**Output**: Shows:
- Worker status (ready/not ready)
- GPU type and VRAM
- Uptime and last request time
- Test inference result

### `gpu-stop`

**Purpose**: Terminate the GPU worker and stop billing

**Prerequisites**:
- Set `RUNPOD_POD_ID` and `RUNPOD_API_KEY`

**Usage**:
```bash
./scripts/gpu-stop
```

**Effect**: Terminates pod immediately, billing stops when shutdown completes

### `ai-model`

**Purpose**: Switch between different AI models for development

**Usage**:
```bash
./scripts/ai-model qwen        # Use Qwen3-Coder-30B (default, cheap)
./scripts/ai-model frontier    # Use GPT-4 Turbo (expensive, best)
./scripts/ai-model claude      # Use Claude-3 Opus (alternative)
./scripts/ai-model status      # Show current configuration
./scripts/ai-model list        # Show available models
./scripts/ai-model help        # Show help
```

**Configuration**: Updates `~/.env.local` with model settings

---

## Cost Management

### Qwen3 on RunPod

- **Pod hourly rate**: ~$1.99
- **Startup cost**: ~$0.0083 (15 seconds)
- **Model load**: ~$0.0066 (12 seconds)
- **Average inference**: ~$0.0044 (8 seconds)
- **Average task cost**: ~$0.019 (35 seconds)

### Break-Even Analysis

Qwen3 becomes cheaper than frontier models after:
- 3-4 requests per pod session
- Typical development session has 8-12 requests
- **Monthly savings**: 90% cost reduction for routine development

### Cost Guards

GPU worker should NOT remain running when development is complete:

```bash
# Immediately stop if you're done
./scripts/gpu-stop

# Automatic shutdown after 30 minutes of inactivity
# (configured in GPU worker)
```

---

## Security

### Secrets Management

**Never commit to repository**:
- ❌ `RUNPOD_API_KEY`
- ❌ `AI_API_KEY`
- ❌ `OPENAI_API_KEY`
- ❌ Pod IDs (in some cases)

**Set via environment variables**:
```bash
export RUNPOD_API_KEY=...      # Set in terminal session
export AI_API_KEY=...          # Set for this pod
export OPENAI_API_KEY=...      # Set for frontier API
```

### Configuration Files

- `~/.env.local` — User-specific AI model settings (NOT committed)
- `.env.example` — Template with placeholders (safe to commit)
- No secrets in `.codex/config.yaml` (use environment variable references)

### Network Security

- ✓ HTTPS required for remote pod access
- ✓ ****** authentication required
- ✓ vLLM not publicly exposed
- ✓ Codespace-to-pod traffic encrypted

---

## Integration with Codex

If you have Codex CLI installed, it can use Qwen3 automatically:

```bash
# After setting up GPU worker
./scripts/ai-model qwen

# Codex will use Qwen3 automatically
codex --help
```

See `docs/CODEX_INTEGRATION.md` for full Codex setup instructions.

---

## Troubleshooting

### GPU worker won't start

```bash
# Check API key
echo $RUNPOD_API_KEY

# Check quota
curl -s -H "api_key: $RUNPOD_API_KEY" https://api.runpod.io/graphql \
  -d '{"query":"query{user{balance}}"}'
```

### Can't connect to running pod

```bash
# Verify pod ID
echo $RUNPOD_POD_ID

# Test endpoint directly
curl https://${RUNPOD_POD_ID}.runpod.net/v1/health

# Check auth header
curl -H "Authorization: ****" https://${RUNPOD_POD_ID}.runpod.net/v1/models
```

### Model switching doesn't work

```bash
# Verify environment variables are set
./scripts/ai-model status

# Manually set if needed
export AI_BASE_URL=https://[pod-id].runpod.net/v1
export AI_MODEL=Qwen3-Coder-30B
```

### Pod won't stop

```bash
# Check RunPod console
https://console.runpod.io

# Force stop if necessary (be careful)
curl -X POST https://api.runpod.io/graphql \
  -H "api_key: $RUNPOD_API_KEY" \
  -d '{"query":"mutation{podTerminate(input:{podId:\"'"$RUNPOD_POD_ID"'\"})}"}'
```

---

## References

- GPU Worker: `docs/GPU_WORKER.md`
- Model Qualification: `docs/MODEL_QUALIFICATION.md`
- Codex Integration: `docs/CODEX_INTEGRATION.md`
- Cost Analysis: `docs/COST.md`
- Model Profile: `config/models/qwen3-coder-30b.yaml`

---

## Important Notes

1. **Always stop the GPU** when development is complete to avoid runaway costs
2. **Cold start is slower** (45s) but reusing pods is fast (2s)
3. **One-at-a-time** inference (max 1 concurrent request)
4. **Use model switching** to escalate to frontier for difficult tasks
5. **Monitor costs** with `./scripts/gpu-status`

---

**Next Steps**: See PR5 for personal coding profiles and model routing.
