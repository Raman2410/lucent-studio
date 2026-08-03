# ─────────────────────────────────────────
# Photographer Website Backend — Dockerfile
# ─────────────────────────────────────────

FROM node:20-alpine

WORKDIR /app

# copy package files first so npm install is cached
# and only reruns when dependencies actually change
COPY package*.json ./

RUN npm install

# copy the rest of the source code
COPY . .

# run as a non-root user — basic container security practice
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 5000

CMD ["node", "server.js"]