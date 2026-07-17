FROM node:22-alpine AS build

WORKDIR /workspace/frontend-admin

COPY frontend-admin/package*.json ./
RUN npm ci

COPY frontend-admin/ ./
RUN npm run build

FROM nginx:1.27-alpine

COPY docker/nginx/admin.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/frontend-admin/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
