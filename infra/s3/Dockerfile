FROM node:22-alpine

WORKDIR /app

COPY package.json ./

RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-factor 2 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm config set fetch-retry-maxtimeout 60000 && \
    npm install --omit=dev

COPY server.mjs ./

EXPOSE 9000

ENV DATA_DIR=/data
ENV S3_BUCKET=media-storage

CMD ["node", "server.mjs"]
