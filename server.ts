import { PubSub } from "@google-cloud/pubsub";
import dotenv from "dotenv";
import http from "node:http";
import { handleCertificateMessage } from "./services/certificates.service";

// Load env (local .env or CI/Cloud Run env)
dotenv.config();

const PROJECT_ID = process.env.PROJECT_ID || "test-project";
// Pub/Sub may live in a different project — allow overriding specifically for Pub/Sub
const PUBSUB_PROJECT_ID = process.env.PUBSUB_PROJECT_ID || PROJECT_ID;
const REQUEST_TOPIC = process.env.REQUEST_TOPIC || "CertificatesRequestTopic";
const REQUEST_SUBSCRIPTION =
	process.env.REQUEST_SUBSCRIPTION || "CertificatesRequestSubscription";

const pubSubClient = new PubSub({ projectId: PUBSUB_PROJECT_ID });

async function setupPubSub() {
	try {
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
		subscription.on("error", (err) =>
			console.error("❌ Subscription error:", err),
		);

		console.log(`✅ Server listening for messages on ${REQUEST_SUBSCRIPTION}`);
	} catch (err) {
		// Do not crash the process — log and continue. Cloud Run will still receive requests
		// and local dev can proceed. If Pub/Sub is required, the error should be surfaced via logs.
		console.error("❌ Failed to setup Pub/Sub subscription:", err);
	}
}

// Start Pub/Sub setup but don't let failures crash the process
setupPubSub();

// Minimal HTTP server so Cloud Run health/startup probes see a listening port.
const PORT = Number(process.env.PORT || process.env.PORT_NUMBER || 8080);
const server = http.createServer((req, res) => {
	if (req.url === "/healthz") {
		res.writeHead(200, { "Content-Type": "text/plain" });
		res.end("ok");
		return;
	}
	// Keep a simple root response for manual checks
	res.writeHead(200, { "Content-Type": "text/plain" });
	res.end("certificate-validation service running\n");
});

server.listen(PORT, () => {
	console.log(`HTTP server listening on port ${PORT}`);
});
