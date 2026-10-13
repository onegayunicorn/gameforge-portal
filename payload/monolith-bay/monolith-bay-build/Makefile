install:
	pnpm install --frozen-lockfile
dev:
	pnpm dev
build:
	pnpm build
test:
	pnpm test
validate:
	pnpm validate:content
package:
	pnpm package
deploy-staging:
	./scripts/deploy-staging.sh
deploy-production:
	./scripts/deploy-production.sh
rollback:
	./scripts/rollback.sh
clean:
	pnpm clean

.PHONY: install dev build test validate package deploy-staging deploy-production rollback clean
