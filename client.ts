import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "path";
import fs from 'fs';

const PROTO_PATH = path.join(process.cwd(), "proto", "certificates.proto");


const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
	keepCase: true,
	longs: String,
	enums: String,
	defaults: true,
	oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const certificatesProto = protoDescriptor.certificates as any;


const client = new certificatesProto.CertificatesService(
	"localhost:50051",
	grpc.credentials.createInsecure()
);

console.log("🔌 Client connected with server!\n");


console.log("1️⃣ Sending certificate...\n");
const certificate = fs.readFileSync('test_to_send/spiderweb.pdf')
client.UploadCertificate({productId: Math.floor(Math.random() * 1000), file: certificate}, (error: any, response: any) => {
	if (error) {
		console.error("❌ Error:", error.message);
	} else {
		console.log(response.message);
	}
});
