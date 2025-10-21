# Dockerfile for ASC Track Designer

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# Stage 2: Build backend
FROM golang:1.22-alpine AS backend-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend-builder /app/web/dist ./cmd/trackd/dist
RUN go build -ldflags="-s -w" -o trackd cmd/trackd/main.go

# Stage 3: Runtime
FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /root/

COPY --from=backend-builder /app/trackd .
RUN mkdir -p data/tracks data/exports

EXPOSE 8080

ENV PORT=8080
ENV DATA_DIR=/root/data

CMD ["./trackd"]
