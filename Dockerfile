FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV SERVER_PORT=8787

EXPOSE 8787

CMD ["npx", "tsx", "server/index.ts"]
