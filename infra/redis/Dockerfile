FROM node:22-alpine
RUN apk add --no-cache redis
EXPOSE 6379
CMD ["redis-server", "--protected-mode", "no", "--appendonly", "yes", "--loglevel", "notice"]
