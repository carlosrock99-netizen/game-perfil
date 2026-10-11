# Etapa 1: compila o front
FROM node:20-alpine AS front
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Etapa 2: servidor
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY package*.json ./
RUN npm install --omit=dev
COPY server/ ./server/
COPY data/ ./data/
COPY --from=front /app/client/dist ./client/dist
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://localhost:3000/api/saude || exit 1
CMD ["node", "server/index.js"]
