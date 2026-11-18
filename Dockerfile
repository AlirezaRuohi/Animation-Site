FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 python3-pil ffmpeg fonts-noto-core fonts-dejavu-core ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY renderer ./renderer
RUN mkdir -p /data && chown node:node /data
ENV PORT=8787 DATA_DIR=/data PYTHONUNBUFFERED=1 NODE_ENV=production
VOLUME /data
EXPOSE 8787
USER node
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
 CMD node -e 'fetch("http://127.0.0.1:8787/health").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'
CMD ["node", "src/server.js"]
