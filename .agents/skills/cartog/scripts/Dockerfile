# Lightweight Linux base image with modern glibc (requires 2.39+)
FROM ubuntu:24.04

# Install core dependencies (curl, ca-certificates) and any tools needed for runtime
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Detect architecture and install the corresponding cartog binary
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then \
        TARGET="aarch64-unknown-linux-gnu"; \
    else \
        TARGET="x86_64-unknown-linux-gnu"; \
    fi && \
    curl -fsSL "https://github.com/jrollin/cartog/releases/latest/download/cartog-${TARGET}.tar.gz" -o cartog.tar.gz && \
    tar -xzf cartog.tar.gz && \
    mv cartog /usr/local/bin/cartog && \
    chmod +x /usr/local/bin/cartog && \
    rm cartog.tar.gz

# Set working directory to where the code will be mounted
WORKDIR /workspace
