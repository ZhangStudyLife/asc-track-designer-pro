#!/bin/bash

# ASC Track Designer Build Script for Linux

set -e

echo "============================================"
echo "  ASC Track Designer - Build Process"
echo "============================================"
echo

# 1. Build frontend
echo "[1/3] Building frontend..."
cd web

if [ ! -d "node_modules" ]; then
    echo "  [*] Installing frontend dependencies..."
    npm install
fi

echo "  [*] Compiling frontend..."
npm run build
echo "  [√] Frontend build complete"
cd ..

# 2. Build backend
echo
echo "[2/3] Building backend..."
echo "  [*] Compiling Go binary..."
go build -ldflags="-s -w" -o trackd cmd/trackd/main.go
echo "  [√] Backend build complete"

# 3. Done
echo
echo "[3/3] Build complete!"
echo
echo "============================================"
echo "  Generated files:"
echo "  - trackd (single binary server)"
echo
echo "  Usage:"
echo "  ./trackd --port 8080"
echo "============================================"
