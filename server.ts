import http from "node:http";
import dotenv from "dotenv";
import { CertificatesService } from "./services/certificates.service";

// Load env (local .env or CI/Cloud Run env)
dotenv.config();

const service = new CertificatesService();

// Minimal HTTP server so Cloud Run health/startup probes see a listening port.
const PORT = Number(process.env.PORT || process.env.PORT_NUMBER || 8080);
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
					const { productId, file } = parsed ?? {};
					if (!productId || !file) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(
							JSON.stringify({
								success: false,
								message: "Missing productId or file",
							}),
						);
						return;
					}

					const buffer = Buffer.from(file, "base64");
					const success = await service.uploadCertificate(productId, buffer);

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

		// Delete certificate: DELETE /certificates/:productId
		if (url.pathname.startsWith("/certificates/") && method === "DELETE") {
			const segments = url.pathname.split("/");
			const productId = segments[2];
			if (!productId) {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(
					JSON.stringify({ success: false, message: "Missing productId" }),
				);
				return;
			}

			const success = await service.deleteCertificate(productId);
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
