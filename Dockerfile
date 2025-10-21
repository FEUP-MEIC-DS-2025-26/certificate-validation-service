FROM oven/bun:latest

COPY server.ts /server.ts
COPY services/user.service.ts /services/user.service.ts
COPY proto /proto
COPY *.lock /*.lock
COPY package.json /package.json

RUN bun install

CMD bun run server
