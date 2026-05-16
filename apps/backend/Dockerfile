FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package.json (assuming build context is apps/backend)
COPY package.json ./

# Install dependencies directly with npm to avoid monorepo issues
RUN npm install

# Copy the rest of the backend source code
COPY . .

# Expose port (Cloud Run sets this dynamically, but defaults to 8080)
ENV PORT=8080
EXPOSE 8080

# Start command
CMD ["npx", "tsx", "src/index.ts"]
