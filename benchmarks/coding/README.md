# Coding Benchmarks

## Overview

Real-world coding tasks to evaluate the GPU worker's code understanding and generation capability.

These benchmarks assess whether Qwen3-Coder 30B is sufficient for practical development work.

## Complete Task Suite (10 tasks)

### Category A — Repository Understanding (3 tasks)

#### Task 001 — Repository Architecture

**Objective**: Evaluate architecture comprehension and file identification

**Task**: Given a real repository, explain its architecture and identify which files would need modification for a specific feature.

**Evaluation Modes**: Planning + Implementation

**Evaluation Criteria**:
- Architecture understanding (correct/partial/incorrect)
- Relevant files identified (precision/recall)
- Hallucinations detected (false positives)
- Reasoning quality

#### Task 004 — Dependency Analysis

**Objective**: Evaluate ability to trace dependencies across a codebase

**Task**: Map dependencies for a specific feature and analyze what breaks if components are removed

**Evaluation Mode**: Planning

#### Task 010 — Architecture Boundaries (*)

**Objective**: Evaluate understanding of system boundaries and module interfaces

**Task**: Identify architectural boundaries and trace data flow across subsystems

**Evaluation Mode**: Planning

---

### Category B — Implementation (3 tasks)

#### Task 002 — Small Implementation

**Objective**: Evaluate code generation correctness

**Task**: Implement a small, bounded feature with clear requirements.

**Evaluation Criteria**:
- Implementation correctness
- Code quality
- Test completeness
- Following requirements without scope creep

#### Task 005 — Feature Implementation

**Objective**: Evaluate ability to extend existing functionality

**Task**: Add new functionality to an existing component with comprehensive testing

**Evaluation Mode**: Implementation

#### Task 006 — Multi-File Implementation

**Objective**: Evaluate ability to coordinate changes across multiple interconnected files

**Task**: Implement configuration abstraction and refactor multiple files to use it

**Evaluation Mode**: Implementation

---

### Category C — Debugging (2 tasks)

#### Task 003 — Debugging

**Objective**: Evaluate problem-solving and debugging capability

**Task**: Given a failing test or bug description, identify the root cause and implement a fix.

**Evaluation Criteria**:
- Root cause identified correctly
- Explanation quality
- Fix correctness
- Minimal changes (no scope creep)
- Tests passing

#### Task 007 — Test Failure Debugging

**Objective**: Evaluate ability to diagnose test failures and fix the root cause

**Task**: Analyze HTTP status code test failure and determine whether issue is in code or test

**Evaluation Mode**: Implementation

#### Task 008 — Integration Debugging

**Objective**: Evaluate ability to diagnose integration failures across components

**Task**: Diagnose why unauthenticated requests return 500 instead of 401

**Evaluation Mode**: Implementation

---

### Category D — Refactoring (1 task)

#### Task 009 — Refactoring with Test Preservation

**Objective**: Evaluate ability to improve code while preserving behavior and tests

**Task**: Extract authentication logic from multiple endpoints into reusable dependency

**Evaluation Criteria**:
- Correct refactoring design
- All tests pass
- No behavior changes
- Code quality improvement

---

### Category E — Test Generation (1 task)

#### Task 010 — Test Coverage Expansion (*)

**Objective**: Evaluate ability to identify missing test coverage and add appropriate tests

**Task**: Identify missing test scenarios and add 5+ new test cases

**Evaluation Mode**: Implementation

---

## Evaluation Framework

### Two Evaluation Modes

**Mode A — Planning**: Analyze repository and produce implementation plan WITHOUT modifying files
**Mode B — Implementation**: Implement changes, run tests, ensure all acceptance criteria met

### Scoring System

Each task scored on six dimensions (0-5 each = 30 points max):

- **Correctness**: Does it work as intended?
- **Repository Understanding**: Understands architecture/conventions?
- **Implementation Quality**: Clean, maintainable code?
- **Test Quality**: Comprehensive, well-written tests?
- **Scope Discipline**: Stays in scope? No unrelated changes?
- **Explanation**: Clear communication?

**Pass threshold**: ≥21/30 points (70%)

### Automated Testing

Implementation tasks must pass:
- ✓ Build succeeds
- ✓ Existing tests pass  
- ✓ New tests pass
- ✓ No lint errors
- ✓ No type errors

### Failure Classification

Every failed task receives a category:

- UNDERSTANDING — Misunderstood requirements
- PLANNING — Good understanding, bad plan
- IMPLEMENTATION — Bad execution of good plan
- DEBUGGING — Can't diagnose issues
- TESTING — Test interpretation problems
- TOOL_USE — Couldn't use available tools
- CONTEXT — Lost track of requirements
- MODEL_LIMIT — Hit capability limit
- INFRASTRUCTURE — System/tool failure
- TIMEOUT — Took too long

## Running Benchmarks

### Quick Start

```bash
# Initialize benchmark environment
./scripts/benchmark-manager init

# Run a single task in planning mode
./scripts/benchmark-manager run --task 001 --mode planning

# Run a single task in implementation mode
./scripts/benchmark-manager run --task 001 --mode implementation

# Run all tasks
./scripts/benchmark-manager run --all

# Check status
./scripts/benchmark-manager status

# Clean results
./scripts/benchmark-manager clean --task 001
```

### Testing Custom Endpoint

```bash
# Test with GPU worker
AI_BASE_URL=https://[pod-id].runpod.net/v1 \
AI_MODEL=Qwen3-Coder-30B \
AI_API_KEY=[API_KEY] \
./scripts/ai-test --iterations 3 "What is 2+2?"

# Output includes latency and throughput metrics
```

## Recording Results

Each benchmark run records:

```json
{
  "task_id": "task-001",
  "timestamp": "2024-08-11T02:00:00Z",
  "mode": "planning",
  
  "model": "Qwen3-Coder-30B",
  "gpu": "h100",
  "vram_gb": 80,
  "quantization": "fp16",
  "context": 4096,
  
  "prompt_tokens": 1234,
  "completion_tokens": 5678,
  "total_tokens": 6912,
  
  "performance": {
    "ttft_ms": 150,
    "total_latency_ms": 8500,
    "tokens_per_second": 815
  },
  
  "cost": {
    "startup_cost": 0.0083,
    "inference_cost": 0.0047,
    "total_task_cost": 0.0130
  },
  
  "scoring": {
    "correctness": 4,
    "repository_understanding": 5,
    "implementation_quality": 4,
    "test_quality": 3,
    "scope_discipline": 5,
    "explanation": 4,
    "total": 25
  },
  
  "status": "pass",
  "failure_classification": null
}
```

## Cost Calculation

```
GPU hourly rate:          $1.99
Startup time:             15s    → $0.0083
Model load:               12s    → $0.0066
Task inference:           8.5s   → $0.0047
─────────────────────────────────
Total task cost:          35.5s  → $0.0196 (~2 cents)
```

### Effective Cost

```
Effective cost = GPU_cost + (failed_attempts × cost) + retry_cost

Example (70% success rate):
  Per-attempt cost: $0.02
  Attempts to success: 1 / 0.70 ≈ 1.43
  Effective cost: $0.02 × 1.43 = $0.029 (~3 cents)
```

## Evaluation Documentation

- **`benchmarks/coding/EVALUATION.md`** — Complete evaluation framework
- **`docs/MODEL_QUALIFICATION.md`** — Detailed qualification report template
- **`docs/DEPLOYMENT.md`** — Actual deployment configuration and metrics
- **`docs/CODEX_INTEGRATION.md`** — Codex CLI compatibility findings

## Important Notes

- ✓ Do not commit proprietary source code
- ✓ Use sanitized examples or public repositories
- ✓ Benchmark tasks should be self-contained
- ✓ Results stored separately from code
- ✓ Human assessment is documented
- ✓ All metrics are measurable and reproducible
- ✓ Task isolation ensures no cross-contamination
