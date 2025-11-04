// client.ts
import fs from "fs";
import { PubSub } from "@google-cloud/pubsub";
import dotenv from "dotenv";

dotenv.config();

const PROJECT_ID = process.env.PROJECT_ID || "test-project";
const REQUEST_TOPIC = process.env.TOPIC_NAME || "CertificatesTopic";
const RESPONSE_SUBSCRIPTION = process.env.SUBSCRIPTION_NAME || "CertificatesSubscription";

const pubSubClient = new PubSub({ projectId: PROJECT_ID });

async function publishRequest(operationType: string, data: Record<string, any>) {
	const payload = JSON.stringify({ operationType, data });
	const messageId = await pubSubClient.topic(REQUEST_TOPIC).publishMessage({
		data: Buffer.from(payload),
	});
	console.log(`📤 Published ${operationType} message (${messageId})`);
}

function waitForResponse(expectedType: string): Promise<any> {
	return new Promise((resolve) => {
		const subscription = pubSubClient.subscription(RESPONSE_SUBSCRIPTION);

		const handler = (message: any) => {
			try {
				const parsed = JSON.parse(message.data.toString());
				if (parsed.type === expectedType) {
					message.ack();
					subscription.removeListener("message", handler);
					resolve(parsed);
				}
			} catch (err) {
				console.error("❌ Failed to parse response:", err);
				message.nack();
			}
		};

		subscription.on("message", handler);
	});
}

async function main() {
	console.log("🔌 Connected to Google Pub/Sub\n");

	console.log("1️⃣ Sending certificate...");
	const productId = Math.floor(Math.random() * 1000);
	const file = fs.readFileSync("test_to_send/spiderweb.pdf");
	const fileBase64 = file.toString("base64");

	await publishRequest("upload", { productId, file: fileBase64 });
	const uploadResponse = await waitForResponse("uploadResponse");

	if (uploadResponse.success) console.log(`✅ Certificate uploaded successfully!`);
	else console.log(`❌ Failed to upload certificate!`);

	console.log("\n2️⃣ Listing certificates...");
	await publishRequest("list", {});
	const listResponse = await waitForResponse("listResponse");
	console.log(`✅ Found ${listResponse.total} certificates:`, listResponse.productIds);

	if (listResponse.productIds.length > 0) {
		console.log("\n3️⃣ Deleting a certificate...");
		const randomId =
			listResponse.productIds[Math.floor(Math.random() * listResponse.productIds.length)];
		await publishRequest("delete", { productId: randomId });
		const deleteResponse = await waitForResponse("deleteResponse");

		if (deleteResponse.success)
			console.log(`✅ Certificate with ID ${randomId} deleted successfully!`);
		else console.log(`❌ Failed to delete certificate with ID ${randomId}`);
	} else {
		console.log("⚠️ No certificates found to delete.");
	}
}

await main();
