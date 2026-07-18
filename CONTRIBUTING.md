# Contributing to GLPI Asset Management Enhancement Platform

Thank you for your interest in contributing to this project.

We welcome contributions that improve functionality, fix bugs, enhance documentation, or improve code quality.

---

## Development Workflow

This project follows a Git branching strategy.

- `main` → Stable production-ready code
- `develop` → Active development
- `feature/<feature-name>` → New features
- `bugfix/<bug-name>` → Bug fixes
- `hotfix/<issue-name>` → Production fixes

Never develop directly on the `main` branch.

---

## Getting Started

1. Fork the repository.
2. Clone your fork.
3. Checkout the `develop` branch.
4. Create a new feature branch.

Example:

```bash
git checkout develop
git checkout -b feature/new-feature

```

---

## Commit Messages

Use clear and descriptive commit messages.

Examples:

```text
feat: add asset QR code generation
fix: resolve login validation issue
docs: update installation guide
refactor: improve API service structure
```

---

## Coding Standards

- Write clean and readable code.
- Follow PSR standards for PHP.
- Keep functions small and reusable.
- Add comments where necessary.
- Avoid duplicated code.

---

## Pull Requests

Before opening a Pull Request:

- Ensure your branch is up to date.
- Test your changes.
- Update documentation if necessary.
- Keep Pull Requests focused on one feature.

---

Thank you for helping improve this project.
