#requires -Version 7.0
# Production build + local preview
Set-StrictMode -Version Latest; $ErrorActionPreference = "Stop"
corepack enable; corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
pnpm run game:validate; pnpm run content:validate; pnpm run assets:validate
pnpm typecheck; pnpm lint; pnpm test
pnpm build -- --mode production
pnpm exec vite preview --host 127.0.0.1 --port 5173
