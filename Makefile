.PHONY: test test-backend test-frontend lint lint-php lint-js compose-validate docker-up docker-down backup disk-guard help

## Main commands
help:
	@echo "GLPI Asset Dashboard - Available commands:"
	@echo "  make docker-up      Start all services"
	@echo "  make docker-down    Stop all services"
	@echo "  make compose-validate Validate compose.yml"
	@echo "  make lint           Lint all PHP and JS files"
	@echo "  make test           Run all tests (PHPUnit + Vitest)"
	@echo "  make backup         Run the backup script"
	@echo "  make disk-guard     Check disk usage and clean up"

## Docker
docker-up:
	docker compose up -d

docker-down:
	docker compose down

compose-validate:
	docker compose config >/dev/null 2>&1 && echo "compose.yml is valid" || echo "compose.yml has errors"

## Linting
lint: lint-php lint-js

lint-php:
	find glpi glpi-frontend -type f -name "*.php" -not -path "*/vendor/*" -print0 | xargs -0 -n1 php -l
	php -l glpi-router.php

lint-js:
	cd glpi-frontend && find . -name "*.js" -not -path "*/node_modules/*" -print0 | xargs -0 -n1 node --check

## Testing
test: test-backend test-frontend

test-backend:
	cd glpi-frontend && php vendor/bin/phpunit --no-coverage

test-frontend:
	cd glpi-frontend && npm test

## Operations
backup:
	bash scripts/backup.sh

disk-guard:
	bash scripts/disk-guard.sh --check
