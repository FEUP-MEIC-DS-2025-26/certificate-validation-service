import fs from "node:fs";
import path from "node:path";
import type { ServiceError } from "@grpc/grpc-js";
import * as grpcJs from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

interface UploadCertificateResponse {
	success: boolean;
}

interface ListCertificatesResponse {
	productIds: number[];
	total: number;
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

const protoDescriptor = grpcJs.loadPackageDefinition(packageDefinition);
const certificatesProto = protoDescriptor.certificates as {
	CertificatesService: grpcJs.ServiceClientConstructor;
};

const client = new certificatesProto.CertificatesService(
	"localhost:50051",
	grpcJs.credentials.createInsecure(),
);

console.log("🔌 Client connected with server!\n");

function printErrorMessage(error: ServiceError) {
	console.error("❌ Error:", error.message);
}

console.log("1️⃣ Sending certificate...\n");
const certificate = fs.readFileSync("test_to_send/spiderweb.pdf");
client.UploadCertificate(
	{ productId: Math.floor(Math.random() * 1000), file: certificate },
	(error: ServiceError | null, response: UploadCertificateResponse) => {
		if (error) {
			printErrorMessage(error);
		} else {
			if (response.success) console.log(`✅ Your certificate was accepted!`);
			else console.log(`❌ Invalid certificate!`);

			console.log("2️⃣ Testing ListCertificates...");
			client.ListCertificates(
				{},
				(error: ServiceError | null, response: ListCertificatesResponse) => {
					if (error) {
						printErrorMessage(error);
					} else {
						const productIds = response.productIds;
						console.log("✅", response.total, "Certificates:", productIds);

						console.log("3️⃣ Deleting certificate...");
						client.DeleteCertificate(
							{
								productId:
									productIds[Math.floor(Math.random() * productIds.length)],
							},
							(
								error: ServiceError | null,
								response: DeleteCertificateResponse,
							) => {
								if (error) {
									printErrorMessage(error);
								} else {
									if (response.success)
										console.log(`✅ Your certificate was deleted!`);
									else console.log(`❌ Invalid id!`);
								}
							},
						);
					}
				},
			);
		}
	},
);
