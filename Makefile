# Makefile for ASC Track Designer

.PHONY: all build clean run test install dev

# Default target
all: build

# Install dependencies
install:
	cd web && npm install
	go mod download

# Build frontend
build-frontend:
	cd web && npm run build

# Build backend
build-backend: build-frontend
	go build -ldflags="-s -w" -o trackd cmd/trackd/main.go

# Build all
build: build-backend

# Run in development mode
dev:
	cd web && npm run dev &
	go run cmd/trackd/main.go

# Run production binary
run:
	./trackd --port 8080

# Clean build artifacts
clean:
	rm -rf web/dist
	rm -rf cmd/trackd/dist
	rm -f trackd trackd.exe
	rm -rf data/*.db

# Run tests
test:
	go test -v ./...

# Build for multiple platforms
build-all:
	GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o trackd-windows-amd64.exe cmd/trackd/main.go
	GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o trackd-linux-amd64 cmd/trackd/main.go
	GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o trackd-darwin-amd64 cmd/trackd/main.go
	GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o trackd-darwin-arm64 cmd/trackd/main.go

# Docker build
docker-build:
	docker build -t asc-track-designer .

# Docker run
docker-run:
	docker run -d -p 8080:8080 -v $(PWD)/data:/root/data --name trackd asc-track-designer
