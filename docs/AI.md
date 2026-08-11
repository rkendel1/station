# AI Development Rules

1. Inspect the repository before modifying it.
2. Read relevant documentation before making architectural changes.
3. Prefer existing project patterns over introducing new abstractions.
4. Make the smallest change that satisfies the requirement.
5. Run the narrowest relevant tests after each meaningful change.
6. Run `make check` before declaring a task complete.
7. Never claim tests passed without actually running them.
8. Never modify secrets or credentials.
9. Never commit generated credentials or environment files.
10. Explain failures rather than hiding them.
11. Preserve backwards compatibility unless the task explicitly changes it.
12. Do not introduce dependencies without justification.

## GPU Worker Integration

PR2 introduces a cloud GPU inference worker for running Qwen3-Coder-30B.

### Configuration

Set these environment variables to use the remote GPU worker:

```bash
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://your-worker-endpoint.com/v1
AI_MODEL=Qwen3-Coder-30B
AI_API_KEY=<your-worker-api-key>
```

These should be set at runtime, **never committed to the repository**.

### Using with OpenAI-Compatible Clients

The GPU worker exposes OpenAI-compatible endpoints at `/v1/*`.

Example with Python:

```python
from openai import OpenAI
import os

client = OpenAI(
    api_key=os.environ["AI_API_KEY"],
    base_url=os.environ["AI_BASE_URL"]
)

response = client.chat.completions.create(
    model=os.environ["AI_MODEL"],
    messages=[
        {"role": "user", "content": "Explain this code..."}
    ],
    temperature=0.7,
    max_tokens=2048
)

print(response.choices[0].message.content)
```

### Testing the Worker

From the Codespace, run the smoke test:

```bash
export AI_BASE_URL=https://your-worker.example.com
export AI_API_KEY=<your-api-key>
export AI_MODEL=Qwen3-Coder-30B

./scripts/test-gpu
```

### Documentation

- See `docs/GPU_WORKER.md` for full API documentation
- See `docs/GPU_PROVIDER.md` for provider selection and setup
- See `docs/COST.md` for cost analysis
- See `benchmarks/coding/` for real-world usage examples

### Codex CLI Support

As of PR2, **Codex CLI does not support custom OpenAI-compatible endpoints**.

For direct API access from Codespace:

```bash
# Use curl or a client library
curl -H "Authorization: ******" \
     -X POST $AI_BASE_URL/chat/completions \
     -H "Content-Type: application/json" \
     -d '{...}'
```

Codex integration is planned for a follow-up PR.
