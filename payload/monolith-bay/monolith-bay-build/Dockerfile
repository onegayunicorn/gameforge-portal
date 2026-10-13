# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages
COPY tools ./tools
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Runtime stage
FROM nginx:alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY infra/nginx/security-headers.conf /etc/nginx/conf.d/security-headers.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
