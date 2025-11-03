import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { CertificatesService } from "./services/certificates.service.ts";
import path from "path";

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

if (!certificatesProto || !certificatesProto.CertificatesService) {
	console.error("❌ Error: CertificatesService not found in .proto file");
	process.exit(1);
}

const certificatesService = new CertificatesService();

const server = new grpc.Server();

server.addService(certificatesProto.CertificatesService.service, {
	UploadCertificate: (call: any, callback: any) => {
		const { productId, file } = call.request;

		console.log(`📥 Checking certificate for ${productId}`);
		callback(null, {
			success: certificatesService.uploadCertificate(productId, file),
		});
	},

	ListCertificates: (_call: any, callback: any) => {
		console.log(`📥 ListCertificates request`);

		const certificates = certificatesService.listCertificates();
		callback(null, { productIds: certificates, total: certificates.length });
	},

	DeleteCertificate: (call: any, callback: any) => {
		const { productId } = call.request;

		console.log(`📥 Deleting certificate ${productId}`);
		callback(null, {
			success: certificatesService.deleteCertificate(productId),
		});
	},
});

const PORT = "0.0.0.0:50051";
server.bindAsync(
	PORT,
	grpc.ServerCredentials.createInsecure(),
	(error, port) => {
		if (error) {
			console.error("❌ Error starting server: ", error);
			process.exit(1);
		}
		console.log(`🚀 Server running on ${PORT}`);
		console.log(`📡 Port: ${port}`);
	},
);
