# Task 007 — Debugging with Test Failures

## Objective

Evaluate the model's ability to diagnose and fix test failures in a real codebase.

## Category

Debugging (Category C)

## Repository

`station` — GPU worker with tests

## Task Description

### Scenario

A unit test is failing in the authentication system:

```bash
$ pytest gpu-worker/test_worker.py::test_auth_header_required -v

FAILED gpu-worker/test_worker.py::test_auth_header_required
AssertionError: assert 401 == 403
  where 401 = response.status_code
```

### Test Code

```python
def test_auth_header_required():
    """Authentication header should be required for /v1/chat/completions"""
    response = client.get("/v1/chat/completions")
    assert response.status_code == 403  # Expected: forbidden
```

### Context

- The endpoint currently returns 401 (Unauthorized)
- Test expects 403 (Forbidden)
- Both indicate lack of proper auth, but test is strict about status code
- Need to fix either the code or understand why expectation is wrong

### Questions

1. **Diagnosis**
   
   Why is the test failing? Is it:
   - Code bug?
   - Test bug?
   - Design decision?

2. **Fix**
   
   Implement the correct fix:
   - If code is wrong, fix authentication logic
   - If test is wrong, explain why
   - If design issue, propose better approach

### Expected Response

**Correct Analysis**:

- Recognizes that 401 vs 403 are both authentication failures
- Identifies that FastAPI's `HTTPException(status_code=401)` is standard
- Understands that 403 (Forbidden) is typically used after successful auth but insufficient permissions
- Notes that 401 (Unauthorized) is correct for missing credentials
- Concludes: test expectation is wrong

**Correct Fix**:

Change test to expect 401:
```python
assert response.status_code == 401
```

**Should NOT**:

- Change authentication code unnecessarily
- Break existing behavior
- Misunderstand HTTP status semantics

### Scoring

| Criterion | Points |
|-----------|--------|
| Correct root cause identified | 30 |
| Proper understanding of HTTP status codes | 25 |
| Appropriate fix implemented | 25 |
| Explanation quality | 20 |
| **Total** | **100** |

### Acceptance Criteria

- ✓ Test passes
- ✓ Authentication still works correctly
- ✓ No unrelated changes
- ✓ Explanation provided
