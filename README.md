# Certificate Validation Service

## Setup

1. Install dependencies:
```bash
bun install
```

2. Prepare the .env file:
```bash
cp .env.example .env
```

3. Run the PubSub Emulator:
```bash
docker compose -f pubsub-compose.yml up
```

4. Create a new terminal and start the server:
```bash
bun run server
```

5. In another terminal, run the client:
```bash
bun run client
```

6. Generate TypeScript code from Protocol Buffers:
```bash
protoc --plugin=protoc-gen-ts=./node_modules/.bin/protoc-gen-ts  --ts_out=./generated  --proto_path=./proto ./proto/*.proto
```
