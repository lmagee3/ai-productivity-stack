.PHONY: dev backend frontend health

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
