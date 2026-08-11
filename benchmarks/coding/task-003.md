# Task 003 — Fix Authentication Bug

## Objective

Evaluate debugging and problem-solving capability.

## Task

The health endpoint returns 200 even when the API key is required but not provided. Fix the bug.

### Current Behavior

The `/health` endpoint is supposed to be unauthenticated (always reachable), but other endpoints should require authentication.

However, there's a bug: the code has a subtle authentication issue on the unauthenticated endpoints.

### Failing Tests

```python
def test_health_no_auth():
    """Health should work without auth"""
    response = client.get("/health")
    assert response.status_code == 200

def test_diagnostics_requires_auth():
    """Diagnostics should require auth"""
    response = client.get("/diagnostics")
    assert response.status_code == 401
    
def test_chat_no_auth_fails():
    """Chat completion without auth should fail"""
    response = client.post("/v1/chat/completions", json={
        "model": "test",
        "messages": [{"role": "user", "content": "hi"}]
    })
    assert response.status_code == 401
```

### Bug Scenario

When `API_KEY` is set:
1. `/health` works (expected)
2. `/diagnostics` returns 401 without header (expected)
3. `/v1/chat/completions` returns 400 instead of 401 (bug!)

The issue is in how authentication headers are passed and validated.

### Requirements

1. Identify root cause of the authentication failure
2. Explain why the endpoint returns 400 instead of 401
3. Fix the authentication decorator or endpoint logic
4. Ensure all three tests pass
5. No other changes to authentication behavior

### Evaluation Scoring

| Criterion | Points |
|-----------|--------|
| Root cause identified correctly | 30 |
| Explanation quality | 20 |
| Fix correctness (all tests pass) | 30 |
| Code quality of fix | 10 |
| Minimal changes (no scope creep) | 10 |
| **Total** | **100** |

### Expected Output

```
✓ Health endpoint reachable without auth
✓ Diagnostics endpoint protected
✓ Chat completion endpoint protected
✓ Valid auth token accepted
✓ Invalid auth token rejected
```

### Hints for Evaluation

- Check how the auth header is extracted from request
- Verify decorator is applied to correct endpoints
- Ensure error responses distinguish between auth/validation errors
- Look at request validation order (auth before validation)

### Success

The fix should:
- Make all three tests pass
- Not change the API contract
- Properly distinguish 401 (auth failure) from 400 (validation failure)
