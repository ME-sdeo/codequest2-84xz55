# Stage 1: Builder
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies and build tools
RUN apk add --no-cache python3 make g++ \
    && npm ci \
    && npm cache clean --force

# Copy source code
COPY . .

# Build application
RUN npm run build \
    && npm prune --production

# Stage 2: Development
FROM node:18-alpine AS development

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies including devDependencies
RUN npm install

# Configure development environment
ENV NODE_ENV=development
ENV PORT=3000

# Expose port
EXPOSE 3000

# Mount points for development
VOLUME ["/app/node_modules", "/app"]

# Start application in development mode
CMD ["npm", "run", "start:dev"]

# Stage 3: Production
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app

# Add non-root user for security
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 -G nodejs

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production \
    && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Create required directories with correct permissions
RUN mkdir -p /app/logs \
    && chown -R nodejs:nodejs /app

# Expose port
EXPOSE 3000

# Set up healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Switch to non-root user
USER nodejs

# Enable read-only root filesystem
RUN chmod -R 555 /app

# Start application in production mode
CMD ["npm", "run", "start:prod"]