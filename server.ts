import path from "node:path";
import type { GrpcObject } from "@grpc/grpc-js";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { CertificatesService } from "./services/certificates.service.ts";

interface UploadCertificateRequest {
	productId: number;
	file: Buffer;
}

interface UploadCertificateResponse {
	success: boolean;
}

type ListCertificatesRequest = Record<string, never>;

interface ListCertificatesResponse {
	productIds: number[];
	total: number;
}

interface DeleteCertificateRequest {
	productId: number;
}

interface DeleteCertificateResponse {
	success: boolean;
}

const PROTO_PATH = path.join(process.cwd(), "proto", "certificates.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
	keepCase: true,
	longs: String,
	enums: String,
	defaults: true,
	oneofs: true,
});

const protoDescriptor: GrpcObject =
	grpc.loadPackageDefinition(packageDefinition);
const certificatesProto = protoDescriptor.certificates as unknown as {
	CertificatesService: grpc.ServiceClientConstructor & {
		service: grpc.ServiceDefinition;
	};
};

if (!certificatesProto || !certificatesProto.CertificatesService) {
	console.error("❌ Error: CertificatesService not found in .proto file");
	process.exit(1);
}

const certificatesService = new CertificatesService();

const server = new grpc.Server();

server.addService(certificatesProto.CertificatesService.service, {
	UploadCertificate: async (
		call: grpc.ServerUnaryCall<
			UploadCertificateRequest,
			UploadCertificateResponse
		>,
		callback: grpc.sendUnaryData<UploadCertificateResponse>,
	) => {
		const { productId, file } = call.request;

		console.log(`📥 Uploading certificate for ${productId}`);
		try {
			const success = await certificatesService.uploadCertificate(
				productId,
				file,
			);
			callback(null, { success });
		} catch (error) {
			callback({
				code: grpc.status.INTERNAL,
				details: `Failed to upload certificate: ${error}`,
			});
		}
	},

	ListCertificates: async (
		_call: grpc.ServerUnaryCall<
			ListCertificatesRequest,
			ListCertificatesResponse
		>,
		callback: grpc.sendUnaryData<ListCertificatesResponse>,
	) => {
		console.log(`📥 ListCertificates request`);

		try {
			const certificates = await certificatesService.listCertificates();
			callback(null, { productIds: certificates, total: certificates.length });
		} catch (error) {
			callback({
				code: grpc.status.INTERNAL,
				details: `Failed to list certificates: ${error}`,
			});
		}
	},

	DeleteCertificate: async (
		call: grpc.ServerUnaryCall<
			DeleteCertificateRequest,
			DeleteCertificateResponse
		>,
		callback: grpc.sendUnaryData<DeleteCertificateResponse>,
	) => {
		const { productId } = call.request;

		console.log(`📥 Deleting certificate ${productId}`);
		try {
			const success = await certificatesService.deleteCertificate(productId);
			callback(null, { success });
		} catch (error) {
			callback({
				code: grpc.status.INTERNAL,
				details: `Failed to delete certificate: ${error}`,
			});
		}
	},
});

const PORT = process.env.PORT || 8080;
server.bindAsync(
	`0.0.0.0:${PORT}`,
	grpc.ServerCredentials.createInsecure(),
	(error, port) => {
		if (error) {
			console.error("❌ Error starting server: ", error);
			process.exit(1);
		}
		console.log(`🚀 Server running on 0.0.0.0:${PORT}`);
		console.log(`📡 Port: ${port}`);
	},
);
