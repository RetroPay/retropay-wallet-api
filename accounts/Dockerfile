FROM node:alpine

WORKDIR /app/account

COPY package.json ./
COPY tsconfig.json ./
COPY src ./src
COPY .env .

RUN npm install


EXPOSE 4002
CMD ["npm", "start"]

