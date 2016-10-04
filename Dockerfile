FROM node:latest

COPY ./app/src /app/src
COPY ./app/package.json /app/package.json
COPY ./app/tsconfig.json /app/tsconfig.json
WORKDIR /app

RUN npm install
RUN npm run build
ENTRYPOINT npm start

EXPOSE 80