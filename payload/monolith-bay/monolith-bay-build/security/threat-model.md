# Threat Model
## Assets
- Player save data
- Character import files
- Content manifests
- Release artifacts

## Threats
- Malicious character PNG import (mitigated: data-only sandbox, no script execution)
- Save file tampering (mitigated: checksums, version validation)
- Path traversal in asset loading (mitigated: path validation)
- XSS via imported content (mitigated: CSP, no inline scripts)
