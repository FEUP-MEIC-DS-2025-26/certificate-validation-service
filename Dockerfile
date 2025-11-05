FROM oven/bun:1 AS base

WORKDIR /app

# Copy dependency files
COPY package.json bun.lock* ./

# Install all dependencies (including @google-cloud packages)
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Expose port
EXPOSE 8080

# Set environment variable for port
ENV PORT=8080

# Health check (optional but helpful for debugging)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun --version || exit 1

# Start the server
CMD ["bun", "run", "server.ts"]
