# ---- build stage: compile the Vite frontend ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Anonymous product analytics (PostHog). VITE_* are baked at build time.
# Set VITE_DISABLE_ANALYTICS=1 to ship a fully telemetry-free build;
# override VITE_POSTHOG_TOKEN to point a fork at your own PostHog project.
ARG VITE_DISABLE_ANALYTICS
ARG VITE_POSTHOG_TOKEN
ENV VITE_DISABLE_ANALYTICS=$VITE_DISABLE_ANALYTICS
ENV VITE_POSTHOG_TOKEN=$VITE_POSTHOG_TOKEN
RUN npm run build

# ---- runtime stage: Express serving API + static dist ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV SERVER_PORT=8787
ENV CLAUDE_DIR=/data/.claude
ENV APP_RUNTIME=docker

# tzdata so the TZ env var (day bucketing) works on alpine.
RUN apk add --no-cache tzdata

# Install prod deps + tsx (server runs TypeScript directly).
COPY package*.json ./
RUN npm ci --omit=dev && npm install tsx@^4 && npm cache clean --force

# App code + built frontend.
COPY server ./server
COPY tsconfig.json ./
COPY --from=build /app/dist ./dist

# ---- optional: bundle the Claude Code CLI so AI Insights can use `claude -p` ----
# Off by default (keeps the image small). Enable with build arg WITH_CLAUDE_CLI=1
# (see docker-compose.yml / .env). System ripgrep + USE_BUILTIN_RIPGREP=0 avoids
# the bundled glibc ripgrep, which doesn't run on musl/alpine.
ARG WITH_CLAUDE_CLI=0
ENV CLAUDE_CONFIG_DIR=/claude-cli
ENV USE_BUILTIN_RIPGREP=0
RUN if [ "$WITH_CLAUDE_CLI" = "1" ]; then \
      apk add --no-cache ripgrep git && \
      npm install -g @anthropic-ai/claude-code && \
      npm cache clean --force; \
    fi

EXPOSE 8787

# When the CLI is present, seed a writable config dir from the read-only ~/.claude
# mount (the CLI refreshes tokens / writes logs, so it can't use the :ro mount),
# then start the server. Without the CLI this is a no-op.
CMD if command -v claude >/dev/null 2>&1 && [ -n "$CLAUDE_CONFIG_DIR" ]; then \
      mkdir -p "$CLAUDE_CONFIG_DIR"; \
      [ -f /data/.claude/.credentials.json ] && cp -f /data/.claude/.credentials.json "$CLAUDE_CONFIG_DIR/.credentials.json" || true; \
      [ -f /data/.claude/settings.json ] && cp -f /data/.claude/settings.json "$CLAUDE_CONFIG_DIR/settings.json" || true; \
      [ -f "$CLAUDE_CONFIG_DIR/.claude.json" ] || echo '{"hasCompletedOnboarding":true}' > "$CLAUDE_CONFIG_DIR/.claude.json"; \
    fi; \
    exec npx tsx server/index.ts
