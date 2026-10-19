#!/usr/bin/env bash
# Build and run the showcase static site in a maximally locked-down container.
# Requires: podman, cgroups v2 with delegation (default on Ubuntu/Debian rootless).
# Run from the repo root: deploy/run.sh
set -euo pipefail

NAME=showcase-static
IMAGE=localhost/showcase_static
PORT=9712

cd "$(dirname "$0")/.."

# dist/ is gitignored, so build it here; without this the image serves whatever stale
# tree happened to be on disk, or fails on a fresh clone.
node build.mjs || exit 1

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
