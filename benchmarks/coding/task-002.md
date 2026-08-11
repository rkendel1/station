# Task 002 — Implement Configuration Loading

## Objective

Evaluate code generation correctness with clear requirements.

## Task

Implement a Python function to load and validate worker configuration.

### Requirements

1. Load configuration from environment variables with defaults
2. Validate that required fields are present
3. Validate that numeric fields are in valid ranges
4. Return a configuration object or raise descriptive errors
5. Include docstring
6. Write tests that verify behavior

### Configuration Fields

```python
{
    "model_name": str (default: "Qwen3-Coder-30B"),
    "gpu_type": str (default: "h100"),
    "gpu_memory_requirement": int (default: 80, range: 24-640),
    "context_length": int (default: 4096, range: 512-32768),
    "max_concurrency": int (default: 4, range: 1-16),
    "idle_timeout_minutes": int (default: 30, range: 5-1440),
    "api_key": str (default: "", can be empty),
}
```

### Example Usage

```python
config = load_worker_config()
assert config.model_name == "Qwen3-Coder-30B"
assert config.gpu_memory_requirement > 0

# Invalid configuration should raise
os.environ["GPU_MEMORY_REQUIREMENT"] = "1000"
config = load_worker_config()  # Should raise ValueError
```

### Acceptance Criteria

- [x] Loads environment variables correctly
- [x] Applies defaults when env vars not set
- [x] Validates numeric ranges
- [x] Raises descriptive errors on invalid input
- [x] Includes docstring and type hints
- [x] At least 5 test cases covering normal and error cases

### Evaluation Scoring

| Criterion | Points |
|-----------|--------|
| Correct implementation | 40 |
| Proper error handling | 20 |
| Test coverage | 20 |
| Code quality/style | 10 |
| Documentation | 10 |
| **Total** | **100** |

### Sample Test Output

```
test_load_default_config ... PASS
test_load_from_environment ... PASS
test_invalid_memory ... PASS
test_invalid_concurrency ... PASS
test_valid_range_boundary ... PASS
test_missing_optional ... PASS
```

### Success Criteria

- All tests pass
- Function can be integrated into worker.py
- No dependencies beyond stdlib
- Error messages are user-friendly
