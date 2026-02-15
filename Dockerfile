FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts
COPY tsconfig.json ./

RUN npm run prisma:generate
RUN npm run build

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
