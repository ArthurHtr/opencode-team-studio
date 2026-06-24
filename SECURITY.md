# Security

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue in OpenCode Team Studio, please use **GitHub Private Vulnerability Reporting**.

### How to report

1. Go to the [Security advisory page](https://github.com/ArthurHtr/opencode-team-studio/security/advisories/new)
2. Describe the vulnerability
3. Include steps to reproduce (preferably with a demo config, not your real config)
4. Do **not** include real secrets, API keys, or personal data

### What to include

- Version of OpenCode Team Studio
- Installation method (Docker, from source)
- Operating system and Docker version
- Steps to reproduce
- Expected vs actual behavior
- Sanitized logs (no secrets)

### What to never publish

- Your real OpenCode configuration
- API keys, tokens, or credentials
- Personal data or internal network details
- Exploit code that could be misused

### Response timeline

We aim to acknowledge security reports within 7 business days and provide regular updates as we work toward a fix.

### Coordinated disclosure

We follow coordinated disclosure practices:

1. We validate the reported vulnerability
2. We develop and test a fix
3. We publish a patch release
4. We publish the security advisory (after the fix is widely available)

## Supported Versions

Only the latest release receives security updates. Previous versions are not retroactively patched.

| Version | Status |
|---------|--------|
| 0.1.0-alpha.1 | Current — receives security updates |
| Previous alpha versions | End of life |

## Known Risk Areas

See [docs/SECURITY_MODEL.md](./docs/SECURITY_MODEL.md) for a detailed security model including:

- Path traversal prevention
- Filesystem access boundaries
- Secret management
- Network exposure controls
- Backup safety
- Symlink and race condition handling
