# Build estático do frontend para produção (o Dockerfile de frontend/ é o de dev).
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Mesma origem: o Caddy encaminha /api/* para o backend.
ENV VITE_API_URL=""
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  location = /slides { try_files /slides/index.html =404; }\n  location /slides/ { try_files $uri $uri/index.html =404; }\n  location / { try_files $uri /index.html; }\n}\n' > /etc/nginx/conf.d/default.conf
