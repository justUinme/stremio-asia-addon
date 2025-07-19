# Use official Node on Debian
FROM node:18-bullseye

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy rest of the code
COPY . .

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

# Start your addon
CMD ["npm", "start"]
