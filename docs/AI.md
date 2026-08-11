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
