import fs from "node:fs";
import path from "node:path";
import { PubSub } from "@google-cloud/pubsub";
import { Storage } from "@google-cloud/storage";
import { Firestore } from "@google-cloud/firestore";
import dotenv from "dotenv";

// Load local .env when present. Do NOT force the emulator host here so the
// service can run in Cloud Run without attempting to connect to localhost:8085.
dotenv.config();

const PROJECT_ID = process.env.PROJECT_ID || "test-project";
// Allow using a centralized Pub/Sub in another project by setting PUBSUB_PROJECT_ID.
const PUBSUB_PROJECT_ID = process.env.PUBSUB_PROJECT_ID || PROJECT_ID;
const RESPONSE_TOPIC = "CertificatesResponseTopic";
const pubSubClient = new PubSub({ projectId: PUBSUB_PROJECT_ID });

// Cloud Storage and Firestore configuration
const BUCKET_NAME = process.env.BUCKET_NAME || "made-in-portugal-certificates";
const FIRESTORE_COLLECTION = process.env.FIRESTORE_COLLECTION || "certificates";

const storage = new Storage({ projectId: PUBSUB_PROJECT_ID });
const firestore = new Firestore({ projectId: PUBSUB_PROJECT_ID });

const CERT_DIR = path.join(__dirname, "..", "certificates");

async function publishMessage(data: Record<string, any>) {
	const dataBuffer = Buffer.from(JSON.stringify(data));
	await pubSubClient.topic(RESPONSE_TOPIC).publish(dataBuffer);
}

async function verifyCertificate(productId: string) {
	const requestPage = new Request(
		"https://www.iscc-system.org/certification/certificate-database/all-certificates/",
		{
			method: "GET",
		},
	);

	const responsePage = await fetch(requestPage)
		.then((response) => response.blob())
		.then((blob) => blob.text())
		.then((text) => text.substring(text.indexOf("wdtNonceFrontendEdit_2")));

	const i = responsePage.indexOf("value") + 7;

	const wdtNonce = responsePage.substring(i, responsePage.indexOf('"', i + 7));

	const params = new URLSearchParams(
		`draw=4&columns[0][data]=0&columns[0][name]=cert_ikon&columns[0][searchable]=true&columns[0][orderable]=true&columns[0][search][value]=&columns[0][search][regex]=false&columns[1][data]=1&columns[1][name]=cert_number&columns[1][searchable]=true&columns[1][orderable]=true&columns[1][search][value]=&columns[1][search][regex]=false&columns[2][data]=2&columns[2][name]=cert_owner&columns[2][searchable]=true&columns[2][orderable]=true&columns[2][search][value]=&columns[2][search][regex]=false&columns[3][data]=3&columns[3][name]=scope&columns[3][searchable]=true&columns[3][orderable]=true&columns[3][search][value]=&columns[3][search][regex]=false&columns[4][data]=4&columns[4][name]=cert_in_put&columns[4][searchable]=true&columns[4][orderable]=true&columns[4][search][value]=&columns[4][search][regex]=false&columns[5][data]=5&columns[5][name]=cert_add_on&columns[5][searchable]=true&columns[5][orderable]=true&columns[5][search][value]=&columns[5][search][regex]=false&columns[6][data]=6&columns[6][name]=cert_products&columns[6][searchable]=true&columns[6][orderable]=true&columns[6][search][value]=&columns[6][search][regex]=false&columns[7][data]=7&columns[7][name]=cert_valid_from&columns[7][searchable]=true&columns[7][orderable]=true&columns[7][search][value]=&columns[7][search][regex]=false&columns[8][data]=8&columns[8][name]=cert_valid_until&columns[8][searchable]=true&columns[8][orderable]=true&columns[8][search][value]=&columns[8][search][regex]=false&columns[9][data]=9&columns[9][name]=cert_suspended_date&columns[9][searchable]=true&columns[9][orderable]=true&columns[9][search][value]=&columns[9][search][regex]=false&columns[10][data]=10&columns[10][name]=cert_issuer&columns[10][searchable]=true&columns[10][orderable]=true&columns[10][search][value]=&columns[10][search][regex]=false&columns[11][data]=11&columns[11][name]=cert_map&columns[11][searchable]=true&columns[11][orderable]=true&columns[11][search][value]=&columns[11][search][regex]=false&columns[12][data]=12&columns[12][name]=cert_file&columns[12][searchable]=true&columns[12][orderable]=true&columns[12][search][value]=&columns[12][search][regex]=false&columns[13][data]=13&columns[13][name]=cert_audit&columns[13][searchable]=true&columns[13][orderable]=true&columns[13][search][value]=&columns[13][search][regex]=false&columns[14][data]=14&columns[14][name]=cert_status&columns[14][searchable]=true&columns[14][orderable]=true&columns[14][search][value]=&columns[14][search][regex]=false&order[0][column]=8&order[0][dir]=desc&start=0&length=10&search[value]=${productId}&search[regex]=false&wdtNonce=${wdtNonce}&sRangeSeparator=|`,
	);

	const request = new Request(
		"https://www.iscc-system.org/wp-admin/admin-ajax.php?action=get_wdtable&table_id=2",
		{
			method: "POST",
			body: params,
		},
	);

	const responseJson = await fetch(request)
		.then((response) => response.blob())
		.then((blob) => blob.text())
		.then((text) => JSON.parse(text));

	return (
		responseJson.data.length === 1 && responseJson.data[0][1] === productId
	);
}

export class CertificatesService {
	// Uploads PDF buffer to GCS and writes metadata to Firestore
	async uploadCertificate(productId: string | number, file: Buffer): Promise<boolean> {
		const validCertificate = await verifyCertificate(String(productId));

		if (!validCertificate) {
			console.log(`❌ Certificate is invalid: ${productId}`);
			return false;
		}

		const objectName = `certificates/${productId}.pdf`;
		const bucket = storage.bucket(BUCKET_NAME);
		const gcsFile = bucket.file(objectName);

		try {
			await gcsFile.save(file, {
				contentType: "application/pdf",
			});

			// Write metadata to Firestore
			await firestore.collection(FIRESTORE_COLLECTION).doc(String(productId)).set({
				productId: Number(productId),
				bucketPath: `gs://${BUCKET_NAME}/${objectName}`,
				uploadedAt: new Date().toISOString(),
				verified: true,
			});

			console.log(`✔️ Uploaded certificate for productId: ${productId}`);
			return true;
		} catch (err) {
			console.error(`❌ Failed to upload certificate for productId ${productId}:`, err);
			return false;
		}
	}

	// List certificates by reading Firestore documents
	async listCertificates(): Promise<number[]> {
		try {
			const snapshot = await firestore.collection(FIRESTORE_COLLECTION).get();
			const productIds: number[] = [];
			snapshot.forEach((doc) => {
				const data = doc.data();
				if (data?.productId !== undefined) productIds.push(Number(data.productId));
			});
			console.log(`✔️ Found ${productIds.length} certificates`);
			return productIds;
		} catch (err) {
			console.error("❌ Error listing certificates:", err);
			return [];
		}
	}

	// Delete certificate: remove object from GCS and Firestore doc
	async deleteCertificate(productId: number): Promise<boolean> {
		const objectName = `certificates/${productId}.pdf`;
		const bucket = storage.bucket(BUCKET_NAME);
		const gcsFile = bucket.file(objectName);

		try {
			await gcsFile.delete().catch((e) => {
				if (e.code === 404) return; // ignore not found
				throw e;
			});

			await firestore.collection(FIRESTORE_COLLECTION).doc(String(productId)).delete().catch(() => {});

			console.log(`🗑️ Deleted certificate for productId: ${productId}`);
			return true;
		} catch (err) {
			console.error(`❌ Error deleting certificate for productId ${productId}:`, err);
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
				// client sends file as base64 string; decode accordingly
				const success = await service.uploadCertificate(
					productId,
					Buffer.from(file, "base64"),
				);
				await publishMessage({ type: "uploadResponse", productId, success });
				break;
			}

			case "list": {
				const productIds = await service.listCertificates();
				await publishMessage({
					type: "listResponse",
					productIds,
					total: productIds.length,
				});
				break;
			}

			case "delete": {
				const { productId } = data;
				const success = await service.deleteCertificate(productId);
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
