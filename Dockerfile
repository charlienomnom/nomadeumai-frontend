FROM node:18-alpine
# Force complete rebuild - 2025-12-12-v2
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install

# Copy source
COPY . .

# Build
RUN npm run build

# Install serve
RUN npm install -g serve

EXPOSE 3000

CMD ["serve", "-s", "build", "-l", "3000"]