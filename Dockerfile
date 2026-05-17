FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy root package management files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy both package.json files
COPY apps/backend/package.json ./apps/backend/
COPY apps/web/package.json ./apps/web/

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --filter reo-backend... --filter reo-web...

# Copy source code
COPY apps/backend ./apps/backend
COPY apps/web ./apps/web

# Build the web frontend
WORKDIR /app/apps/web
RUN pnpm run build

# Expose port (Cloud Run sets this dynamically, but defaults to 8080)
WORKDIR /app/apps/backend
ENV PORT=8080
EXPOSE 8080

# Start command
CMD ["pnpm", "tsx", "src/index.ts"]
