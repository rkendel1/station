# Coding Benchmarks

## Overview

Real-world coding tasks to evaluate the GPU worker's code understanding and generation capability.

These benchmarks assess whether Qwen3-Coder 30B is sufficient for practical development work.

## Tasks

### Task 001 — Repository Understanding

**Objective**: Evaluate architecture comprehension and file identification

**Task**: Given a real repository, explain its architecture and identify which files would need modification for a specific feature.

**Evaluation Criteria**:
- Architecture understanding (correct/partial/incorrect)
- Relevant files identified (precision/recall)
- Hallucinations detected (false positives)
- Reasoning quality

**Methodology**:
1. Present repository structure
2. Ask for architecture explanation
3. Ask to identify files for a change
4. Compare against ground truth
5. Score precision/recall

### Task 002 — Small Implementation

**Objective**: Evaluate code generation correctness

**Task**: Implement a small, bounded feature with clear requirements.

**Evaluation Criteria**:
- Implementation correctness
- Code quality
- Test completeness
- Following requirements without scope creep

**Methodology**:
1. Provide clear requirements
2. Request implementation
3. Verify against requirements
4. Run any provided tests
5. Assess code quality

### Task 003 — Debugging

**Objective**: Evaluate problem-solving and debugging capability

**Task**: Given a failing test or bug description, identify the root cause and implement a fix.

**Evaluation Criteria**:
- Root cause identified correctly
- Explanation quality
- Fix correctness
- Minimal changes (no scope creep)
- Tests passing

**Methodology**:
1. Provide failing test/bug
2. Request diagnosis and fix
3. Run test to verify fix
4. Assess explanation quality

## Recording Results

Each benchmark run should record:

```json
{
  "benchmark_id": "task-001",
  "timestamp": "2024-01-01T00:00:00Z",
  "model": "Qwen3-Coder-30B",
  "gpu": "h100",
  "vram_gb": 80,
  "quantization": "fp16",
  "context": 4096,
  
  "task_description": "Explain architecture of station/gpu-worker",
  "prompt_tokens": 1234,
  "completion_tokens": 5678,
  "total_tokens": 6912,
  
  "time_to_first_token_ms": 150,
  "total_latency_ms": 8500,
  "tokens_per_second": 815,
  
  "result": "pass/partial/fail",
  "human_assessment": "Assessment of output quality...",
  
  "provider": "runpod",
  "pod_startup_time_ms": 15000,
  "model_load_time_ms": 12000,
  "inference_time_ms": 8500,
  "gpu_utilization_percent": 85
}
```

## Cost Tracking

Each benchmark should record cost:

```
GPU hourly rate: $1.99
Startup time: 15s ($0.0083)
Model load: 12s ($0.0066)
Task inference: 8.5s ($0.0047)
Total task cost: $0.0196 (~2 cents)
```

## Important Notes

- Do not commit proprietary source code
- Use sanitized examples or public repositories
- Benchmark tasks should be self-contained
- Results are stored separately from code
- Human assessment is subjective but recorded
