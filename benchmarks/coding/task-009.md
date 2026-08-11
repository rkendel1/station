# Task 009 — Refactoring with Test Preservation

## Objective

Evaluate the model's ability to refactor code while maintaining all existing behavior and tests.

## Category

Refactoring (Category D)

## Repository

`station` — GPU worker

## Task Description

### Requirements

Refactor the authentication system:

**Current Pattern**:

```python
@app.get("/v1/models")
async def list_models():
    if not request.headers.get("Authorization"):
        raise HTTPException(status_code=401)
    token = request.headers.get("Authorization").replace("Bearer ", "")
    if token != os.getenv("API_KEY"):
        raise HTTPException(status_code=401)
    # ...

@app.post("/v1/chat/completions")
async def chat_completions():
    if not request.headers.get("Authorization"):
        raise HTTPException(status_code=401)
    token = request.headers.get("Authorization").replace("Bearer ", "")
    if token != os.getenv("API_KEY"):
        raise HTTPException(status_code=401)
    # ...
```

**Problem**: Authentication logic duplicated across endpoints

**Refactoring Goal**: Extract into dependency/middleware

**Constraints**:

- Preserve all existing behavior
- All existing tests must pass
- No new dependencies
- No changes to API contracts
- Security must not be compromised

### Expected Implementation

**Approach**:

Create FastAPI dependency:
```python
async def verify_auth(request: Request) -> bool:
    # extract and validate token
    # raise HTTPException on failure
```

Use in endpoints:
```python
@app.get("/v1/models")
async def list_models(auth: bool = Depends(verify_auth)):
    # ...
```

**Changes needed**:

- Extract auth logic to dependency
- Update all protected endpoints to use dependency
- Ensure no authentication regression
- Run all tests to verify

### Scoring

| Criterion | Points |
|-----------|--------|
| Correct refactoring design | 25 |
| All tests pass | 25 |
| No behavior changes | 25 |
| Code quality improvement | 15 |
| Explanation quality | 10 |
| **Total** | **100** |

### Acceptance Criteria

- ✓ All existing tests pass
- ✓ No security regression
- ✓ Authentication still required
- ✓ Code is more maintainable
- ✓ No unrelated changes
