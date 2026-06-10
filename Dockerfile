# ---- build stage: compile the Vite frontend ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime stage: Express serving API + static dist ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV SERVER_PORT=8787
ENV CLAUDE_DIR=/data/.claude

# tzdata so the TZ env var (day bucketing) works on alpine.
RUN apk add --no-cache tzdata

# Install prod deps + tsx (server runs TypeScript directly).
COPY package*.json ./
RUN npm ci --omit=dev && npm install tsx@^4 && npm cache clean --force

# App code + built frontend.
COPY server ./server
COPY tsconfig.json ./
COPY --from=build /app/dist ./dist

EXPOSE 8787
CMD ["npx", "tsx", "server/index.ts"]
