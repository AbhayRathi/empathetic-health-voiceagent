FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application files
COPY . .

# Build Next.js app
RUN npm run build

# Expose ports
EXPOSE 3000 8080

# Default command
CMD ["npm", "start"]
