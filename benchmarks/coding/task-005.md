# Task 005 — Feature Implementation

## Objective

Evaluate the model's ability to implement a complete feature with clear requirements across multiple files.

## Category

Implementation (Category B)

## Repository

`station` — Use any real repository with actual tests

## Task Description

### Requirements

Implement a diagnostics endpoint enhancement:

**Feature**: Add response time tracking to diagnostics

**Current State**:
```python
@app.get("/diagnostics")
async def get_diagnostics():
    return {
        "worker": "gpu-worker",
        "gpu": config.GPU_TYPE,
        # ... other fields
    }
```

**Required**:

1. Track time of last successful inference
2. Calculate time since last request
3. Return `last_request_age_seconds` in diagnostics
4. Handle case where no requests have been made

**Constraints**:

- Preserve all existing fields
- Do not modify authentication
- Add tests for the new functionality
- Follow existing code style

### Expected Implementation

**Changes needed**:

- Add timestamp tracking to worker state
- Update inference endpoint to record timestamp
- Enhance diagnostics calculation
- Add unit tests for edge cases

**Files modified**:

- `gpu-worker/worker.py` — Main changes
- `gpu-worker/test_worker.py` — Add tests (if exists)

**Test cases**:

- Initial state (no requests): Should show `null` or large number
- After one request: Should show ~0 seconds
- After 5-minute gap: Should show ~300 seconds
- Concurrent requests: Should handle safely

### Scoring

| Criterion | Points |
|-----------|--------|
| Feature implemented correctly | 25 |
| Tests pass and cover edge cases | 25 |
| Code follows repository style | 20 |
| No scope creep (unrelated changes) | 20 |
| Explanation of implementation | 10 |
| **Total** | **100** |

### Acceptance Criteria

- ✓ Implementation compiles/runs
- ✓ Unit tests pass
- ✓ Existing tests still pass
- ✓ No linting errors
- ✓ Correctly handles edge cases
