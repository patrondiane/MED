FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
# Dossier où le script de synchronisation écrit les fichiers BDPM et ses résumés
RUN mkdir -p scripts/BDM_FILES && chown -R node:node /app

ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["node", "index.js"]