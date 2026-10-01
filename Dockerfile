# Loter-IA for the public link: a small Node server, its one dependency, and the page.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY lib ./lib
COPY public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
