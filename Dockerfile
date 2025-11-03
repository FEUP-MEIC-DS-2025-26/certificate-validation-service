FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install

COPY . .

EXPOSE 50051

CMD ["bun", "run", "server"]
