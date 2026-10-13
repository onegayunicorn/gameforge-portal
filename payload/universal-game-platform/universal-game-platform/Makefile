.PHONY: setup build test lint typecheck package deploy-staging deploy-production rollback clean
setup:
	./scripts/bootstrap.sh
build:
	pnpm run build --target webgl2
test:
	pnpm run test
lint:
	pnpm run lint
typecheck:
	pnpm run typecheck
package:
	pnpm exec ugb package --target webgl2
deploy-staging:
	./scripts/deploy-staging.ps1
deploy-production:
	./scripts/deploy-production.ps1
rollback:
	./scripts/rollback.ps1
clean:
	rm -rf node_modules dist build release
