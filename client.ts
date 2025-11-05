import fs from "node:fs";
import { PubSub } from "@google-cloud/pubsub";
import dotenv from "dotenv";

dotenv.config();

const PROJECT_ID = process.env.PROJECT_ID || "test-project";

const REQUEST_TOPIC = process.env.REQUEST_TOPIC || "CertificatesRequestTopic";
const RESPONSE_TOPIC =
	process.env.RESPONSE_TOPIC || "CertificatesResponseTopic";
const RESPONSE_SUBSCRIPTION =
	process.env.RESPONSE_SUBSCRIPTION || "CertificatesResponseSubscription";

const pubSubClient = new PubSub({ projectId: PROJECT_ID });

async function setupResponseSubscription() {
	const [topics] = await pubSubClient.getTopics();
	if (!topics.some((t) => t.name.endsWith(RESPONSE_TOPIC))) {
		await pubSubClient.createTopic(RESPONSE_TOPIC);
		console.log(`🆕 Created response topic: ${RESPONSE_TOPIC}`);
	}

	const [subscriptions] = await pubSubClient.getSubscriptions();
	if (!subscriptions.some((s) => s.name.endsWith(RESPONSE_SUBSCRIPTION))) {
		await pubSubClient
			.topic(RESPONSE_TOPIC)
			.createSubscription(RESPONSE_SUBSCRIPTION);
		console.log(`🆕 Created response subscription: ${RESPONSE_SUBSCRIPTION}`);
	}
}

interface PubSubMessage {
	data: Buffer;
	ack: () => void;
	nack: () => void;
}

interface UploadResponse {
	type: "uploadResponse";
	productId: number;
	success: boolean;
}

interface ListResponse {
	type: "listResponse";
	productIds: number[];
	total: number;
}

interface DeleteResponse {
	type: "deleteResponse";
	productId: number;
	success: boolean;
}

type ResponseMessage = UploadResponse | ListResponse | DeleteResponse;

async function publishRequest(
	operationType: string,
	data: Record<string, unknown>,
) {
	const payload = JSON.stringify({ operationType, data });
	const messageId = await pubSubClient.topic(REQUEST_TOPIC).publishMessage({
		data: Buffer.from(payload),
	});
	console.log(`📤 Published ${operationType} message (${messageId})`);
}

function waitForResponse(
	expectedType: string,
	timeoutMs = 5000,
): Promise<ResponseMessage> {
	return new Promise((resolve, reject) => {
		const subscription = pubSubClient.subscription(RESPONSE_SUBSCRIPTION);

		const handler = (message: PubSubMessage) => {
			try {
				const parsed = JSON.parse(message.data.toString());
				if (parsed.type === expectedType) {
					message.ack();
					subscription.removeListener("message", handler);
					clearTimeout(timeout);
					resolve(parsed);
				}
			} catch (err) {
				console.error("❌ Failed to parse response:", err);
				message.nack();
			}
		};

		const timeout = setTimeout(() => {
			subscription.removeListener("message", handler);
			reject(new Error(`Timeout waiting for ${expectedType}`));
		}, timeoutMs);

		subscription.on("message", handler);
	});
}

async function main() {
	console.log("🔌 Connected to Google Pub/Sub\n");

	await setupResponseSubscription(); // Ensure response subscription exists

	// 1️⃣ Upload
	const productId = Math.floor(Math.random() * 1000);
	const file = fs.readFileSync("test_to_send/spiderweb.pdf");
	const fileBase64 = file.toString("base64");

	await publishRequest("upload", { productId, file: fileBase64 });
	const uploadResponse = (await waitForResponse(
		"uploadResponse",
	)) as UploadResponse;

	if (uploadResponse.success)
		console.log(`✅ Certificate uploaded successfully!`);
	else console.log(`❌ Failed to upload certificate!`);

	// 2️⃣ List
	await publishRequest("list", {});
	const listResponse = (await waitForResponse("listResponse")) as ListResponse;
	console.log(
		`✅ Found ${listResponse.total} certificates:`,
		listResponse.productIds,
	);

	// 3️⃣ Delete random certificate
	if (listResponse.productIds.length > 0) {
		const randomId =
			listResponse.productIds[
				Math.floor(Math.random() * listResponse.productIds.length)
			];
		await publishRequest("delete", { productId: randomId });
		const deleteResponse = (await waitForResponse(
			"deleteResponse",
		)) as DeleteResponse;

		if (deleteResponse.success)
			console.log(`✅ Certificate with ID ${randomId} deleted successfully!`);
		else console.log(`❌ Failed to delete certificate with ID ${randomId}`);
	} else {
		console.log("⚠️ No certificates found to delete.");
	}
}

await main();
