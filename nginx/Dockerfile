FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY package*.json ./
RUN npm ci
COPY index.html ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY postcss.config.js ./
COPY tailwind.config.ts ./
COPY src ./src
ARG VITE_USE_API=true
ARG VITE_API_BASE_URL=http://localhost
ENV VITE_USE_API=${VITE_USE_API}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
