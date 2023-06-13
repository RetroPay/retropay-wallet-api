FROM node:alpine

WORKDIR /app/banking

COPY package.json ./
COPY tsconfig.json ./
COPY src ./src
COPY .env .

RUN npm install


EXPOSE 4001
CMD ["npm", "start"]

