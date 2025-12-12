import http from "node:http";
import { PubSub } from "@google-cloud/pubsub";
import dotenv from "dotenv"; // import { handleCertificateMessage } from "./services/certificates.service";
import { CertificatesService } from "./services/certificates.service";
import { CommunicationService } from "./services/communication.service";

// Load env (local .env or CI/Cloud Run env)
dotenv.config();

const communicationService = new CommunicationService();
const service = new CertificatesService();

const PORT = Number(process.env.PORT || process.env.PORT_NUMBER || 8080);

const PROJECT_ID = process.env.PROJECT_ID || "test-project";
// Pub/Sub may live in a different project — allow overriding specifically for Pub/Sub
const PUBSUB_PROJECT_ID = process.env.PUBSUB_PROJECT_ID || PROJECT_ID;
const REQUEST_TOPIC = process.env.REQUEST_TOPIC || "certificate-validation";
const REQUEST_SUBSCRIPTION =
	process.env.REQUEST_SUBSCRIPTION || "certificate-validation-sub";
const RESPONSE_TOPIC =
	process.env.RESPONSE_TOPIC || "certificate-validator-response-sub";

const pubSubClient = new PubSub({ projectId: PUBSUB_PROJECT_ID });

async function setupPubSub() {
	try {
		// Ensure request topic exists
		const [topics] = await pubSubClient.getTopics();
		if (!topics.some((t) => t.name.endsWith(REQUEST_TOPIC))) {
			await pubSubClient.createTopic(REQUEST_TOPIC);
			console.log(`🆕 Created request topic: ${REQUEST_TOPIC}`);
		}
		if (!topics.some((t) => t.name.endsWith(RESPONSE_TOPIC))) {
			await pubSubClient.createTopic(RESPONSE_TOPIC);
			console.log(`🆕 Created response topic: ${RESPONSE_TOPIC}`);
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
		subscription.on("message", async (message) => {
			const jsonString = message.data.toString();
			try {
				const payload = JSON.parse(jsonString);
				const correlationId =
					message.attributes?.correlationId || payload.correlationId;
				const response = await communicationService.handleRequest(
					payload.operationType,
					payload.data.productId,
					payload.data.file,
					payload.data.certificateId,
				);
				message.ack();
				const responsePayload = JSON.stringify(response);
				pubSubClient.topic(RESPONSE_TOPIC).publishMessage({
					data: Buffer.from(responsePayload),
					attributes: {
						correlationId: correlationId || "unknown",
					},
				});
				console.log(`sent response to ${RESPONSE_TOPIC}`);
				console.log(responsePayload);
			} catch (_e) {
				const responsePayload = JSON.stringify({
					operationType: "FailedResponse",
					status: false,
				});
				pubSubClient.topic(RESPONSE_TOPIC).publishMessage({
					data: Buffer.from(responsePayload),
				});
			}
		});
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

const server = http.createServer(async (req, res) => {
	try {
		const url = new URL(
			req.url ?? "/",
			`http://${req.headers.host ?? "localhost"}`,
		);
		const method = req.method ?? "GET";

		// Health check
		if (url.pathname === "/healthz" && method === "GET") {
			res.writeHead(200, { "Content-Type": "text/plain" });
			res.end("ok");
			return;
		}

		// Upload certificate: POST /certificates/upload with JSON body { productId, file (base64) }
		if (url.pathname === "/certificates/upload" && method === "POST") {
			let body = "";
			req.on("data", (chunk) => {
				body += chunk;
			});
			req.on("end", async () => {
				try {
					const parsed = JSON.parse(body);
					const { productId, file, certificateId } = parsed ?? {};
					if (!productId || !file || !certificateId) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(
							JSON.stringify({
								success: false,
								message: "Missing productId, file or certificateId",
							}),
						);
						return;
					}

					const buffer = Buffer.from(file, "base64");
					const success = await service.uploadCertificate(
						productId,
						buffer,
						certificateId,
					);

					res.writeHead(success ? 200 : 400, {
						"Content-Type": "application/json",
					});
					res.end(JSON.stringify({ success }));
				} catch (err) {
					console.error("Error in /certificates/upload:", err);
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ success: false, error: "Internal error" }));
				}
			});
			return;
		}

		// List certificates: GET /certificates
		if (url.pathname === "/certificates" && method === "GET") {
			const productIds = await service.listCertificates();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ productIds, total: productIds.length }));
			return;
		}

		if (url.pathname.startsWith("/certificates/") && method === "GET") {
			const segments = url.pathname.split("/");
			const productId = segments[2];
			if (!productId) {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(
					JSON.stringify({ success: false, message: "Missing productId" }),
				);
				return;
			}

			const certificates = await service.listProductCertificates(productId);
			let responseCode: number;
			if (certificates.length) responseCode = 200;
			else responseCode = 404;
			res.writeHead(responseCode, {
				"Content-Type": "application/json",
			});
			res.end(JSON.stringify({ certificates }));
			return;
		}

		// Delete a single certificate: DELETE /certificates/:productId/:certId
		if (url.pathname.startsWith("/certificates/") && method === "DELETE") {
			const segments = url.pathname.split("/");
			const productId = segments[2];
			const certId = segments[3];
			if (!productId || !certId) {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(
					JSON.stringify({
						success: false,
						message: "Missing productId or certId",
					}),
				);
				return;
			}

			const success = await service.deleteProductCertificate(productId, certId);
			res.writeHead(success ? 200 : 400, {
				"Content-Type": "application/json",
			});
			res.end(JSON.stringify({ success }));
			return;
		}

		// Simple root response for manual checks
		if (method === "GET" && url.pathname === "/") {
			res.writeHead(200, { "Content-Type": "text/plain" });
			res.end("certificate-validation service running\n");
			return;
		}

		// Not found
		res.writeHead(404, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ error: "Not found" }));
	} catch (err) {
		console.error("Error handling request:", err);
		res.writeHead(500, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ error: "Internal error" }));
	}
});

server.listen(PORT, () => {
	console.log(`HTTP server listening on port ${PORT}`);
});
