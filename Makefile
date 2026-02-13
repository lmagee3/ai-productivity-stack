.PHONY: setup dev backend frontend health verify verify-offline all one down status qa

setup:
	python3 -m venv backend/.venv
	cd frontend && npm install

dev:
	./shell/dev-backend.sh & \
	./shell/dev-frontend.sh & \
	wait

all:
	./shell/dev-all.sh

one:
	./shell/dev-one.sh

backend:
	./shell/dev-backend.sh

frontend:
	./shell/dev-frontend.sh

health:
	./shell/healthcheck.sh

verify:
	./shell/verify.sh

verify-offline:
	./shell/verify.sh

down:
	lsof -ti tcp:8000 | xargs kill -9 2>/dev/null || true
	lsof -ti tcp:5173 | xargs kill -9 2>/dev/null || true
	lsof -ti tcp:5174 | xargs kill -9 2>/dev/null || true
	lsof -ti tcp:5175 | xargs kill -9 2>/dev/null || true

status:
	./shell/status.sh

qa:
	./shell/qa.sh
