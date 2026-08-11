# Personal Cloud Development Environment

A reusable development environment for local and GitHub Codespaces development.

Includes:

- reproducible development container (Codespaces)
- local development setup guide
- Codex CLI
- Node.js
- Python
- Rust
- GitHub CLI
- Docker CLI
- standardized development commands
- CI

## Quick Start

### Local Development

For local development on your machine, see [LOCAL_SETUP.md](LOCAL_SETUP.md) for detailed prerequisites and setup instructions.

```bash
git clone https://github.com/rkendel1/station.git
cd station
npm install
cp .env.example .env.local
make check
make dev
```

### GitHub Codespaces

For a fully managed environment without local setup:

1. Click "Code" → "Codespaces" → "Create codespace on main" on the [GitHub repository](https://github.com/rkendel1/station)
2. Wait for the container to build (2-3 minutes)
3. Run `make check` to verify setup
4. Start developing with `make dev`

All dependencies and tools are pre-installed in the Codespaces container.

## Use as a template

In GitHub repository settings, enable **Template repository** to make this reusable for new projects.


## Codex (primary AI agent)

Run:

```bash
codex
```

Authenticate at runtime using the Codex-supported login flow. Do not bake API keys into the image or repository.

Default usage should remain approval-oriented (Suggest mode). Configure more autonomous modes only when explicitly needed.
