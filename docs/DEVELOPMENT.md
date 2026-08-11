# Development

## Start

Open the repository in GitHub Codespaces. You can connect through the browser, VS Code, or GitHub CLI.

## Development

```bash
make dev
```

## Test

```bash
make test
```

## Full verification

```bash
make check
```

## AI coding

```bash
codex
```

## GPU Worker Testing

To test the GPU inference worker from Codespace:

1. Deploy the worker to RunPod or another GPU provider
2. Configure the endpoint:

```bash
export AI_BASE_URL=https://your-worker-endpoint.com/v1
export AI_API_KEY=<your-worker-api-key>
export AI_MODEL=Qwen3-Coder-30B
```

3. Run the smoke test:

```bash
./scripts/test-gpu
```

See `docs/GPU_WORKER.md` for full configuration and troubleshooting.

## Git

```bash
gh pr create
gh pr status
gh pr checkout
```

