FROM node:latest

COPY ./src /app/src
COPY ./package.json /app/package.json
COPY ./tsconfig.json /app/tsconfig.json
COPY ./typings.json /app/typings.json
COPY ./fix-typings.js /app/fix-typings.js
COPY ./keys /app/keys
WORKDIR /app

RUN npm install
RUN npm run postinstall
RUN npm run build
ENTRYPOINT npm start

EXPOSE 8000