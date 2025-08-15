FROM node:18

# Install system dependencies for PDF conversion and build tools
RUN apt-get update && apt-get install -y \
    libreoffice \
    pandoc \
    wkhtmltopdf \
    curl \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies after build to keep image smaller
RUN npm prune --omit=dev

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]