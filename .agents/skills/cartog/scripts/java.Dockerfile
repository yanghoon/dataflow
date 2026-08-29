# Java LSP Server using Eclipse JDTLS
FROM eclipse-temurin:21-jdk

# Install dependencies including socat for TCP exposing
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 ca-certificates wget socat \
    && rm -rf /var/lib/apt/lists/*

# Install JDTLS
ARG JDTLS_VERSION=1.43.0
RUN base="https://download.eclipse.org/jdtls/milestones/${JDTLS_VERSION}" \
    && tarball="$(wget -qO- "${base}/latest.txt")" \
    && mkdir -p /opt/jdtls \
    && wget -qO /tmp/jdtls.tar.gz "${base}/${tarball}" \
    && tar -xzf /tmp/jdtls.tar.gz -C /opt/jdtls \
    && rm /tmp/jdtls.tar.gz \
    && ln -s /opt/jdtls/bin/jdtls /usr/local/bin/jdtls

ENV HOME=/tmp
RUN mkdir -p /tmp/.cache/jdtls && chmod -R 0777 /tmp/.cache

# Expose over TCP port 5000 using socat
CMD ["socat", "TCP-LISTEN:5000,fork,reuseaddr", "EXEC:jdtls"]
