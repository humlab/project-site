#!/usr/bin/env bash
# Build and run the showcase static site in a maximally locked-down container.
# The site itself is built inside the Containerfile (node + cwebp live in the build
# stage), so this script needs only podman - it works the same on a laptop and a
# build server, and is what a quadlet would do at `podman build` time.
# Demo only - the real deployment runs quadlets, this script is for local testing.
# Run from the repo root: deploy/sample-run.sh
set -euo pipefail

NAME=showcase-static
IMAGE=localhost/showcase_static
PORT=9712

cd "$(dirname "$0")/.."

podman build -f deploy/Containerfile -t "$IMAGE" .

podman rm -f "$NAME" 2>/dev/null || true

podman run -d \
  --name "$NAME" \
  --replace \
  --rm \
  --read-only \
  --cap-drop=all \
  --security-opt=no-new-privileges \
  --user 65534:65534 \
  --pids-limit=32 \
  --memory=64m \
  --memory-swap=64m \
  --cpus=0.5 \
  --ulimit nofile=128:128 \
  --cgroups=split \
  -p 127.0.0.1:$PORT:8080 \
  "$IMAGE"

echo "serving at http://127.0.0.1:$PORT/"
