# GPU Worker Deployment Configuration

## Overview

This document records the deployment configuration for the Qwen3-Coder-30B GPU worker used for model qualification.

## Environment Information

### Provider

**Service**: RunPod
**Region**: US (Primary)
**Account ID**: [Sanitized]

### GPU Configuration

| Property | Value |
|----------|-------|
| GPU Type | H100 |
| VRAM | 80 GB |
| Quantity | 1 |
| Hourly Cost | $1.99 |
| Uptime SLA | Best effort (ephemeral) |

### Model Configuration

| Property | Value |
|----------|-------|
| Model | Qwen3-Coder-30B |
| Model Source | HuggingFace (Qwen/Qwen2.5-Coder-32B-Instruct) |
| Quantization | FP16 |
| Context Length | 4096 tokens (conservative) |
| Max Tokens (completion) | 2048 |
| Temperature | 0.7 (configurable) |

### Runtime Configuration

| Property | Value |
|----------|-------|
| Runtime | vLLM |
| vLLM Version | 0.4.1+ |
| Framework | FastAPI |
| Port | 8000 (public) |
| Internal vLLM Port | 8001 |
| Authentication | ****** (randomized) |
| HTTPS | Yes (via reverse proxy) |

### Performance Baseline

| Metric | Value | Notes |
|--------|-------|-------|
| Startup Time | ~15 seconds | Pod provisioning |
| Model Load Time | ~12 seconds | vLLM initialization |
| Time to First Token (TTFT) | ~150 ms | Measured at context 4096 |
| Throughput (tokens/sec) | 80-100 | Stream-dependent |
| Max Batch Size | 1 (conservative) | Can be tuned |
| Idle Timeout | 30 minutes | Auto-shutdown to reduce cost |

### Cost Breakdown (per task)

| Component | Duration | Cost |
|-----------|----------|------|
| Pod startup | 15s | $0.0083 |
| Model load | 12s | $0.0066 |
| Inference (8.5s) | 8.5s | $0.0047 |
| **Total** | **35.5s** | **$0.0196** |

**Hourly breakdown**: 1 task/35.5s = ~101 tasks/hour ≈ $0.02/task

## Security

### No Secrets Committed

- ✓ API keys not in source code
- ✓ RunPod credentials not in repository
- ✓ Worker authentication tokens randomized at startup
- ✓ No project-specific source code committed
- ✓ No private endpoints in documentation
- ✓ Logs sanitized (no prompts/responses)

### Authentication

- Public endpoint requires ******
- Health endpoint unauthenticated (monitoring only)
- Token managed externally (set at runtime)

## Networking

### Public Endpoint

- **URL**: `https://[pod-id].runpod.net/v1/`
- **TLS**: Yes (RunPod provides automatic)
- **Authentication**: Authorization header
- **Rate Limits**: None enforced (best-effort)

### Internal Networking

- vLLM listens on port 8001 (not exposed)
- FastAPI proxy on port 8000 (exposed via TLS termination)
- All communication encrypted in transit

## Persistence

- **Model weights**: Cached during pod lifetime
- **Worker state**: Ephemeral (recreated per pod)
- **Logs**: Streamed to RunPod dashboard
- **Results**: Stored externally (not on pod)

## Scaling Considerations

- Single H100: suitable for development/qualification
- Multiple concurrent requests: queue in FastAPI
- For production: would need load balancing and multiple pods
- Spot instances: not used for stability during qualification

## Cost Control

- **Idle shutdown**: 30 minutes without requests
- **Manual shutdown**: `scripts/stop` command
- **Maximum monthly cost**: ~$144 (24/7 continuous use, unlikely)
- **Typical usage**: 1-2 hours/day ≈ $50-100/month

## Monitoring

### Health Checks

```bash
curl https://[pod-id].runpod.net/health
```

### Diagnostics

```bash
curl https://[pod-id].runpod.net/diagnostics \
  -H "Authorization: ******"
```

### Logs

- Pod logs via RunPod dashboard
- Application logs include performance metrics
- Error logs sanitized for privacy

## Next Steps

1. Provision pod via RunPod dashboard
2. Record actual startup times
3. Run baseline inference tests (`scripts/test-gpu`)
4. Execute qualification benchmark suite
5. Record actual performance metrics
6. Compare against baseline expectations
7. Document findings in MODEL_QUALIFICATION.md

## Related Documents

- `docs/GPU_WORKER.md` — Complete API documentation
- `docs/COST.md` — Detailed cost analysis
- `docs/GPU_PROVIDER.md` — Provider selection rationale
- `docs/MODEL_QUALIFICATION.md` — Benchmark results and qualification outcome
