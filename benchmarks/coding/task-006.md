# Task 006 — Multi-File Implementation

## Objective

Evaluate the model's ability to implement changes across multiple interconnected files.

## Category

Implementation (Category B)

## Repository

`station` — Use the actual GPU worker repository

## Task Description

### Requirements

Implement provider configuration abstraction:

**Current State**:

Model configuration is hardcoded in `gpu-worker/worker.py` and `.env.example`.

**Required**:

1. Extract model configuration to a separate module `gpu-worker/config.py`
2. Support configuration via environment variables
3. Add validation for required fields
4. Update `worker.py` to use configuration module
5. Add configuration tests

**Configuration Fields**:

- `MODEL_NAME` — Model identifier
- `MODEL_PATH` — HuggingFace model path
- `CONTEXT_LENGTH` — Maximum context window
- `QUANTIZATION` — Quantization method (fp16, int8, etc.)
- `VRAM_REQUIRED_GB` — Minimum GPU memory

**Constraints**:

- No hardcoded secrets
- All paths must be configurable
- Backward compatible with existing `.env`
- Provide sensible defaults

### Expected Implementation

**Changes needed**:

1. Create `gpu-worker/config.py` with `Config` class
2. Add validation (raise errors for missing required config)
3. Update `gpu-worker/worker.py` to import and use config
4. Update `.env.example` to document new variables
5. Add `gpu-worker/test_config.py` tests

**Files modified**:

- `gpu-worker/config.py` (new)
- `gpu-worker/worker.py` (refactor)
- `gpu-worker/.env.example` (update)
- `gpu-worker/test_config.py` (new)

### Scoring

| Criterion | Points |
|-----------|--------|
| Correct abstraction design | 25 |
| All required fields handled | 20 |
| Tests comprehensive | 20 |
| Code organization and style | 20 |
| Documentation/comments | 15 |
| **Total** | **100** |

### Acceptance Criteria

- ✓ Configuration module loads successfully
- ✓ Validation works correctly
- ✓ All tests pass
- ✓ Worker starts with new config
- ✓ Environment variables override defaults
- ✓ No secrets in config or defaults
