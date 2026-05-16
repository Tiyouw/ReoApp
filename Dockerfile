FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy root package management files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy backend package.json specifically
COPY apps/backend/package.json ./apps/backend/

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --filter reo-backend...

# Copy the rest of the backend source code
COPY apps/backend ./apps/backend

# Expose port (Cloud Run sets this dynamically, but defaults to 8080)
ENV PORT=8080
EXPOSE 8080

# Start command
WORKDIR /app/apps/backend
CMD ["pnpm", "tsx", "src/index.ts"]
