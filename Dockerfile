cat > Dockerfile << 'EOF'
# Use official Node on Debian
FROM node:18-bullseye

# Install Chrome stable and required libraries
RUN apt-get update && \
    apt-get install -y wget gnupg --no-install-recommends && \
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list' && \
    apt-get update && \
    apt-get install -y google-chrome-stable --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy rest of the code
COPY . .

# Tell Puppeteer where Chrome lives
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    NODE_ENV=production \
    PORT=3000

EXPOSE 3000

# Start your addon
CMD ["npm", "start"]
EOF
