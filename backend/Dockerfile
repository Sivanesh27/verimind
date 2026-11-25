# VeriMind API — container image (used by the free Hugging Face Space; works on any Docker host).
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=7860 \
    LLM_PROVIDER=local \
    LLM_GPU=false \
    LLM_MODEL_PATH=/home/node/models/LLM.gguf

WORKDIR /home/node/app

# Install dependencies first for better layer caching (node-llama-cpp ships prebuilt Linux binaries).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Hugging Face runs containers as uid 1000, which is the "node" user in this image.
RUN mkdir -p /home/node/models && chown -R node:node /home/node
USER node

EXPOSE 7860
CMD ["node", "src/server.js"]
