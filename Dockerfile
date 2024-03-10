FROM node:20-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN set -eux; \
  wget -q -O /bin/pnpm "https://github.com/pnpm/pnpm/releases/download/v8.11.0/pnpm-linuxstatic-x64"; \
  chmod +x /bin/pnpm;

WORKDIR /app

COPY ["pnpm-lock.yaml", "./"]
RUN  --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch

COPY . .
RUN  --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# ENV NODE_ENV=production
RUN  --mount=type=cache,id=pnpm,target=/pnpm/store pnpm run build
