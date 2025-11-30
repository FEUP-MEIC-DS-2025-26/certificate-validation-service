import { PubSub } from "@google-cloud/pubsub";
import dotenv from "dotenv";
import fs from "node:fs";

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
	console.log('getting topics')
	const [topics] = await pubSubClient.getTopics();
	if (!topics.some((t) => t.name.endsWith(RESPONSE_TOPIC))) {
		await pubSubClient.createTopic(RESPONSE_TOPIC);
		console.log(`🆕 Created response topic: ${RESPONSE_TOPIC}`);
	}

	const [subscriptions] = await pubSubClient.getSubscriptions();
	console.log(subscriptions)
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


function waitForResponse(expectedType: string): Promise<any> {
	const timeoutMs = 10000
	return new Promise((resolve, reject) => {
		const subscription = pubSubClient.subscription(RESPONSE_SUBSCRIPTION);

		const handle = async (message: any) => {
					try {
						console.log("started parsing")
						const jsonString = message.data.toString();
						console.log(expectedType)
						console.log(jsonString)
						const parsed = JSON.parse(jsonString);
						message.ack();
						if (parsed.operationType === expectedType) {
							console.log("resolving")
							subscription.removeListener("message",handle);
							clearTimeout(timeout);
							resolve(parsed);
						} else {
							console.log(`Wrong expectedType (expected:${expectedType}, actual: ${parsed.operationType})`)
						}
					} catch (err) {
						console.error("❌ Failed to parse response:", err);
						// message.nack();
					}
		}

		const timeout = setTimeout(() => {
			//subscription.removeListener("message", handler);
			reject(new Error(`Timeout waiting for ${expectedType}`));
		}, timeoutMs);

		// todo: message is not being processed
		console.log(`listening on ${RESPONSE_SUBSCRIPTION}`)
		subscription.on("message", handle);
	});
}

async function main() {
	console.log("🔌 Connected to Google Pub/Sub\n");

	await setupResponseSubscription(); // Ensure response subscription exists

	// 1️⃣ Upload
	const productId = Math.floor(Math.random() * 1000);
	const certificateId = Math.floor(Math.random() * 1000);
	const file = fs.readFileSync("test_to_send/spiderweb.pdf");
	const fileBase64 = file.toString("base64");

	await publishRequest("upload", { productId, file: fileBase64,certificateId });
	const uploadResponse = await waitForResponse("uploadResponse");

	if (uploadResponse.status == true)
		console.log(`✅ Certificate uploaded successfully!`);
	else console.log(`❌ Failed to upload certificate!`);

	// 2️⃣ List
	await publishRequest("list", {});
	const listResponse = await waitForResponse("listResponse");
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
		const deleteResponse = await waitForResponse("deleteResponse");

		if (deleteResponse.status == true)
			console.log(`✅ Certificate with ID ${randomId} deleted successfully!`);
		else console.log(`❌ Failed to delete certificate with ID ${randomId}`);
	} else {
		console.log("⚠️ No certificates found to delete.");
	}
}

await main();
