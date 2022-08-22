FROM node:alpine AS builder

WORKDIR /app

COPY . .

RUN yarn install

RUN yarn build


FROM busybox:1.35

RUN adduser -D static
USER static
WORKDIR /app
COPY --from=builder /app/dist /app

EXPOSE 8080

CMD ["busybox", "httpd", "-f", "-v", "-p", "8080"]