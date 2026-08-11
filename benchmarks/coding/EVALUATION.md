# Benchmark Evaluation Framework

## Overview

This framework provides standardized evaluation procedures for coding tasks.

## Evaluation Modes

### Mode A: Planning

**Objective**: Evaluate architecture understanding without implementation

**Process**:

1. Present repository and requirements
2. Request: "Inspect the repository and produce an implementation plan. Do not modify files."
3. Model analyzes code, documentation, and structure
4. Model produces detailed plan covering:
   - Files to modify
   - Dependencies to consider
   - Implementation approach
   - Potential issues
   - Testing strategy

**Scoring**:

- **Correctness of File Identification** (0-5): Are the right files identified?
- **Architecture Understanding** (0-5): Does the plan show deep understanding?
- **Missing Dependencies** (0-5): Are all required changes identified?
- **Hallucinations** (0-5): Are false/unnecessary files mentioned?
- **Plan Quality** (0-5): Is the approach sound and feasible?

**Total**: 25 points

**Pass Criteria**: ≥15 points

### Mode B: Implementation

**Objective**: Evaluate practical coding ability

**Process**:

1. Provide clear requirements and acceptance criteria
2. Request: "Implement the requested change. Follow existing conventions. Run tests. Don't make unrelated changes."
3. Model implements feature/fix
4. Model runs tests and reports results

**Scoring**:

- **Task Completion** (0-5): Does it work as specified?
- **Test Success** (0-5): Do all tests pass?
- **Correctness** (0-5): Is the implementation correct?
- **Scope Discipline** (0-5): No unrelated changes?
- **Quality** (0-5): Code style, organization, clarity?

**Total**: 25 points

**Pass Criteria**: ≥15 points

## Unified Human Scoring

For each task, assign scores across these dimensions:

| Dimension | Points | Criteria |
|-----------|--------|----------|
| **Correctness** | 0-5 | Does it work as intended? No bugs? |
| **Repository Understanding** | 0-5 | Understands architecture/conventions? |
| **Implementation Quality** | 0-5 | Clean code, good design, maintainable? |
| **Test Quality** | 0-5 | Tests comprehensive, well-written? |
| **Scope Discipline** | 0-5 | Stays in scope? No unrelated changes? |
| **Explanation** | 0-5 | Clear communication of approach/results? |

**Total**: 30 points

**Pass Criteria**: ≥21 points (70%)

## Automated Testing

For implementation tasks, measure:

- ✓ Build succeeds
- ✓ Existing tests pass
- ✓ New tests pass
- ✓ No lint errors
- ✓ No type errors

**Automated Pass**: All criteria met

**Automated Fail**: Any criterion failed

### Test Coverage Requirements

```bash
# Must pass:
pytest test_*.py
mypy gpu-worker/ --strict
pylint gpu-worker/ --disable=C0111
make build
```

## Failure Classification

Every failed task must be classified:

| Category | Meaning | Example |
|----------|---------|---------|
| **UNDERSTANDING** | Misunderstood requirements/architecture | Identified wrong files, misread spec |
| **PLANNING** | Good understanding but bad plan | Overlooked dependencies, poor design |
| **IMPLEMENTATION** | Plan was good but execution failed | Wrong algorithm, off-by-one error |
| **DEBUGGING** | Can't diagnose or fix issues | Doesn't identify root cause correctly |
| **TESTING** | Test failures not diagnosed properly | Doesn't understand test expectations |
| **TOOL_USE** | Couldn't use available tools effectively | Didn't run tests, didn't check syntax |
| **CONTEXT** | Repository context too large/complex | Model lost track of requirements |
| **MODEL_LIMIT** | Model reached its capability limit | Can't do complex multi-file refactoring |
| **INFRASTRUCTURE** | System/tool failure, not model failure | GPU OOM, timeout, network issue |
| **TIMEOUT** | Task took too long to complete | No response within time limit |

## Performance Measurement

For each task, record:

### Latency

- **Time to First Token (TTFT)**: ms
- **Tokens Per Second**: throughput
- **Total Latency**: seconds
- **Input Tokens**: context size
- **Output Tokens**: completion size

### Cost

- **Pod Startup**: seconds, cost
- **Model Load**: seconds, cost
- **Inference**: seconds, cost
- **Total**: cost
- **Effective Cost**: (attempts × cost) for success

### Quality Metrics

- **Planning Accuracy**: % correct files identified
- **Implementation Success**: % tests passing
- **Hallucination Rate**: % false claims
- **Scope Discipline**: % unrelated changes

## Result Recording Template

```json
{
  "task_id": "task-001",
  "timestamp": "2024-08-11T02:00:00Z",
  
  "model": "Qwen3-Coder-30B",
  "gpu": "h100",
  "vram_gb": 80,
  "quantization": "fp16",
  
  "mode": "planning",
  "prompt": "...",
  "prompt_tokens": 1234,
  "completion_tokens": 5678,
  
  "planning_score": {
    "file_identification": 5,
    "architecture_understanding": 4,
    "missing_dependencies": 3,
    "hallucinations": 5,
    "plan_quality": 4,
    "total": 21
  },
  
  "implementation_score": {
    "task_completion": 5,
    "test_success": 5,
    "correctness": 4,
    "scope_discipline": 5,
    "quality": 4,
    "total": 23
  },
  
  "human_score": {
    "correctness": 4,
    "repository_understanding": 5,
    "implementation_quality": 4,
    "test_quality": 3,
    "scope_discipline": 5,
    "explanation": 4,
    "total": 25
  },
  
  "automation": {
    "build_passes": true,
    "tests_pass": true,
    "lint_pass": true,
    "typecheck_pass": true
  },
  
  "performance": {
    "ttft_ms": 150,
    "tokens_per_second": 85,
    "total_latency_seconds": 8.5,
    "input_tokens": 1234,
    "output_tokens": 5678
  },
  
  "cost": {
    "startup_cost": 0.0083,
    "inference_cost": 0.0047,
    "total_task_cost": 0.0130
  },
  
  "failure_classification": null,
  "success": true,
  "reasoning": "Clear understanding of architecture, correct implementation, good test coverage"
}
```

## Benchmark Suite Requirements

- **Minimum tasks**: 10
- **Categories**:
  - A (Repository Understanding): 3 tasks
  - B (Implementation): 3 tasks
  - C (Debugging): 2 tasks
  - D (Refactoring): 1 task
  - E (Test Generation): 1 task
- **Real projects**: ≥5 tasks (from actual work)
- **Task isolation**: Each task starts from clean checkout
- **Evaluation modes**: Both planning and implementation
- **Scoring**: Automated + human + classification
- **Measurement**: Performance, cost, quality metrics

## Success Thresholds

### QUALIFIED

- **Infrastructure Availability**: ≥90%
- **Task Success Rate**: ≥70% (7/10 tasks)
- **Average Planning Score**: ≥70% (21/30 points)
- **Average Implementation Score**: ≥70% (21/30 points)
- **Human Quality Score**: ≥70% average
- **Debugging Success**: ≥60% (1/2 tasks)
- **Scope Discipline**: ≥80% (minimal unrelated changes)
- **Cost**: Materially below frontier baseline
- **Latency**: Acceptable for interactive use
- **No catastrophic failures**

### CONDITIONALLY QUALIFIED

- **Task Success Rate**: 50-70%
- **Specific strengths**: Good on simple/medium tasks
- **Specific weaknesses**: Struggles with complex reasoning
- **Contexts**: Limited context window effectiveness
- **Retries**: Excessive retry rate acceptable if final cost is low
- **Latency**: Acceptable but not great

### REJECTED

- **Task Success Rate**: <50%
- **Infrastructure Instability**: <90% availability
- **Hallucination Rate**: >20%
- **Repository Comprehension**: Poor understanding
- **Debugging Ability**: <30% success
- **Latency**: Unacceptable for interactive work
- **Cost**: Exceeds frontier baseline
