FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl ffmpeg && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp
WORKDIR /app
COPY container/package.json container/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY container/src ./src
EXPOSE 8080
CMD ["node", "src/server.ts"]
