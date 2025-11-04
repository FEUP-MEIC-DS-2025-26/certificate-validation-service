import { PubSub } from "@google-cloud/pubsub";
import { handleCertificateMessage } from "./services/certificates.service";
import dotenv from "dotenv";

dotenv.config();

const PROJECT_ID = process.env.PROJECT_ID || "test-project";
const TOPIC_NAME = process.env.TOPIC_NAME || "CertificatesTopic";
const SUBSCRIPTION_NAME = process.env.SUBSCRIPTION_NAME || "CertificatesSubscription";

const pubSubClient = new PubSub({ projectId: PROJECT_ID });

async function setupPubSub() {
	const [topics] = await pubSubClient.getTopics();
	const topicExists = topics.some((t) => t.name.endsWith(TOPIC_NAME));
	if (!topicExists) {
		await pubSubClient.createTopic(TOPIC_NAME);
		console.log(`🆕 Created topic: ${TOPIC_NAME}`);
	}

	const [subscriptions] = await pubSubClient.getSubscriptions();
	const subExists = subscriptions.some((s) => s.name.endsWith(SUBSCRIPTION_NAME));
	if (!subExists) {
		await pubSubClient
			.topic(TOPIC_NAME)
			.createSubscription(SUBSCRIPTION_NAME);
		console.log(`🆕 Created subscription: ${SUBSCRIPTION_NAME}`);
	}

	const subscription = pubSubClient.subscription(SUBSCRIPTION_NAME);
	subscription.on("message", handleCertificateMessage);
	subscription.on("error", (err) => console.error("❌ Subscription error:", err));

	console.log(`✅ Listening for messages on ${SUBSCRIPTION_NAME}`);
}

setupPubSub();
