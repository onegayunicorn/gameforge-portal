# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Development preview |

## Reporting a Vulnerability

Please report security vulnerabilities privately to the security team. Do not open public issues.

1. Email the security contact with a detailed description.
2. Include reproduction steps, affected versions, and impact assessment.
3. Expect an initial response within 72 hours.
4. We will coordinate disclosure and provide a timeline for fixes.

## Security Rules

- Never execute imported character or content files as code.
- Validate all asset paths; reject path traversal.
- Keep secrets out of the browser bundle.
- Default telemetry off unless consented.
- Redact personal data from logs.
- Validate save files and imported PNG metadata.
- Sign release manifests where applicable.
- Keep third-party licenses and notices.

See `security/threat-model.md` and `security/security-policy.md` for details.
