.PHONY: setup dev backend frontend health verify verify-offline

setup:
	python3 -m venv backend/.venv
	cd frontend && npm install

dev:
	./shell/dev-backend.sh & \
	./shell/dev-frontend.sh & \
	wait

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
