import fs from "node:fs";
import { PubSub } from "@google-cloud/pubsub";
import dotenv from "dotenv";

dotenv.config();

const PROJECT_ID = process.env.PROJECT_ID || "test-project";
const PUBSUB_PROJECT_ID = process.env.PUBSUB_PROJECT_ID || PROJECT_ID;

const REQUEST_TOPIC = process.env.REQUEST_TOPIC || "CertificatesRequestTopic";
const _RESPONSE_TOPIC =
	process.env.RESPONSE_TOPIC || "CertificatesResponseTopic";
const RESPONSE_SUBSCRIPTION =
	process.env.RESPONSE_SUBSCRIPTION || "CertificatesResponseSubscription";

const pubSubClient = new PubSub({ projectId: PUBSUB_PROJECT_ID });

async function testValidCertificate() {
	console.log("🧪 Testing upload with valid certificate ID...");

	// Listen for responses
	const subscription = pubSubClient.subscription(RESPONSE_SUBSCRIPTION);

	subscription.on("message", async (message) => {
		try {
			const jsonString = message.data.toString();
			const parsed = JSON.parse(jsonString);
			console.log("📥 Received response:", parsed);
			message.ack();
		} catch (err) {
			console.error("❌ Failed to parse response:", err);
		}
	});

	// Upload with valid certificate
	const file = fs.readFileSync("test_to_send/spiderweb.pdf");
	const fileBase64 = file.toString("base64");

	const payload = {
		operationType: "upload",
		data: {
			productId: "test-product-456",
			file: fileBase64,
			certificateId: "ISCC-CORSIA-Cert-US201-2440920252", // Valid certificate
		},
	};

	const messageId = await pubSubClient.topic(REQUEST_TOPIC).publishMessage({
		data: Buffer.from(JSON.stringify(payload)),
	});

	console.log(
		`📤 Published upload message with valid certificate (${messageId})`,
	);
	console.log("📥 Waiting for response...");

	// Wait for response
	setTimeout(() => {
		console.log("⏰ Test completed");
		process.exit(0);
	}, 15000);
}

testValidCertificate().catch(console.error);
