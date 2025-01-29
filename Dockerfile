# Use Node.js LTS as base image
FROM node:20-slim

# Build argument for gakuon version
ARG GAKUON_VERSION=latest

# Install ffmpeg for ffplay
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install specific gakuon version globally
RUN npm install -g gakuon@${GAKUON_VERSION}

# Set working directory
WORKDIR /app

# Set entrypoint to gakuon
ENTRYPOINT ["gakuon"]

# Default command (can be overridden)
CMD ["--help"]
