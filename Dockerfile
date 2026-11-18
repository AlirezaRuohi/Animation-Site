FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 python3-pil ffmpeg fonts-noto-core fonts-dejavu-core ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY renderer ./renderer
RUN mkdir -p /data && chown node:node /data
ENV PORT=8787 DATA_DIR=/data PYTHONUNBUFFERED=1
VOLUME /data
EXPOSE 8787
USER node
CMD ["node", "src/server.js"]
