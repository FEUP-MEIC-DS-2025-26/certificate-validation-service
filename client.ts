import fs from "node:fs";
import { PubSub } from "@google-cloud/pubsub";
import dotenv from "dotenv";

dotenv.config();

const PROJECT_ID = process.env.PROJECT_ID || "test-project";
// If Pub/Sub is hosted in a different project, set PUBSUB_PROJECT_ID to point there.
const PUBSUB_PROJECT_ID = process.env.PUBSUB_PROJECT_ID || PROJECT_ID;

const REQUEST_TOPIC = process.env.REQUEST_TOPIC || "CertificatesRequestTopic";
const RESPONSE_TOPIC =
	process.env.RESPONSE_TOPIC || "CertificatesResponseTopic";
const RESPONSE_SUBSCRIPTION =
	process.env.RESPONSE_SUBSCRIPTION || "CertificatesResponseSubscription";

const pubSubClient = new PubSub({ projectId: PUBSUB_PROJECT_ID });

async function setupResponseSubscription() {
	console.log("getting topics");
	const [topics] = await pubSubClient.getTopics();
	if (!topics.some((t) => t.name.endsWith(RESPONSE_TOPIC))) {
		await pubSubClient.createTopic(RESPONSE_TOPIC);
		console.log(`🆕 Created response topic: ${RESPONSE_TOPIC}`);
	}

	const [subscriptions] = await pubSubClient.getSubscriptions();
	console.log(subscriptions);
	if (!subscriptions.some((s) => s.name.endsWith(RESPONSE_SUBSCRIPTION))) {
		await pubSubClient
			.topic(RESPONSE_TOPIC)
			.createSubscription(RESPONSE_SUBSCRIPTION);
		console.log(`🆕 Created response subscription: ${RESPONSE_SUBSCRIPTION}`);
	}
}

async function publishRequest(
	operationType: string,
	data: Record<string, any>,
) {
	const payload = JSON.stringify({ operationType, data });
	const messageId = await pubSubClient.topic(REQUEST_TOPIC).publishMessage({
		data: Buffer.from(payload),
	});
	console.log(`📤 Published ${operationType} message (${messageId})`);
}

// Response queue system to handle multiple concurrent requests
const responseQueue: Map<string, any[]> = new Map();

// Set up the listener once
const subscription = pubSubClient.subscription(RESPONSE_SUBSCRIPTION);
subscription.on("message", async (message: any) => {
	try {
		const jsonString = message.data.toString();
		const parsed = JSON.parse(jsonString);
		message.ack();

		const operationType = parsed.operationType;
		if (!responseQueue.has(operationType)) {
			responseQueue.set(operationType, []);
		}
		responseQueue.get(operationType)?.push(parsed);

		console.log(`📥 Received ${operationType} response`);
	} catch (err) {
		console.error("❌ Failed to parse response:", err);
	}
});

function waitForResponse(expectedType: string): Promise<any> {
	const timeoutMs = 15000; // Increased timeout
	return new Promise((resolve, reject) => {
		const startTime = Date.now();

		const checkQueue = () => {
			const responses = responseQueue.get(expectedType);
			if (responses && responses.length > 0) {
				const response = responses.shift()!;
				console.log(`✅ Got ${expectedType} response`);
				resolve(response);
				return;
			}

			// Check timeout
			if (Date.now() - startTime > timeoutMs) {
				reject(new Error(`Timeout waiting for ${expectedType}`));
				return;
			}

			// Check again after a short delay
			setTimeout(checkQueue, 200);
		};

		console.log(`⏳ Waiting for ${expectedType} response...`);
		checkQueue();
	});
}

async function main() {
	console.log("🔌 Connected to Google Pub/Sub\n");

	await setupResponseSubscription(); // Ensure response subscription exists

	// 1️⃣ Upload
	const productId = Math.floor(Math.random() * 1000);
	const certificateId = "ISCC-CORSIA-Cert-US201-2440920252"; // Valid certificate ID
	const file = fs.readFileSync("test_to_send/spiderweb.pdf");
	const fileBase64 = file.toString("base64");

	await publishRequest("upload", {
		productId,
		file: fileBase64,
		certificateId,
	});
	const uploadResponse = await waitForResponse("uploadResponse");

	if (uploadResponse.status === true)
		console.log(`✅ Certificate uploaded successfully!`);
	else console.log(`❌ Failed to upload certificate!`);

	// 2️⃣ List
	await publishRequest("list", {});
	const listResponse = await waitForResponse("listResponse");
	console.log(
		`✅ Found ${listResponse.total} certificates:`,
		listResponse.productIds,
	);

	// 2️⃣b List Product Certificates (new operation)
	if (listResponse.productIds.length > 0) {
		const firstProductId = listResponse.productIds[0];
		await publishRequest("listProductCertificates", {
			productId: firstProductId,
		});
		const listProductResponse = await waitForResponse(
			"listProductCertificatesResponse",
		);
		console.log(
			`✅ Found ${listProductResponse.total} certificates for product ${firstProductId}:`,
			listProductResponse.certificates.map((c: any) => c.id),
		);
	}

	// 3️⃣ Delete random certificate (old operation)
	if (listResponse.productIds.length > 0) {
		const randomId =
			listResponse.productIds[
				Math.floor(Math.random() * listResponse.productIds.length)
			];
		await publishRequest("delete", { productId: randomId });
		const deleteResponse = await waitForResponse("deleteResponse");

		if (deleteResponse.status === true)
			console.log(
				`✅ All certificates for product ${randomId} deleted successfully!`,
			);
		else
			console.log(`❌ Failed to delete certificates for product ${randomId}`);
	} else {
		console.log("⚠️ No certificates found to delete.");
	}

	// 3️⃣b Test deleteProductCertificate (new operation)
	// First upload another certificate to have something to delete
	const productId2 = Math.floor(Math.random() * 1000);
	const certificateId2 = "EU-ISCC-Cert-ES216-20254133"; // Second valid certificate ID
	await publishRequest("upload", {
		productId: productId2,
		file: fileBase64,
		certificateId: certificateId2,
	});
	const uploadResponse2 = await waitForResponse("uploadResponse");

	if (uploadResponse2.status === true) {
		// List certificates for this product to get a certificate ID
		await publishRequest("listProductCertificates", { productId: productId2 });
		const listProductResponse = await waitForResponse(
			"listProductCertificatesResponse",
		);

		if (listProductResponse.certificates.length > 0) {
			const certToDelete = listProductResponse.certificates[0];
			console.log(
				`📋 Will delete certificate ${certToDelete.id} from product ${productId2}`,
			);
			await publishRequest("deleteProductCertificate", {
				productId: productId2,
				certificateId: certToDelete.id,
			});
			const deleteProductResponse = await waitForResponse(
				"deleteProductCertificateResponse",
			);

			if (deleteProductResponse.status === true)
				console.log(
					`✅ Certificate ${certToDelete.id} for product ${productId2} deleted successfully!`,
				);
			else
				console.log(
					`❌ Failed to delete certificate ${certToDelete.id} for product ${productId2}`,
				);
		}
	}
}

main().catch(console.error);
