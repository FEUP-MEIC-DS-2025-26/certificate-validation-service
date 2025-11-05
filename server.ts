import { PubSub } from "@google-cloud/pubsub";
import dotenv from "dotenv";
import { handleCertificateMessage } from "./services/certificates.service";

dotenv.config();

const PROJECT_ID = process.env.PROJECT_ID || "test-project";
const REQUEST_TOPIC = process.env.REQUEST_TOPIC || "CertificatesRequestTopic";
const REQUEST_SUBSCRIPTION =
	process.env.REQUEST_SUBSCRIPTION || "CertificatesRequestSubscription";

const pubSubClient = new PubSub({ projectId: PROJECT_ID });

async function setupPubSub() {
	// Ensure request topic exists
	const [topics] = await pubSubClient.getTopics();
	if (!topics.some((t) => t.name.endsWith(REQUEST_TOPIC))) {
		await pubSubClient.createTopic(REQUEST_TOPIC);
		console.log(`🆕 Created request topic: ${REQUEST_TOPIC}`);
	}

	// Ensure request subscription exists
	const [subscriptions] = await pubSubClient.getSubscriptions();
	if (!subscriptions.some((s) => s.name.endsWith(REQUEST_SUBSCRIPTION))) {
		await pubSubClient
			.topic(REQUEST_TOPIC)
			.createSubscription(REQUEST_SUBSCRIPTION);
		console.log(`🆕 Created request subscription: ${REQUEST_SUBSCRIPTION}`);
	}

	const subscription = pubSubClient.subscription(REQUEST_SUBSCRIPTION);
	subscription.on("message", handleCertificateMessage);
	subscription.on("error", (err) => console.error("❌ Subscription error:", err));

	console.log(`✅ Server listening for messages on ${REQUEST_SUBSCRIPTION}`);
}

setupPubSub();
