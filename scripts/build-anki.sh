#!/bin/bash

# Build for both architectures
# docker buildx build \
#   --platform linux/amd64,linux/arm64 \
#   --tag gakuon-headless-anki:local \
#   --file Dockerfile.headless-anki \
#   .

# Build only for current architecture (faster for testing)
docker build \
  --tag gakuon-headless-anki:local \
  --file Dockerfile.headless-anki \
  .
