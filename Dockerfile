# Use Node.js LTS as base image
FROM node:20-slim

# Build argument for gakuon version
ARG GAKUON_VERSION=latest

# Install ffmpeg for ffplay
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create config directory
RUN mkdir -p /root/.gakuon

# Copy default config
COPY config/default-config.toml /root/.gakuon/config.toml

# Install specific gakuon version globally
RUN npm install -g gakuon@${GAKUON_VERSION}

# Set working directory
WORKDIR /app

# Create volume for persistent config
VOLUME ["/root/.gakuon"]

# Set entrypoint to gakuon
ENTRYPOINT ["gakuon"]

# Default command (can be overridden)
CMD ["--help"]
