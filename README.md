# Certificate Validation Service

## Setup

1. Install dependencies:
```bash
bun install
```

2. Start the server:
```bash
bun run server
```

3. In another terminal, run the client:
```bash
bun run client
```

4. Generate TypeScript code from Protocol Buffers:
```bash
protoc --plugin=protoc-gen-ts=./node_modules/.bin/protoc-gen-ts  --ts_out=./generated  --proto_path=./proto ./proto/*.proto
```