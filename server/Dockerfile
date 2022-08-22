FROM node:alpine as build

WORKDIR /app

COPY . .

RUN yarn install

RUN yarn build

FROM node:slim

WORKDIR /app

COPY --from=build /app/dist .
COPY ./src/public /app/public
RUN yarn init -y
RUN yarn add express socket.io

EXPOSE 8081

CMD ["node", "."]