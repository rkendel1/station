# Task 001 — Repository Architecture

## Objective

Evaluate the model's ability to understand a repository's architecture and identify relevant files for modification.

## Repository

`station` — Personal cloud development environment with GPU inference worker

## Architecture Understanding Task

### Context

The station repository consists of:

- `.devcontainer/` — GitHub Codespace configuration
- `docs/` — Architecture and deployment documentation
- `scripts/` — Development tooling
- `gpu-worker/` — Cloud GPU inference container
- `infra/gpu/provider/` — Provider abstraction layer
- `benchmarks/` — Model evaluation tasks

### Questions

1. **Architecture Explanation**
   
   Explain the overall architecture of this project. What are the major components and how do they interact?

2. **File Identification**
   
   A new requirement: "Support Mistral-7B in addition to Qwen3-Coder-30B"
   
   Identify which files would need modification. Estimate the scope of changes needed.

### Expected Response

**Correct Answer Elements**:

- Identifies GPU worker as core component
- Recognizes separation of concerns (worker independent of dev env)
- Names configuration files for model selection
- Identifies vLLM integration points
- Notes provider abstraction layer
- Mentions authentication/health check modifications

**Relevant Files** (approximately):

- `gpu-worker/worker.py` — Add model routing logic
- `gpu-worker/config/.env.example` — Document new model option
- `benchmarks/coding/` — Add Mistral benchmark results
- `docs/` — Document new model support

**Should NOT Identify**:

- `.devcontainer/` — No changes needed (GPU worker independent)
- `scripts/` — Limited changes (only test-gpu docs)
- Personal application files — Not in scope

### Scoring

| Criterion | Points |
|-----------|--------|
| Correct architecture explanation | 30 |
| Relevant files identified (precision) | 30 |
| Files NOT mentioned (recall) | 20 |
| No false positives/hallucinations | 20 |
| **Total** | **100** |

### Notes for Evaluation

- Examine whether model understands modular design
- Check for hallucinated files or components
- Assess reasoning quality (explanation of why files matter)
- Note any misunderstandings about GPU worker's role
