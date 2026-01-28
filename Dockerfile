# Stage 1: Build
FROM node:18-alpine AS build
WORKDIR /usr/local/app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code and env
COPY ./ ./

# Build the app (will use .env file)
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# Copy built files
COPY --from=build /usr/local/app/dist .

# Add nginx config for SPA routing
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8081
CMD ["nginx", "-g", "daemon off;"]