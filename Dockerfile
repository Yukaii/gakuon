# Use Node.js LTS as base image
FROM node:20-slim

# Install ffmpeg for ffplay
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install gakuon globally
RUN npm install -g gakuon

# Set working directory
WORKDIR /app

# Set entrypoint to gakuon
ENTRYPOINT ["gakuon"]

# Default command (can be overridden)
CMD ["--help"]
