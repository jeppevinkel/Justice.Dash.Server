FROM node:slim
LABEL authors="Jeppe"

ENV NODE_ENV production

WORKDIR /express-backend

COPY . .

RUN npm install

CMD ["node", "server.js"]

EXPOSE 8000