# Multi-stage build for production

# Stage 1: Build React frontend
FROM node:18-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Setup Node.js backend
FROM node:18-alpine
WORKDIR /app

# Copy backend files
COPY package*.json ./
RUN npm install --production

COPY server/ ./server/

# Copy built frontend from previous stage
COPY --from=client-build /app/client/build ./client/build

# Set environment to production
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "server/index.js"]
