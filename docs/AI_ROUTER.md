# AI Personal Coding Layer — Architecture & Usage

## Overview

The AI Router provides an intelligent abstraction layer between your development environment and AI models. You no longer need to think about which model to use, which endpoint to call, or how to start/stop the GPU.

Instead, use the unified interface:

```bash
ai status      # Check current configuration
ai model       # View or switch models
ai start       # Start GPU (if using local Qwen)
ai stop        # Stop GPU (save money)
ai list        # See available models
ai profile     # Change your profile
```

## Architecture

```
                    YOUR CODESPACE
┌──────────────────────────────────────────────┐
│                                              │
│   Projects    Codex CLI     AI Commands      │
│      │           │                 │         │
│      └───────────┴─────────────────┘         │
│                   │                          │
│                   ▼                          │
│        ┌────────────────────┐               │
│        │    AI Router       │               │
│        │                    │               │
│        │ • Task classify    │               │
│        │ • Model select     │               │
│        │ • Cost policy      │               │
│        │ • Availability     │               │
│        └────────┬───────────┘               │
│                 │                           │
└─────────────────┼───────────────────────────┘
                  │
        ┌─────────┼──────────────┐
        │         │              │
        ▼         ▼              ▼
    ┌────────┬──────────┐  ┌──────────┐
    │ Qwen3  │ GPT-4    │  │ Claude   │
    │RunPod  │ OpenAI   │  │Anthropic │
    │$0.02   │ $0.12    │  │ $0.10    │
    └────────┴──────────┘  └──────────┘
```

## Key Concepts

### The AI Router

The AI Router is the single logical AI endpoint. It:

1. **Classifies tasks** — Determines what type of work you're doing
2. **Selects models** — Chooses the best model for the task
3. **Enforces policy** — Respects cost and quality constraints
4. **Manages availability** — Checks if models are ready to use

### Models vs Profiles vs Policies

- **Models** (`config/ai/models.yaml`) — Definitions of available AI models
  - Capabilities (what each model is good at)
  - Performance characteristics
  - Cost information
  - Quality metrics

- **Profiles** (`config/ai/profiles.yaml`) — Usage patterns and preferences
  - "Default" — balanced cost and quality
  - "Cost Sensitive" — minimize costs
  - "Quality First" — prioritize quality
  - "Balanced" — let router decide
  - "Exploration" — compare models

- **Policies** (`config/ai/policy.yaml`) — Rules and constraints
  - Cost limits (daily, monthly, per-request)
  - Quality gates
  - Security settings
  - Feature flags

### Critical Design: Codex Doesn't Know About RunPod

The old way (bad):
```
Codex CLI
   ├─ RunPod (hardcoded)
   ├─ OpenAI (hardcoded)
   └─ Anthropic (hardcoded)
```

The new way (good):
```
Codex CLI
   ↓
AI_BASE_URL (single environment variable)
   ↓
AI Router (decides what's behind the URL)
   ↓
Qwen3 / Frontier / Claude
```

This means:
- Codex doesn't need updates when you change models
- You can switch models with a single command
- Future models integrate automatically

## Quick Start

### 1. Check Current Status

```bash
ai status
```

Output:
```
AI Status
==========================================

✓ Model: gpt-4-turbo-preview
✓ Provider: openai
✓ Base URL: https://api.openai.com/v1
✓ API Key: (****** configured)
✓ Profile: balanced (default)

Testing connectivity... ✓ Connected
```

### 2. Switch to Qwen3 (Cheap, Local)

```bash
# Start the GPU first
ai start

# Switch to Qwen3
ai model qwen

# Check status
ai status
```

### 3. Switch to Frontier (Expensive, Best Quality)

```bash
# Requires OpenAI API key
export OPENAI_API_KEY=sk-...

ai model frontier
ai status
```

### 4. Change Profile

```bash
# Use cost-sensitive profile (minimize spending)
ai profile cost_sensitive

# Use quality-first profile (best results)
ai profile quality_first

# Back to balanced
ai profile balanced
```

### 5. Stop GPU (Save Money)

```bash
ai stop
```

## Configuration Files

### models.yaml

Defines available models and their characteristics:

```yaml
models:
  qwen:
    name: "Qwen3-Coder-30B"
    provider: openai-compatible
    cost_class: very_low
    capabilities:
      coding: true
      debugging: true
      architectural_planning: false
    performance:
      ttft_ms: 125
      tokens_per_second: 900
    cost:
      average_task_cost: 0.0294
```

### profiles.yaml

Defines usage profiles:

```yaml
profiles:
  cost_sensitive:
    preferred_model: qwen
    fallback_model: claude
    task_routing:
      implementation: qwen
      complex_architecture: frontier  # Escalate only when needed
```

### policy.yaml

Defines policies and constraints:

```yaml
policy:
  cost_management:
    hard_limits:
      per_request_usd: 2.00
      per_day_usd: 100.00
      per_month_usd: 1000.00
```

## Model Capabilities Matrix

| Task | Qwen3 | GPT-4 | Claude |
|------|-------|-------|--------|
| Implementation | ✓ | ✓ | ✓ |
| Debugging | ✓ | ✓ | ✓ |
| Test Generation | ✓ | ✓ | ✓ |
| Refactoring | ✓ | ✓ | ✓ |
| Architecture | ✗ | ✓ | ✓ |
| Novel Problems | ✗ | ✓ | ✓ |
| Security Review | ✗ | ✓ | ✓ |
| **Cost** | **$0.02-0.03** | **$0.12** | **$0.10** |
| **Quality** | 24/30 | 28/30 | 27/30 |

## Cost Optimization

### When to Use Each Model

**Qwen3** ($0.02-0.03 per task):
- ✓ Implementation of specs
- ✓ Refactoring
- ✓ Test generation
- ✓ Simple debugging
- ✓ Documentation

**Frontier** ($0.10-0.12 per task):
- ✓ Complex architecture
- ✓ Novel algorithms
- ✓ Security-critical code
- ✓ When Qwen fails
- ✓ Unknown/unfamiliar codebases

### Cost Profiles

```bash
# Tight budget — use Qwen for almost everything
ai profile cost_sensitive

# Standard — balance cost and quality
ai profile balanced

# Generous — always use frontier
ai profile quality_first
```

### Monthly Cost Examples

| Profile | Qwen | Frontier | Total |
|---------|------|----------|-------|
| Cost Sensitive | 30 tasks | 5 tasks | $1.40 |
| Balanced | 50 tasks | 20 tasks | $3.98 |
| Quality First | 10 tasks | 70 tasks | $8.80 |

*(Assumes 1 task per development session, ~20 sessions/month)*

## Environment Variables

The AI system uses these environment variables:

```bash
# Current configuration (set by ai commands)
AI_PROVIDER=openai-compatible    # Provider type
AI_BASE_URL=https://...          # Endpoint URL
AI_MODEL=Qwen3-Coder-30B         # Model name
AI_API_KEY=...                   # Authentication
AI_PROFILE=balanced              # Active profile

# GPU control (if using RunPod)
RUNPOD_POD_ID=...               # Pod identifier
RUNPOD_API_KEY=...              # RunPod authentication
RUNPOD_WORKER_KEY=...           # Worker authentication

# API keys (never commit to repo)
OPENAI_API_KEY=sk-...           # For frontier models
ANTHROPIC_API_KEY=sk-ant-...    # For Claude
```

## Codex Integration

Codex CLI uses the same environment variables through `AI_BASE_URL`:

```bash
# Set model for Codex
ai model qwen

# Codex automatically uses:
# - AI_BASE_URL (Qwen endpoint)
# - AI_MODEL (Qwen3-Coder-30B)
# - AI_API_KEY (authentication)

# Use Codex as normal
codex --explain "what does this function do?"
```

## Advanced Usage

### Python API (for custom integrations)

```python
from infra.ai import get_router

# Get router instance
router = get_router()

# Select model for a task
model_key = router.select_model(
    task_type="implementation",
    max_cost=0.10  # Don't spend more than $0.10
)

# Get model information
model = router.get_model_info(model_key)
print(f"Using {model.name}")
print(f"Cost: ${model_cost} per task")
```

### Manual Model Selection

```bash
# Use router to guide selection
python3 -c "
from infra.ai import get_router
router = get_router()
model = router.select_model(task_type='debugging')
print(model)
"
```

## Troubleshooting

### "AI_BASE_URL not configured"

```bash
# Need to start GPU and configure
ai start
ai model qwen
ai status
```

### "Cannot reach endpoint"

```bash
# GPU might not be running
ai start

# Check status
ai status

# Test connectivity
ai test "hello"
```

### "API_KEY not configured"

```bash
# For frontier models
export OPENAI_API_KEY=sk-...
ai model frontier

# For Claude
export ANTHROPIC_API_KEY=sk-ant-...
ai model claude
```

### "Model not available"

```bash
# Check what's available
ai list

# Switch to available model
ai model qwen  # or frontier, or claude
```

## FAQ

**Q: Can I use Qwen for everything?**
A: Almost! Qwen works for ~85% of development tasks. Use frontier for complex architecture or when Qwen gets stuck.

**Q: How much does Qwen cost per month?**
A: ~$0.60-3.00 depending on usage. Much cheaper than frontier.

**Q: Can I switch models mid-session?**
A: Yes! `ai model <name>` switches immediately.

**Q: Will switching models break my Codex configuration?**
A: No! Codex uses `AI_BASE_URL` which the `ai` command updates automatically.

**Q: Can I run multiple models simultaneously?**
A: Qwen is single-GPU only (no concurrent requests). Frontier models are API-based (concurrent). The router handles this automatically.

**Q: What if I want to compare models?**
A: Use the "exploration" profile: `ai profile exploration`

**Q: How do I know which model I'm using?**
A: Run `ai status` anytime to see current configuration.

**Q: Can I set cost limits?**
A: Yes! See `config/ai/policy.yaml` for hard/soft limits.

## References

- Configuration files: `config/ai/`
- AI module: `infra/ai/`
- Scripts: `scripts/ai`, `scripts/ai-model`
- GPU management: `scripts/gpu-start`, `scripts/gpu-stop`
- Model qualification: `docs/MODEL_QUALIFICATION.md`
- Cost analysis: `docs/COST.md`
- GPU documentation: `docs/GPU_WORKER.md`

---

**Remember**: The AI Router is here to remove complexity. You focus on your code, the router handles which model to use.
