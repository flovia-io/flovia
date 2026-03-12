# ──────────────────────────────────────────────────────────
# flovia CLI — Docker image
#
# Build:
#   docker build -t flovia .
#
# Run with local Ollama (macOS Docker Desktop):
#   docker run --rm -it \
#     --add-host=host.docker.internal:host-gateway \
#     -v $(pwd):/workspace \
#     flovia agent -w /workspace \
#       --base-url http://host.docker.internal:11434/v1 \
#       --model gpt-oss:120b-cloud \
#       "your prompt here"
#
# Run with local Ollama (Linux — host networking):
#   docker run --rm -it --network host \
#     -v $(pwd):/workspace \
#     flovia agent -w /workspace \
#       --base-url http://localhost:11434/v1 \
#       --model gpt-oss:120b-cloud \
#       "your prompt here"
#
# Run with OpenAI / remote provider:
#   docker run --rm -it \
#     -e OPENAI_API_KEY="sk-..." \
#     -v $(pwd):/workspace \
#     flovia agent -w /workspace --base-url https://api.openai.com/v1 "your prompt"
#
# Embed workspace at build time:
#   docker build -t flovia-project --build-arg EMBED_WORKSPACE=./my-project .
#   docker run --rm -it \
#     --add-host=host.docker.internal:host-gateway \
#     flovia-project agent -w /workspace \
#       --base-url http://host.docker.internal:11434/v1 \
#       --model gpt-oss:120b-cloud \
#       "add tests"
# ──────────────────────────────────────────────────────────

FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy source
COPY tsconfig.json ./
COPY core/ ./core/
COPY main/ ./main/
COPY cli/ ./cli/
COPY connectors/ ./connectors/
COPY server/ ./server/

# Build CLI (compiles TypeScript → dist-cli/)
RUN npx tsc --project cli/tsconfig.json
# Build main (needed for shared modules in dist-main/)
RUN npx tsc

# ──────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

WORKDIR /app

# Copy package manifests and install production deps only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled output from builder
COPY --from=builder /app/dist-cli/ ./dist-cli/
COPY --from=builder /app/dist-main/ ./dist-main/

# Create default data dir and workspace mount point
RUN mkdir -p /data /workspace
ENV FLOVIA_DATA_DIR=/data
VOLUME ["/workspace"]

# Optionally embed a workspace at build time
ARG EMBED_WORKSPACE=""
COPY ${EMBED_WORKSPACE:-.dockerignore} /workspace/

ENTRYPOINT ["node", "/app/dist-cli/cli/index.js"]
CMD ["--help"]
