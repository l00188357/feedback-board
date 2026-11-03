# Stage 1: build the Astro static website
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Empty URL = same-origin requests through Nginx reverse proxy.
ENV PUBLIC_POCKETBASE_URL=""
RUN npm run build

# Stage 2: serve the website and proxy the backend API
FROM nginx:alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/ /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1