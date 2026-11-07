FROM node:24-slim
ARG TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl ffmpeg unzip && rm -rf /var/lib/apt/lists/*
RUN name="yt-dlp_linux$([ "$TARGETARCH" = arm64 ] && echo _aarch64 || true)" \
 && curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/latest/download/$name.zip" -o /tmp/yt-dlp.zip \
 && mkdir /opt/yt-dlp && unzip -q /tmp/yt-dlp.zip -d /opt/yt-dlp && rm /tmp/yt-dlp.zip \
 && chmod +x "/opt/yt-dlp/$name" && ln -s "/opt/yt-dlp/$name" /usr/local/bin/yt-dlp && yt-dlp --version
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src ./src
ENV NODE_ENV=production DATA_PATH=/data/dj.db PORT=8080
USER node
EXPOSE 8080
CMD ["node", "src/main.ts"]
