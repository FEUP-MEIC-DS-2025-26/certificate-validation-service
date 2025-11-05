// services/certificates.service.ts

import { Firestore } from "@google-cloud/firestore";
import { PubSub } from "@google-cloud/pubsub";
import { Storage } from "@google-cloud/storage";
import dotenv from "dotenv";

// Load .env only if it exists (for local development)
dotenv.config();

// PubSub configuration - uses PUBSUB_EMULATOR_HOST from .env (local) or defaults (production)
const PUBSUB_PROJECT_ID = process.env.PROJECT_ID || process.env.GCP_PROJECT_ID || "test-project";
const RESPONSE_TOPIC = process.env.RESPONSE_TOPIC || "CertificatesResponseTopic";
const pubSubClient = new PubSub({ projectId: PUBSUB_PROJECT_ID });

interface CertificateMetadata {
	productId: number;
	fileName: string;
	uploadedAt: Date;
	fileSize: number;
	storagePath: string;
}

async function publishMessage(data: Record<string, any>) {
	const dataBuffer = Buffer.from(JSON.stringify(data));
	await pubSubClient.topic(RESPONSE_TOPIC).publish(dataBuffer);
}

export class CertificatesService {
	private storage: Storage;
	private firestore: Firestore;
	private bucketName: string;
	private collectionName: string;

	constructor() {
		// Configuration priority:
		// 1. Production (Cloud Run): Uses Workload Identity - no explicit credentials needed
		// 2. Local with service account key: Uses GOOGLE_APPLICATION_CREDENTIALS env var
		// 3. Fallback: Application Default Credentials (ADC)
		
		const projectId = process.env.GCP_PROJECT_ID || process.env.PROJECT_ID;
		
		// Only specify credentials if GOOGLE_APPLICATION_CREDENTIALS is set (local dev)
		const config = process.env.GOOGLE_APPLICATION_CREDENTIALS
			? {
					projectId,
					keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
				}
			: { projectId }; // Cloud Run uses Workload Identity automatically

		this.storage = new Storage(config);
		this.firestore = new Firestore(config);

		this.bucketName = process.env.GCS_BUCKET_NAME || "certificates-bucket";
		this.collectionName = "certificates";
	}

	async uploadCertificate(productId: number, file: Buffer): Promise<boolean> {
		try {
			const fileName = `certificate_${productId}.pdf`;
			const storagePath = `certificates/${fileName}`;

			// Upload PDF to Google Cloud Storage
			const bucket = this.storage.bucket(this.bucketName);
			const fileObj = bucket.file(storagePath);

			await fileObj.save(file, {
				metadata: {
					contentType: "application/pdf",
				},
			});

			// Store metadata in Firestore
			const metadata: CertificateMetadata = {
				productId,
				fileName,
				uploadedAt: new Date(),
				fileSize: file.length,
				storagePath,
			};

			await this.firestore
				.collection(this.collectionName)
				.doc(productId.toString())
				.set(metadata);

			console.log(`✅ Certificate uploaded for product ${productId}`);
			return true;
		} catch (error) {
			console.error(`❌ Error uploading certificate: ${error}`);
			return false;
		}
	}

	async listCertificates(): Promise<number[]> {
		try {
			const snapshot = await this.firestore
				.collection(this.collectionName)
				.get();

			const productIds: number[] = [];
			snapshot.forEach((doc) => {
				const data = doc.data() as CertificateMetadata;
				productIds.push(data.productId);
			});

			console.log(`✅ Found ${productIds.length} certificates`);
			return productIds;
		} catch (error) {
			console.error(`❌ Error listing certificates: ${error}`);
			return [];
		}
	}

	async deleteCertificate(productId: number): Promise<boolean> {
		try {
			// Get metadata to find storage path
			const docRef = this.firestore
				.collection(this.collectionName)
				.doc(productId.toString());

			const doc = await docRef.get();

			if (!doc.exists) {
				console.warn(`⚠️ Certificate ${productId} not found`);
				return false;
			}

			const metadata = doc.data() as CertificateMetadata;

			// Delete from Google Cloud Storage
			const bucket = this.storage.bucket(this.bucketName);
			await bucket.file(metadata.storagePath).delete();

			// Delete metadata from Firestore
			await docRef.delete();

			console.log(`✅ Certificate deleted for product ${productId}`);
			return true;
		} catch (error) {
			console.error(`❌ Error deleting certificate: ${error}`);
			return false;
		}
	}

	async getCertificate(productId: number): Promise<Buffer | null> {
		try {
			const docRef = this.firestore
				.collection(this.collectionName)
				.doc(productId.toString());

			const doc = await docRef.get();

			if (!doc.exists) {
				return null;
			}

			const metadata = doc.data() as CertificateMetadata;
			const bucket = this.storage.bucket(this.bucketName);
			const file = bucket.file(metadata.storagePath);

			const [contents] = await file.download();
			return contents;
		} catch (error) {
			console.error(`❌ Error getting certificate: ${error}`);
			return null;
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
				const success = await service.uploadCertificate(
					productId,
					Buffer.from(file),
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
