# Use official Bun image
FROM oven/bun:1.1.38-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy application code
COPY . .

# Create directories for data persistence
RUN mkdir -p assets downloads

# Expose port for graph-ui server (if needed)
EXPOSE 3000

# Set default command
CMD ["bun", "run", "host.ts"]