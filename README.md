# Personal Cloud Development Environment

A reusable development environment for projects running in GitHub Codespaces.

Includes:

- reproducible development container
- Codex CLI
- Node.js
- Python
- Rust
- GitHub CLI
- Docker CLI
- standardized development commands
- CI

Open this repository in Codespaces and start building.

## Use as a template

In GitHub repository settings, enable **Template repository** to make this reusable for new projects.


## Codex (primary AI agent)

Run:

```bash
codex
```

Authenticate at runtime using the Codex-supported login flow. Do not bake API keys into the image or repository.

Default usage should remain approval-oriented (Suggest mode). Configure more autonomous modes only when explicitly needed.
