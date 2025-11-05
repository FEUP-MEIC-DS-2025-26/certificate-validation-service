import fs from "node:fs";
import { PubSub } from "@google-cloud/pubsub";

process.env.PUBSUB_EMULATOR_HOST = 'localhost:8085';
const PROJECT_ID = "test-project";
const pubSubClient = new PubSub({ projectId: PROJECT_ID });

const CERTIFICATES_TOPIC = "CertificatesTopic";

async function publishMessage(data: Record<string, any>) {
	const dataBuffer = Buffer.from(JSON.stringify(data));
	await pubSubClient.topic(CERTIFICATES_TOPIC).publish(dataBuffer);
}

export class CertificatesService {
	uploadCertificate(productId: number, file: Buffer): boolean {
		try {
			if (Math.random() > 0.3) {
				fs.writeFileSync(`certificates/${productId}.pdf`, file);
				console.log(`✔️ Uploaded certificate for productId: ${productId}`);
				return true;
			}
			console.log(`❌ Failed to upload certificate for productId: ${productId}`);
			return false;
		} catch (err) {
			console.error(`Error uploading certificate for ${productId}:`, err);
			return false;
		}
	}

	listCertificates(): number[] {
		try {
			const files = fs
				.readdirSync("certificates")
				.filter((f) => f.endsWith(".pdf"))
				.map((f) => Number(f.replace(".pdf", "")));
			console.log(`✔️ Found ${files.length} certificates`);
			return files;
		} catch (err) {
			console.error("Error listing certificates:", err);
			return [];
		}
	}

	deleteCertificate(productId: number): boolean {
		try {
			fs.unlinkSync(`certificates/${productId}.pdf`);
			console.log(`🗑️ Deleted certificate for productId: ${productId}`);
			return true;
		} catch (err) {
			console.error(`Error deleting certificate for ${productId}:`, err);
			return false;
		}
	}
}

export async function handleCertificateMessage(message: any) {
	try {
		const parsed = JSON.parse(message.data.toString());
		const { operationType, data } = parsed;
		const service = new CertificatesService();

		switch (operationType) {
			case "upload": {
				const { productId, file } = data;
				const success = service.uploadCertificate(productId, Buffer.from(file));
				await publishMessage({
					type: "uploadResponse",
					productId,
					success,
				});
				break;
			}

			case "list": {
				const productIds = service.listCertificates();
				await publishMessage({
					type: "listResponse",
					productIds,
					total: productIds.length,
				});
				break;
			}

			case "delete": {
				const { productId } = data;
				const success = service.deleteCertificate(productId);
				await publishMessage({
					type: "deleteResponse",
					productId,
					success,
				});
				break;
			}

			default:
				console.warn("⚠️ Unknown operationType:", operationType);
				break;
		}
	} catch (err) {
		console.error("❌ Failed to process message:", err);
	} finally {
		message.ack();
	}
}
