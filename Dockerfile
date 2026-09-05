FROM node:20-alpine

RUN apk add --no-cache unzip

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY public ./public
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
RUN mkdir -p data/covers/collections games

ENV PORT=4000
EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server/index.js"]
