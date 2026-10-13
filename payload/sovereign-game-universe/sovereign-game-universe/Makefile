.PHONY: setup build test lint package deploy-staging deploy-production rollback clean
setup:
	corepack enable && pnpm install --frozen-lockfile
build:
	pnpm run build
test:
	pnpm run test
lint:
	pnpm run lint
package:
	pnpm --filter @ugb/builder-cli exec ugb package
deploy-staging:
	bash scripts/deploy-staging.sh
deploy-production:
	bash scripts/deploy-production.sh
rollback:
	bash scripts/rollback.sh
clean:
	rm -rf node_modules dist build release coverage
