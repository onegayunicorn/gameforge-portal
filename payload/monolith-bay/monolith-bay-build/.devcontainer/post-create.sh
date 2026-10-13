#!/usr/bin/env bash
set -e
pnpm install --frozen-lockfile
cp .env.example .env
echo "Dev container ready."
