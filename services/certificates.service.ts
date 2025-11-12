import fs from "node:fs";
import path from "node:path";
import { PubSub } from "@google-cloud/pubsub";

process.env.PUBSUB_EMULATOR_HOST = "localhost:8085";

const PROJECT_ID = "test-project";
const RESPONSE_TOPIC = "CertificatesResponseTopic";
const pubSubClient = new PubSub({ projectId: PROJECT_ID });

const CERT_DIR = path.join(__dirname, "..", "certificates");

async function publishMessage(data: Record<string, any>) {
	const dataBuffer = Buffer.from(JSON.stringify(data));
	await pubSubClient.topic(RESPONSE_TOPIC).publish(dataBuffer);
}

async function verifyCertificate(productId: string) {
	const params = new URLSearchParams(`draw=4&columns[0][data]=0&columns[0][name]=cert_ikon&columns[0][searchable]=true&columns[0][orderable]=true&columns[0][search][value]=&columns[0][search][regex]=false&columns[1][data]=1&columns[1][name]=cert_number&columns[1][searchable]=true&columns[1][orderable]=true&columns[1][search][value]=&columns[1][search][regex]=false&columns[2][data]=2&columns[2][name]=cert_owner&columns[2][searchable]=true&columns[2][orderable]=true&columns[2][search][value]=&columns[2][search][regex]=false&columns[3][data]=3&columns[3][name]=scope&columns[3][searchable]=true&columns[3][orderable]=true&columns[3][search][value]=&columns[3][search][regex]=false&columns[4][data]=4&columns[4][name]=cert_in_put&columns[4][searchable]=true&columns[4][orderable]=true&columns[4][search][value]=&columns[4][search][regex]=false&columns[5][data]=5&columns[5][name]=cert_add_on&columns[5][searchable]=true&columns[5][orderable]=true&columns[5][search][value]=&columns[5][search][regex]=false&columns[6][data]=6&columns[6][name]=cert_products&columns[6][searchable]=true&columns[6][orderable]=true&columns[6][search][value]=&columns[6][search][regex]=false&columns[7][data]=7&columns[7][name]=cert_valid_from&columns[7][searchable]=true&columns[7][orderable]=true&columns[7][search][value]=&columns[7][search][regex]=false&columns[8][data]=8&columns[8][name]=cert_valid_until&columns[8][searchable]=true&columns[8][orderable]=true&columns[8][search][value]=&columns[8][search][regex]=false&columns[9][data]=9&columns[9][name]=cert_suspended_date&columns[9][searchable]=true&columns[9][orderable]=true&columns[9][search][value]=&columns[9][search][regex]=false&columns[10][data]=10&columns[10][name]=cert_issuer&columns[10][searchable]=true&columns[10][orderable]=true&columns[10][search][value]=&columns[10][search][regex]=false&columns[11][data]=11&columns[11][name]=cert_map&columns[11][searchable]=true&columns[11][orderable]=true&columns[11][search][value]=&columns[11][search][regex]=false&columns[12][data]=12&columns[12][name]=cert_file&columns[12][searchable]=true&columns[12][orderable]=true&columns[12][search][value]=&columns[12][search][regex]=false&columns[13][data]=13&columns[13][name]=cert_audit&columns[13][searchable]=true&columns[13][orderable]=true&columns[13][search][value]=&columns[13][search][regex]=false&columns[14][data]=14&columns[14][name]=cert_status&columns[14][searchable]=true&columns[14][orderable]=true&columns[14][search][value]=&columns[14][search][regex]=false&order[0][column]=8&order[0][dir]=desc&start=0&length=10&search[value]=${productId}&search[regex]=false&wdtNonce=be7d7248a6&sRangeSeparator=|`)

	const request = new Request("https://www.iscc-system.org/wp-admin/admin-ajax.php?action=get_wdtable&table_id=2", {
		method: "POST",
		body: params
	});

	const responseJson = await fetch(request)
		.then((response) => response.blob())
		.then((blob) => blob.text())
		.then((text) => JSON.parse(text))

	return responseJson["data"].toString().split("</span>").length - 1 == 4;
}

export class CertificatesService {
	async uploadCertificate(productId: string, file: Buffer): Promise<boolean> {
		const validCertificate = await verifyCertificate(productId);
		
		if (validCertificate) {
			try {
				fs.writeFileSync(path.join(CERT_DIR, `${productId}.pdf`), file);
				console.log(`✔️ Uploaded certificate for productId: ${productId}`);
				return true;
			} catch (err) {
				console.error(
					`❌ Failed to upload certificate for productId ${productId}:`,
					err,
				);
				return false;
			}
		}

		else {
			console.log(`❌ Certificate is invalid: ${productId}`);
			return false;
		}
	}

	listCertificates(): number[] {
		try {
			const files = fs
				.readdirSync(CERT_DIR)
				.filter((f) => f.endsWith(".pdf"))
				.map((f) => Number(f.replace(".pdf", "")));
			console.log(`✔️ Found ${files.length} certificates`);
			return files;
		} catch (err) {
			console.error("❌ Error listing certificates:", err);
			return [];
		}
	}

	deleteCertificate(productId: number): boolean {
		try {
			fs.unlinkSync(path.join(CERT_DIR, `${productId}.pdf`));
			console.log(`🗑️ Deleted certificate for productId: ${productId}`);
			return true;
		} catch (err) {
			console.error(
				`❌ Error deleting certificate for productId ${productId}:`,
				err,
			);
			return false;
		}
	}
}

export async function handleCertificateMessage(message: any) {
	try {
		const parsed = JSON.parse(message.data.toString());
		console.log("📩 Received message:", parsed);

		const { operationType, data } = parsed;
		const service = new CertificatesService();

		switch (operationType) {
			case "upload": {
				const { productId, file } = data;
				const success = await service.uploadCertificate(productId, Buffer.from(file));
				await publishMessage({ type: "uploadResponse", productId, success });
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
				await publishMessage({ type: "deleteResponse", productId, success });
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
