FROM oven/bun:1 AS base

WORKDIR /app

# Copy dependency files
COPY package.json bun.lock* package-lock.json* ./

# Install all dependencies
RUN bun install --frozen-lockfile || npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 8080

# Set environment variable for port
ENV PORT=8080

# Start the server
CMD ["bun", "run", "server.ts"]
