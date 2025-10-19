FROM ubuntu:24.04

# Install dependencies
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update; apt-get install -y --no-install-recommends npm
RUN npm install -g bun

COPY server.ts /server.ts
COPY services/user.service.ts /services/user.service.ts
COPY proto /proto
COPY *.lock /*.lock
COPY package.json /package.json

RUN bun install

CMD bun run server
