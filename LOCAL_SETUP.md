# Local Development Setup

This guide covers setting up the Station development environment on your local machine.

## Prerequisites

- **Node.js**: Version 18.0.0 or higher ([install](https://nodejs.org/))
- **Python**: Version 3.8 or higher (for GPU worker, optional)
- **Git**: For version control
- **Make**: For running standard commands

### macOS

```bash
# Using Homebrew
brew install node@20 python@3.11 git

# Verify installations
node --version    # Should be >= 18
python3 --version # Should be >= 3.8
git --version
which make        # Should exist
```

### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y nodejs npm python3 python3-pip git make

# Verify installations
node --version    # Should be >= 18
python3 --version # Should be >= 3.8
git --version
```

### Windows

- Install Node.js from https://nodejs.org/
- Install Python from https://www.python.org/
- Install Git from https://git-scm.com/
- Install Make: Use `winget install gnuwin32.make` or [GnuWin32](http://gnuwin32.sourceforge.net/)

## Project Setup

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/rkendel1/station.git
cd station

# Install Node packages in both workspaces
npm install

# This installs dependencies in root, ai/, and context/ packages
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env.local

# Edit with your values (API keys, model preferences)
# Use a text editor or:
nano .env.local
```

**Required environment variables:**
- `AI_PROVIDER`: Model provider (openai-compatible, openai, anthropic)
- `AI_BASE_URL`: API endpoint URL
- `AI_MODEL`: Model name to use
- `AI_API_KEY`: API authentication key

See `.env.example` for all available options.

### 3. Verify Installation

```bash
# Run the check command to verify everything
make check

# This runs: lint, type-check, and tests
```

## Development Workflow

### Start Development

```bash
# Watch mode (auto-recompile TypeScript) - runs both packages
make dev

# Or run in a specific package:
cd ai && npm run dev
cd ../context && npm run dev
```

### Run Tests

```bash
# Run all tests (CI mode - non-interactive)
make test

# Run tests in watch mode
npm run test:watch

# Run tests in a specific package
cd context && npm test        # watch mode
cd context && npm run test:ci # CI mode
```

### Type Checking

```bash
# Check TypeScript types in all packages
make typecheck

# Type check a specific package
cd ai && npm run type-check
```

### Linting

```bash
# Check code style in all packages
make lint

# Lint a specific package
cd context && npm run lint
```

### Build

```bash
# Compile TypeScript to JavaScript (both packages, proper order)
make build

# Or build individually
cd context && npm run build
cd ai && npm run build
```

### Full Verification

```bash
# Run build, lint, typecheck, and tests
make check
```

## Codex AI Agent

The Codex CLI is the primary AI agent for this project:

```bash
# Install Codex CLI globally
npm install -g @openai/codex

# Start Codex
codex

# Or use the ai package directly
cd ai && npm run dev
```

Authenticate using the Codex login flow at runtime (no hardcoded API keys).

## GPU Worker (Optional)

For local testing of GPU inference:

### 1. Start Ollama (Local LLM Server)

```bash
# Install Ollama from https://ollama.ai/
# Then pull a model:
ollama pull qwen:30b-chat

# Start Ollama server (runs on localhost:11434)
ollama serve
```

### 2. Configure Environment

```bash
# In .env.local:
AI_PROVIDER=openai-compatible
AI_BASE_URL=http://localhost:11434/api/v1
AI_MODEL=qwen:30b-chat
```

### 3. Test GPU Worker

```bash
./scripts/test-gpu
```

For production GPU deployment, see [docs/GPU_WORKER.md](docs/GPU_WORKER.md).

## Troubleshooting

### Node modules not found

```bash
# Reinstall dependencies
rm -rf node_modules ai/node_modules context/node_modules
npm install
```

### TypeScript compilation errors

```bash
# Clean and rebuild
make clean
make build
```

### Port already in use

If `make dev` fails with port in use:
```bash
# Find and kill process on port 3000
lsof -i :3000
kill -9 <PID>
```

### Permission denied on scripts

```bash
# Make scripts executable
chmod +x scripts/*
```

## IDE Setup

### VS Code

Recommended extensions:
- ESLint
- Prettier
- TypeScript Vue Plugin
- Python (for GPU worker)

```bash
# VS Code should auto-install from .vscode/extensions.json
code .
```

## Next Steps

1. **Review documentation**: Check [DEVELOPMENT.md](docs/DEVELOPMENT.md) for workflow details
2. **AI router**: See [docs/AI_ROUTER.md](docs/AI_ROUTER.md) for model selection
3. **Context system**: See [context/README.md](context/README.md) for engineering context fabric
4. **GPU deployment**: See [docs/GPU_PROVIDER.md](docs/GPU_PROVIDER.md) for RunPod setup

## Codespaces Alternative

For a fully managed environment without local setup:

1. Go to https://github.com/rkendel1/station
2. Click "Code" → "Codespaces" → "Create codespace on main"
3. Wait for container to build (2-3 minutes)
4. Run `make check` to verify
5. Start developing with `make dev`

All dependencies and tools are pre-installed in the container.
