# GPU Worker with vLLM
# OpenAI-compatible inference API for Qwen3-Coder 30B

FROM nvidia/cuda:12.1.1-devel-ubuntu22.04

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3.10-dev \
    python3.10-venv \
    python3-pip \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Ensure python3 is python3.10
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.10 1

# Create Python virtual environment
RUN python3 -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"

# Upgrade pip
RUN pip install --upgrade pip setuptools wheel

# Install vLLM and dependencies
# Pin versions for reproducibility
RUN pip install \
    vllm==0.4.3 \
    fastapi==0.104.1 \
    uvicorn==0.24.0 \
    pydantic==2.5.0 \
    pydantic-settings==2.1.0 \
    python-dotenv==1.0.0 \
    pyjwt==2.8.1 \
    transformers==4.36.0 \
    torch==2.1.1 \
    uvloop==0.19.0

# Copy application code
COPY worker.py /app/worker.py
COPY config /app/config
COPY scripts /app/scripts

# Make scripts executable
RUN chmod +x /app/scripts/start /app/scripts/health /app/scripts/stop

# Create non-root user for security
RUN useradd -m -u 1000 worker && \
    chown -R worker:worker /app

USER worker

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD /app/scripts/health

# Default command
CMD ["/app/scripts/start"]
