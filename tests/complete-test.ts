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
	const timeoutMs = 10000;
	return new Promise((resolve, reject) => {
		const subscription = pubSubClient.subscription(RESPONSE_SUBSCRIPTION);

		const handle = async (message: any) => {
			try {
				const jsonString = message.data.toString();
				const parsed = JSON.parse(jsonString);
				message.ack();
				if (parsed.operationType === expectedType) {
					subscription.removeListener("message", handle);
					clearTimeout(timeout);
					resolve(parsed);
				} else {
					console.log(
						`Wrong expectedType (expected:${expectedType}, actual: ${parsed.operationType})`,
					);
				}
			} catch (err) {
				console.error("❌ Failed to parse response:", err);
			}
		};

		const timeout = setTimeout(() => {
			reject(new Error(`Timeout waiting for ${expectedType}`));
		}, timeoutMs);

		subscription.on("message", handle);
	});
}

async function completeTest() {
	console.log("🎯 Complete PubSub Integration Test with Valid Certificates\n");

	const file = fs.readFileSync("test_to_send/spiderweb.pdf");
	const fileBase64 = file.toString("base64");

	// Test 1: Upload first certificate
	console.log("1️⃣ Uploading first certificate...");
	await publishRequest("upload", {
		productId: "product-test-1",
		file: fileBase64,
		certificateId: "ISCC-CORSIA-Cert-US201-2440920252",
	});
	const upload1 = await waitForResponse("uploadResponse");
	console.log(`   Result: ${upload1.status ? "✅ Success" : "❌ Failed"}`);

	// Test 2: Upload second certificate
	console.log("\n2️⃣ Uploading second certificate...");
	await publishRequest("upload", {
		productId: "product-test-2",
		file: fileBase64,
		certificateId: "EU-ISCC-Cert-ES216-20254133",
	});
	const upload2 = await waitForResponse("uploadResponse");
	console.log(`   Result: ${upload2.status ? "✅ Success" : "❌ Failed"}`);

	// Test 3: List all products
	console.log("\n3️⃣ Listing all products...");
	await publishRequest("list", {});
	const listAll = await waitForResponse("listResponse");
	console.log(
		`   Found ${listAll.total} products: ${listAll.productIds.join(", ")}`,
	);

	// Test 4: List certificates for specific product
	if (listAll.productIds.length > 0) {
		console.log("\n4️⃣ Listing certificates for first product...");
		await publishRequest("listProductCertificates", {
			productId: listAll.productIds[0],
		});
		const listProduct = await waitForResponse(
			"listProductCertificatesResponse",
		);
		console.log(
			`   Found ${listProduct.total} certificates for product ${listProduct.productId}`,
		);
		if (listProduct.certificates.length > 0) {
			listProduct.certificates.forEach((cert: any, i: number) => {
				console.log(
					`   ${i + 1}. ID: ${cert.id}, Uploaded: ${cert.uploadedAt}, Valid Until: ${cert.validUntil}`,
				);
			});
		}

		// Test 5: Delete specific certificate
		if (listProduct.certificates.length > 0) {
			console.log("\n5️⃣ Deleting specific certificate...");
			const certToDelete = listProduct.certificates[0];
			await publishRequest("deleteProductCertificate", {
				productId: listProduct.productId,
				certificateId: certToDelete.id,
			});
			const deleteCert = await waitForResponse(
				"deleteProductCertificateResponse",
			);
			console.log(
				`   Result: ${deleteCert.status ? "✅ Success" : "❌ Failed"}`,
			);
			console.log(
				`   Deleted certificate ${deleteCert.certificateId} from product ${deleteCert.productId}`,
			);

			// Test 6: Verify certificate was deleted
			console.log("\n6️⃣ Verifying certificate deletion...");
			await publishRequest("listProductCertificates", {
				productId: listProduct.productId,
			});
			const listAfterDelete = await waitForResponse(
				"listProductCertificatesResponse",
			);
			console.log(`   Certificates remaining: ${listAfterDelete.total}`);
		}
	}

	console.log("\n🎉 Complete PubSub integration test finished!");
}

completeTest().catch(console.error);
