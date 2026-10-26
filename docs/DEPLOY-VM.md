# Self-hosted Cloud Play on a VM

This is the runbook for putting the portal on your own Ubuntu server behind HTTPS.
GitHub Pages already publishes the same generated site at
<https://onegayunicorn.github.io/gameforge-portal/>; the VM adds an owner-controlled
origin, a stable domain, and a runtime endpoint you can extend.

## What actually runs

```text
client ──HTTPS──▶ nginx :443
                    ├── /              static files from  <repo>/pwa/      (installable site)
                    ├── /cloud/        static files from  <repo>/pwa/cloud/ (Cloud Play library)
                    └── /api/     ──▶  node :4173   scripts/serve-public.js  (GET /api/runtime)
```

Three properties of this repository drive that shape:

| Fact | Consequence |
|---|---|
| `scripts/serve.js` serves `portalDir: portal/` only | Proxying everything to Node serves the *shell*, not the installable app. `manifest.webmanifest`, `sw.js` and `offline.html` live in the generated `pwa/` tree. nginx serves `pwa/` and proxies only `/api/`. |
| `npm run serve:public` = `npm run studio:build && node …` | Starting the service through npm means a build on every boot. The unit runs `node scripts/serve-public.js` directly; the build happens at deploy time. |
| `scripts/build-studio.js` needs `esbuild` and reads `@mlc-ai/web-llm` + `loglevel`, all devDependencies | A production install cannot omit dev dependencies. `npm ci --omit=dev` produces a service that cannot start. |

## Prerequisites

- Ubuntu 24.04 LTS, 2 vCPU / 8 GB RAM / ~40 GB disk (the node_modules tree is large).
- A DNS `A` record (and `AAAA` if you have IPv6) for the hostname, pointing at the VM.
  Use a subdomain; a bare IP cannot carry a certificate and cannot trigger the PWA install prompt.
- Inbound 22, 80, 443 open **both** in the VM firewall and in the provider's cloud firewall.
- Node 22 is required by `engines` (`>=22.0.0 <23`). Node 20 fails `npm ci` engine checks
  and is not what CI uses.

## Runbook

```bash
# 1. As root on the VM: Node 22, nginx, certbot, ffmpeg, swap, firewall
sudo bash infra/provision.sh
```

```bash
# 2. As the deploy user: clone and install dependencies
sudo mkdir -p /srv/gameforge && sudo chown "$USER:$USER" /srv/gameforge
git clone https://github.com/onegayunicorn/gameforge-portal.git /srv/gameforge/gameforge-portal
cd /srv/gameforge/gameforge-portal
cp .env.example .env
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci
npm run pwa:build
```

`npm run pwa:build` is mandatory before the first start: it writes `pwa/` (the site nginx
serves) and the AI Studio worker bundle. On Linux it rasterises the PWA icons with `ffmpeg`,
which is why that package is in `provision.sh`.

```bash
# 3. Install the unit, the sudoers rule and the HTTP-only bootstrap vhost
sudo DOMAIN=cloud.example.com SERVICE_USER="$USER" bash infra/install-service.sh
```

```bash
# 4. Issue the certificate (phase 2), then swap to HTTPS (phase 3)
sudo DOMAIN=cloud.example.com EMAIL=you@example.com bash infra/request-cert.sh
sudo DOMAIN=cloud.example.com bash infra/enable-tls.sh
```

`enable-tls.sh` calls `request-cert.sh` itself, so step 4 can also be a single command.
Running the phases separately is worth it once: it proves DNS and port 80 reachability
before any vhost is replaced, and it keeps the certificate when the swap is retried.

Step 3 installs an HTTP-only vhost on purpose. A vhost that references
`/etc/letsencrypt/live/<domain>/fullchain.pem` before the certificate exists makes
`nginx -t` fail, and `certbot --nginx` then cannot repair it — the certificate can never
be issued. The bootstrap file breaks that cycle: port 80 answers the HTTP-01 challenge,
then `enable-tls.sh` swaps in the TLS vhost.

## Continuous deployment

`.github/workflows/deploy-vm.yml` runs on every push to `main`.

| Secret | Value |
|---|---|
| `VM_SSH_KEY` | private key; its public half in `~deploy/.ssh/authorized_keys` on the VM |
| `VM_HOST` | hostname or IP |
| `VM_USER` | deploy user (must match the sudoers rule installed in step 3) |

| Variable (optional) | Value |
|---|---|
| `DEPLOY_VM_ENABLED` | `true` to arm the workflow; unset (or any other value) skips the job |
| `VM_APP_DIR` | defaults to `/srv/gameforge/gameforge-portal` |
| `VM_PUBLIC_URL` | e.g. `https://cloud.example.com`; enables the post-deploy smoke check |

The job is gated on `DEPLOY_VM_ENABLED` so that pushing this workflow before the host
exists shows *skipped*, not *failed*. It also means a typo in a secret cannot turn into a
red build on an unrelated commit.

The workflow copies `origin/main:scripts/deploy-vm.sh` to `/tmp` before resetting the
checkout, so bash never reads a script that the reset is rewriting. The deploy script
builds, restarts, health-checks `127.0.0.1:4173/api/runtime`, and rolls back to the
previous commit if the new one does not come up.

Manual deploy is the same script:

```bash
bash scripts/deploy-vm.sh
```

## Operations

```bash
systemctl status gameforge            # service state
journalctl -u gameforge -n 100 -f     # server log
tail -f /srv/gameforge/deploy.log     # deploy history with commit ids
sudo bash scripts/backup.sh           # .env + catalogue + nginx/systemd config
```

Backups cover only what git cannot reproduce. The shipped catalogue is committed; saved
games and launch counts live in each visitor's browser, not on the server.

Restore is a file copy back to the original paths:

```bash
mkdir /tmp/restore && tar -xzf /srv/gameforge/backups/gameforge-backup-<stamp>.tar.gz -C /tmp/restore
# then move each file back: env -> /srv/gameforge/gameforge-portal/.env, nginx/* -> /etc/nginx/...,
# systemd/* -> /etc/systemd/system/, then: sudo systemctl daemon-reload && sudo nginx -t && sudo systemctl reload nginx
```

## Verifying the install

1. `curl -sS https://cloud.example.com/api/runtime` returns JSON containing `"mode": "browser"`.
2. `curl -sSI https://cloud.example.com/manifest.webmanifest` returns
   `content-type: application/manifest+json`.
3. Load the site in Chrome, DevTools → Application: the manifest parses, the service
   worker is *activated and controlling*, and the cache `gameforge-pwa-<hash>` is populated.
4. On Android Chrome the install card and the tab-bar Install button appear. On iOS Safari
   there is no `beforeinstallprompt`; the card offers "Show me how" for Share → Add to Home Screen.
5. Toggle offline and reload: the document and index render from cache.

## Deliberate choices

- **No `Content-Security-Policy` header from nginx.** The pages ship their own CSP in a
  `<meta>` tag; a second policy is enforced *in addition to* the first, and a stricter
  header would break the AI Studio worker.
- **`HOST=127.0.0.1`.** `serve-public.js` defaults to `0.0.0.0`; binding loopback keeps the
  Node process reachable only through nginx.
- **`Restart=always`, not `on-failure`.** A clean exit is still an outage for a public site.
- **No PM2 / global npm packages.** systemd is already the supervisor.
- **`ffmpeg` and `unattended-upgrades` are installed**, because the PWA build needs the
  former and a public host needs the latter.
- **`.gitattributes` pins `eol=lf` for shell scripts.** A Windows checkout with
  `core.autocrlf=true` otherwise produces `bad interpreter: /usr/bin/env: no such file`.
