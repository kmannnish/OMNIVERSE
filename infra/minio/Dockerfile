FROM node:22-alpine
RUN apk add --no-cache curl ca-certificates && \
    curl -fSL -o /usr/local/bin/minio https://dl.min.io/server/minio/release/linux-amd64/minio && \
    chmod +x /usr/local/bin/minio
RUN mkdir -p /data
EXPOSE 9000 9001
CMD ["minio", "server", "/data", "--console-address", ":9001"]
