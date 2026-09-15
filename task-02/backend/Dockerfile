FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npx prisma db push
RUN npx ts-node prisma/seed.ts
RUN npm run build

EXPOSE 5002
ENV PORT=5002
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
