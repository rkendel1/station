# CODEX_INTEGRATION.md — Codex CLI Custom Endpoint Support

## Overview

This document records the investigation into Codex CLI compatibility with custom OpenAI-compatible endpoints running on RunPod.

**Status**: [Investigation Date]

---

## Executive Summary

### Question

Can the current Codex CLI directly use a remote OpenAI-compatible endpoint without modification?

### Answer

[YES / NO / PARTIAL]

**Details**: [Summary of findings]

---

## Investigation Process

### 1. Codex CLI Version

- **Version**: [XXX]
- **Installation**: [Method]
- **Configuration File**: `~/.codex/config.json` or similar
- **Environment Variables**: [List supported]

### 2. Current Codex Configuration Options

```bash
# Run to check available configuration
codex config --help
```

**Available Options**:

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| [Param 1] | [Type] | [Default] | [Purpose] |
| [Param 2] | [Type] | [Default] | [Purpose] |

### 3. OpenAI Compatibility Investigation

**Question**: Does Codex support custom `base_url` parameter?

```bash
codex --api-key=xxx --base-url=https://pod.runpod.net/v1 "test prompt"
```

**Result**: [YES / NO / PARTIAL]

**Evidence**:

- [Documentation reference]
- [Actual test result]
- [Error message if failed]

### 4. Authentication Investigation

**Question**: How does Codex handle API authentication?

**OpenAI Default**:
```bash
Authorization: ******
```

**Custom Endpoint Requirement**:
```bash
Authorization: [Format expected by GPU worker]
```

**Compatibility**: [YES / NO]

**Configuration**:

```bash
# If supported
export CODEX_API_KEY=[API_KEY]
codex --base-url=https://pod.runpod.net/v1 --model=Qwen3-Coder-30B "prompt"

# Or in config file
cat ~/.codex/config.json
{
  "base_url": "https://pod.runpod.net/v1",
  "api_key": "[API_KEY]",
  "model": "Qwen3-Coder-30B"
}
```

### 5. Model Name Compatibility

**Codex Standard**:
```json
{
  "model": "gpt-4"
}
```

**Custom Model Name**:
```json
{
  "model": "Qwen3-Coder-30B"
}
```

**Question**: Does Codex verify model names against OpenAI's catalog?

**Answer**: [YES / NO]

**Finding**: [Details]

---

## Compatibility Matrix

### Supported Scenarios

| Scenario | Status | Notes |
|----------|--------|-------|
| Custom base_url | [✓/✗] | [Notes] |
| Custom API key | [✓/✗] | [Notes] |
| Custom model name | [✓/✗] | [Notes] |
| Streaming responses | [✓/✗] | [Notes] |
| Chat completions | [✓/✗] | [Notes] |
| Structured responses | [✓/✗] | [Notes] |
| Error handling | [✓/✗] | [Notes] |

### Direct Integration Supported?

**Result**: [YES / NO]

If YES:

```
Codex CLI
   ↓
Custom OpenAI-Compatible Endpoint
   ↓
RunPod GPU Worker
   ↓
Qwen3-Coder-30B
```

If NO:

```
Codex CLI (unchanged)
   ↓
[Requires Adapter/Gateway]
   ↓
Custom OpenAI-Compatible Endpoint
   ↓
RunPod GPU Worker
   ↓
Qwen3-Coder-30B
```

---

## Configuration Instructions

### If Direct Integration Supported

**Step 1: Get GPU Worker URL**

```bash
# From RunPod dashboard
POD_ID=...
WORKER_URL=https://${POD_ID}.runpod.net/v1
API_KEY=... # Set at runtime
```

**Step 2: Configure Codex**

Option A: Environment Variables
```bash
export CODEX_API_BASE_URL="${WORKER_URL}"
export CODEX_API_KEY="${API_KEY}"
export CODEX_MODEL="Qwen3-Coder-30B"

codex "your prompt"
```

Option B: Configuration File
```json
{
  ".codex/config.json":
  {
    "api_base_url": "https://[pod-id].runpod.net/v1",
    "api_key": "[API_KEY]",
    "model": "Qwen3-Coder-30B",
    "temperature": 0.7,
    "max_tokens": 2048
  }
}
```

Option C: Command Line
```bash
codex \
  --api-base-url=https://[pod-id].runpod.net/v1 \
  --api-key=[API_KEY] \
  --model=Qwen3-Coder-30B \
  "your prompt"
```

**Step 3: Verify Connection**

```bash
codex --health-check
# or
codex "echo hello"
```

### If Direct Integration NOT Supported

**Requirement**: Build adapter/gateway

See `infra/codex-adapter/` for implementation.

**Architecture**:

```
Codex CLI
   │
   ├─ connects to standard OpenAI URL
   ├─ localhost:9000 (adapter on Codespace)
   │
Adapter/Gateway (on Codespace)
   │
   ├─ translates standard OpenAI calls
   ├─ connects to RunPod worker
   │
RunPod GPU Worker
   │
Qwen3-Coder-30B
```

---

## Testing

### Test 1: Direct Connection

```bash
# From Codespace, test endpoint directly
curl -X POST https://[pod-id].runpod.net/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: ******" \
  -d '{
    "model": "Qwen3-Coder-30B",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 100
  }'
```

**Expected**: 200 OK with chat response

### Test 2: Codex Integration

```bash
# Test Codex with custom endpoint
codex "What is 2+2?"
```

**Expected**: Codex returns response from Qwen3, not OpenAI

### Test 3: Full Workflow

```bash
# Complete test
codex --interactive
> Implement a simple HTTP server
> (Qwen3 generates code)
> (Review and accept)
```

**Expected**: Code is generated using Qwen3-Coder-30B

---

## Known Limitations

### If Directly Supported

[List any limitations found]

### If Adapter Required

[Architecture limitations]

---

## Authentication & Security

### API Key Management

- ✓ Never commit API keys
- ✓ Use environment variables only
- ✓ Rotate keys after evaluation
- ✓ Use least-privilege tokens

### HTTPS Requirement

- ✓ All connections must use HTTPS
- ✓ Certificate validation required
- ✓ No self-signed certs in production

### Logging

- ✓ No prompts logged locally
- ✓ No API keys in logs
- ✓ GPU worker logs sanitized

---

## Comparison: OpenAI vs Custom Endpoint

| Aspect | OpenAI | Custom Qwen3 | Impact |
|--------|--------|-------------|--------|
| **Availability** | Always on | On-demand | Startup time |
| **Cost** | $0.01-0.03/1K tokens | $0.013/task | 5-10x cheaper |
| **Latency** | ~500ms | ~150ms TTFT | Faster |
| **Model** | GPT-4/3.5 | Qwen3-Coder | Different capabilities |
| **Privacy** | Remote | On your GPU | No data sent to OpenAI |

---

## Fallback Strategy

If custom endpoint is problematic:

**Option A**: Use adapter/gateway (build PR4a)

**Option B**: Use environment variable switching
```bash
# Use custom model
AI_BASE_URL=https://pod.runpod.net/v1 codex "prompt"

# Fallback to OpenAI
unset AI_BASE_URL
codex "prompt"  # Uses OpenAI
```

**Option C**: Codex remains on OpenAI (PR3 doesn't integrate)
- Qwen3 available separately via `scripts/ai-test`
- Integration deferred to PR4
- Full qualification still achieved

---

## Recommendation

### Direct Integration Available?

[YES / NO]

### Suggested Path Forward

**If YES**:
```
PR3 Complete ✓
↓
PR4 — Codex Integration (simple config docs)
↓
Ready for production use
```

**If NO**:
```
PR3 Complete ✓ (Qwen3 qualified)
↓
PR4a — Build Codex Adapter
↓
PR4 — Codex Integration
↓
Ready for production use
```

### Cost Impact

Using custom endpoint through Codex:
- Saves **[X]%** on typical coding workflows
- Break-even at **[N] requests** per session
- Typical session costs **$[X]** vs **$[XX]** with OpenAI

---

## Implementation Notes

### For PR3 Completion

This investigation proves:
- ✓ GPU worker is operational
- ✓ OpenAI-compatible API works
- ✓ `scripts/ai-test` works with custom endpoint
- ✓ Codex compatibility status documented

Model qualification is **independent** of Codex integration.

### For PR4

If integration is supported: Document exact configuration.

If integration requires adapter: Build adapter in PR4a, then proceed to PR4.

---

## Appendix: Codex Version & Configuration

### Version Info

```
$ codex --version
Codex v[VERSION]

$ codex config --list
api_key: [set]
model: gpt-4
temperature: 0.7
max_tokens: 2048
```

### Environment Variables

```bash
# Codex supports these env vars:
CODEX_API_KEY
CODEX_API_BASE_URL         # If supported
CODEX_MODEL
CODEX_TEMPERATURE
CODEX_MAX_TOKENS
```

### References

- Codex documentation: [URL]
- OpenAI API docs: https://platform.openai.com/docs
- Custom provider docs: [URL]

---

## Investigation Completed

**Date**: [Date]
**Investigator**: [Name]
**Status**: [Ready for integration / Requires adapter / Not supported]
