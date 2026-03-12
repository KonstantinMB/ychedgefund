# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

**DO NOT** open a public issue for security vulnerabilities.

Please report security issues via [GitHub Security Advisories](https://github.com/KonstantinMB/atlas/security/advisories/new) or by emailing the repository maintainers through GitHub.

We will respond within 48 hours.

## Security Features

- **Password hashing**: PBKDF2 (100K iterations)
- **Session tokens**: Cryptographically random, 30-day expiry
- **API rate limiting**: Per-provider limits (Finnhub, etc.)
- **CORS**: Allowlist only (`api/_cors.ts`)
- **Environment variables**: Secrets in `.env` (never committed)
