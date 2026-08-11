# Task 008 — Integration Debugging

## Objective

Evaluate the model's ability to diagnose integration issues across system components.

## Category

Debugging (Category C)

## Repository

`station` — GPU worker and integration points

## Task Description

### Scenario

The health check endpoint works, but the full smoke test fails:

```bash
$ ./scripts/test-gpu
✓ Endpoint reachable
✓ Health endpoint functional
✗ Authentication required
✗ Chat completion successful
```

### Investigation Context

```bash
$ curl -i http://localhost:8000/health
HTTP/1.1 200 OK
{
  "status": "healthy",
  "ready": true
}

$ curl -i -H "Authorization: ******" \\
  http://localhost:8000/v1/chat/completions
HTTP/1.1 401 Unauthorized
{"detail": "Invalid authentication"}

$ curl -i http://localhost:8000/v1/chat/completions
HTTP/1.1 500 Internal Server Error
{"detail": "...traceback..."}
```

### Questions

1. **Root Cause**
   
   Why does the unauthenticated request return 500 instead of 401?

2. **Fix**
   
   Implement proper error handling so:
   - Unauthenticated requests return 401
   - Invalid tokens return 401
   - Server errors return 500 (but only for real errors)

### Expected Response

**Correct Diagnosis**:

- Recognizes that authentication middleware is crashing
- Identifies that error should be caught before processing request
- Notes that 500 indicates uncaught exception in auth logic
- Proposes middleware should catch all errors and return 401

**Correct Fix**:

Add error handling to authentication middleware:
```python
try:
    # validate token
except Exception as e:
    return 401  # Not 500
```

### Scoring

| Criterion | Points |
|-----------|--------|
| Root cause identified correctly | 30 |
| Understanding of middleware behavior | 25 |
| Proper error handling implementation | 25 |
| No side effects on other endpoints | 20 |
| **Total** | **100** |

### Acceptance Criteria

- ✓ Unauthenticated requests return 401
- ✓ Invalid tokens return 401
- ✓ Health endpoint still works
- ✓ Authenticated requests work
- ✓ No unrelated changes
