FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package.json files
COPY package.json pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --filter reo-backend...

# Copy source code
COPY apps/backend ./apps/backend

# Expose port (Cloud Run sets this dynamically, but defaults to 8080)
ENV PORT=8080
EXPOSE 8080

# Start command
WORKDIR /app/apps/backend
CMD ["pnpm", "tsx", "src/index.ts"]
