# Security Policy

## Supported Versions

Security fixes are applied to the latest published minor release on npm.
Older releases do not receive backports while the project is on `0.x`.

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

Check your installed version with `kilo-ai-cli --version` and update via
`npm install -g kilo-ai-cli@latest`.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Report them privately through GitHub Security Advisories:

<https://github.com/ThePlenkov/kilo-ai-cli/security/advisories/new>

Include, where possible:

- The affected version (`kilo-ai-cli --version`) and OS
- Steps to reproduce or a proof of concept
- The impact you believe the issue has

### What to expect

- **Acknowledgement** within 72 hours
- **Initial assessment** within 7 days — accepted, declined, or needing
  more information
- **Status updates** at least every 14 days until resolution
- If accepted, a fix is released and the advisory is published with
  credit to the reporter (unless you prefer to stay anonymous)
- If declined, you get a written explanation of the reasoning

### Scope notes

`kilo-ai-cli` stores OAuth tokens in `~/.kilo/credentials.json` with
`0600` permissions and talks to `api.kilo.ai` over TLS. Issues worth
reporting include, for example:

- Token leakage into logs, stdout, or error output
- Credential files written with overly broad permissions
- Terminal/ANSI escape injection from server-supplied data
- Dependency vulnerabilities with a demonstrated impact on this CLI

Bugs in the Kilo.ai **service** itself (API, web app, cloud agents)
should be reported to Kilo directly, not to this repository.
