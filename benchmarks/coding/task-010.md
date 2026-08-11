# Task 010 — Test Coverage Expansion

## Objective

Evaluate the model's ability to identify missing test coverage and add appropriate tests.

## Category

Test Generation (Category E)

## Repository

`station` — GPU worker with existing tests

## Task Description

### Analysis

The GPU worker has basic endpoint tests but missing edge cases:

```python
def test_chat_completions_with_valid_auth():
    """Basic test - does it work?"""
    response = client.post(
        "/v1/chat/completions",
        headers={"Authorization": f"******"},
        json={"model": "Qwen3-Coder-30B", "messages": [...]}
    )
    assert response.status_code == 200

# Missing tests:
# - What if max_tokens is negative?
# - What if messages is empty?
# - What if model name is wrong?
# - What if API returns no choices?
# - What if token count exceeds context window?
```

### Task

**Identify** missing test scenarios for the chat completion endpoint:

1. Invalid input validation
2. Edge cases in response handling
3. Error conditions and error messages
4. Boundary conditions (max tokens, context length)
5. Concurrency issues (if applicable)

**Add** at least 5 new test cases that:

- Cover realistic error scenarios
- Don't modify production code
- Follow existing test patterns
- Have clear naming and documentation
- Are independently runnable

### Expected Implementation

**New tests should cover**:

1. Invalid model name
2. Invalid message format
3. Max tokens out of bounds
4. Empty messages
5. Missing required fields

**Format**:

```python
def test_chat_completions_invalid_model():
    """Should reject unknown model"""
    response = client.post(
        "/v1/chat/completions",
        headers={"Authorization": f"******"},
        json={
            "model": "nonexistent-model",
            "messages": [{"role": "user", "content": "hi"}]
        }
    )
    assert response.status_code == 400

# ... similar for other cases
```

### Scoring

| Criterion | Points |
|-----------|--------|
| Missing scenarios identified correctly | 25 |
| Test quality and coverage | 25 |
| Tests are independent and runnable | 20 |
| Follow repository test patterns | 20 |
| Documentation and clarity | 10 |
| **Total** | **100** |

### Acceptance Criteria

- ✓ At least 5 new test cases added
- ✓ All new tests pass
- ✓ All existing tests still pass
- ✓ No production code modified
- ✓ Tests are maintainable and clear
