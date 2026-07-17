FROM node:22-alpine AS build

WORKDIR /workspace/frontend-visitor

COPY frontend-visitor/package*.json ./
RUN npm ci

COPY frontend-visitor/ ./
RUN npm run build

FROM nginx:1.27-alpine

COPY docker/nginx/visitor.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/frontend-visitor/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
