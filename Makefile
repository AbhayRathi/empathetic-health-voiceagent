.PHONY: help install dev build start test clean simulate ws-server docker-up docker-down

help: ## Show this help message
	@echo "Empathetic Health Voice Agent - Development Commands"
	@echo "===================================================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	npm install

dev: ## Start Next.js development server
	npm run dev

ws-server: ## Start WebSocket server for Twilio Media Streams
	node scripts/websocket-server.js

build: ## Build production bundle
	npm run build

start: ## Start production server
	npm start

type-check: ## Run TypeScript type checking
	npm run type-check

lint: ## Run linter (if configured)
	npm run lint || echo "Linter not configured"

simulate: ## Run Twilio call simulator (normal conversation)
	node scripts/simulate-call.js

simulate-red-flag: ## Run red flag detection scenario
	node scripts/simulate-call.js --red-flag

test: type-check ## Run all tests
	@echo "✓ Type checking passed"
	@echo "Tests would run here (not yet implemented)"

clean: ## Clean build artifacts
	rm -rf .next
	rm -rf node_modules
	rm -f tsconfig.tsbuildinfo

docker-up: ## Start all services with Docker Compose
	docker-compose up -d

docker-down: ## Stop all Docker Compose services
	docker-compose down

docker-logs: ## View Docker Compose logs
	docker-compose logs -f

docker-rebuild: ## Rebuild and restart Docker services
	docker-compose down
	docker-compose build
	docker-compose up -d

setup: install ## Initial setup (install + copy env)
	@if [ ! -f .env.local ]; then \
		cp .env.example .env.local; \
		echo "✓ Created .env.local from .env.example"; \
		echo "⚠️  Please edit .env.local with your API keys"; \
	else \
		echo "✓ .env.local already exists"; \
	fi

dev-full: ## Start Next.js dev server + WebSocket server
	@echo "Starting development servers..."
	@make -j2 dev ws-server

.DEFAULT_GOAL := help
