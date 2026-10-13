#requires -Version 7.0
# Quick start — skip game/content/assets validation
Set-StrictMode -Version Latest; $ErrorActionPreference = "Stop"
corepack enable; corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
pnpm typecheck; pnpm lint; pnpm test; pnpm build; pnpm dev
