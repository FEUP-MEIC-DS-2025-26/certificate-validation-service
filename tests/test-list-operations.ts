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

// Response queue system to handle multiple concurrent requests
const responseQueue: Map<string, any[]> = new Map();

// Set up the listener once
const subscription = pubSubClient.subscription(RESPONSE_SUBSCRIPTION);
subscription.on("message", async (message: any) => {
	try {
		const jsonString = message.data.toString();
		const parsed = JSON.parse(jsonString);
		message.ack();

		const operationType = parsed.operationType;
		if (!responseQueue.has(operationType)) {
			responseQueue.set(operationType, []);
		}
		responseQueue.get(operationType)?.push(parsed);

		console.log(`📥 Received ${operationType} response`);
	} catch (err) {
		console.error("❌ Failed to parse response:", err);
	}
});

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

function waitForResponse(
	expectedType: string,
	timeoutMs: number = 15000,
): Promise<any> {
	return new Promise((resolve, reject) => {
		const startTime = Date.now();

		const checkQueue = () => {
			const responses = responseQueue.get(expectedType);
			if (responses && responses.length > 0) {
				const response = responses.shift()!;
				console.log(`✅ Got ${expectedType} response`);
				resolve(response);
				return;
			}

			if (Date.now() - startTime > timeoutMs) {
				reject(new Error(`Timeout waiting for ${expectedType}`));
				return;
			}

			setTimeout(checkQueue, 200);
		};

		console.log(`⏳ Waiting for ${expectedType} response...`);
		checkQueue();
	});
}

async function testListOperations() {
	console.log("🧪 Testing List Operations\n");

	const file = fs.readFileSync("test_to_send/spiderweb.pdf");
	const fileBase64 = file.toString("base64");

	const testResults: Array<{ test: string; success: boolean; details?: any }> =
		[];

	// Helper function to upload test data
	async function uploadTestData(productId: string, certificateId: string) {
		await publishRequest("upload", {
			productId,
			file: fileBase64,
			certificateId,
		});
		const response = await waitForResponse("uploadResponse");
		return response.status === true;
	}

	// Test 1: List all products when database is empty
	try {
		console.log("1️⃣ Testing list all products (empty database)...");

		// First, let's try to clean up any existing test data
		await publishRequest("list", {});
		const initialList = await waitForResponse("listResponse");

		if (initialList.productIds && initialList.productIds.length > 0) {
			console.log(
				`   Found ${initialList.productIds.length} existing products, cleaning up...`,
			);
			// Note: We can't easily clean up without delete operations, so we'll work with existing data
		}

		const success =
			Array.isArray(initialList.productIds) &&
			typeof initialList.total === "number";
		testResults.push({
			test: "List all products structure",
			success,
			details: {
				productIds: initialList.productIds || [],
				total: initialList.total || 0,
				isArray: Array.isArray(initialList.productIds),
			},
		});
		console.log(
			`   Result: ${success ? "✅ Valid structure" : "❌ Invalid structure"}`,
		);
		console.log(`   Found ${initialList.total || 0} products`);
	} catch (error) {
		testResults.push({
			test: "List all products structure",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 2: Upload test data for further testing
	const testProducts = [
		{ id: "list-test-product-1", cert: "ISCC-CORSIA-Cert-US201-2440920252" },
		{ id: "list-test-product-2", cert: "EU-ISCC-Cert-ES216-20254133" },
	];

	console.log("\n📋 Setting up test data...");
	for (const product of testProducts) {
		try {
			const uploaded = await uploadTestData(product.id, product.cert);
			console.log(`   Uploaded ${product.id}: ${uploaded ? "✅" : "❌"}`);
		} catch (error) {
			console.log(`   Failed to upload ${product.id}: ${error.message}`);
		}
	}

	// Test 3: List all products with data
	try {
		console.log("\n3️⃣ Testing list all products (with data)...");

		await publishRequest("list", {});
		const listResponse = await waitForResponse("listResponse");

		const hasTestProducts = testProducts.every((p) =>
			listResponse.productIds?.includes(p.id),
		);

		const success =
			Array.isArray(listResponse.productIds) &&
			typeof listResponse.total === "number" &&
			listResponse.total >= testProducts.length &&
			hasTestProducts;

		testResults.push({
			test: "List all products with data",
			success,
			details: {
				productIds: listResponse.productIds || [],
				total: listResponse.total || 0,
				expectedTestProducts: testProducts.map((p) => p.id),
				foundTestProducts: testProducts
					.map((p) => p.id)
					.filter((id) => listResponse.productIds?.includes(id)),
			},
		});
		console.log(`   Result: ${success ? "✅ Success" : "❌ Failed"}`);
		console.log(`   Found ${listResponse.total || 0} total products`);
	} catch (error) {
		testResults.push({
			test: "List all products with data",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 4: List certificates for specific product (existing)
	try {
		console.log("\n4️⃣ Testing list certificates for specific product...");

		const productId = testProducts[0].id;
		await publishRequest("listProductCertificates", { productId });
		const listProductResponse = await waitForResponse(
			"listProductCertificatesResponse",
		);

		const success =
			listProductResponse.operationType === "listProductCertificatesResponse" &&
			listProductResponse.productId === productId &&
			Array.isArray(listProductResponse.certificates) &&
			typeof listProductResponse.total === "number" &&
			listProductResponse.total >= 1;

		testResults.push({
			test: "List certificates for specific product",
			success,
			details: {
				productId: listProductResponse.productId,
				total: listProductResponse.total || 0,
				certificatesCount: listProductResponse.certificates?.length || 0,
				hasCertificates: (listProductResponse.certificates?.length || 0) > 0,
			},
		});
		console.log(`   Result: ${success ? "✅ Success" : "❌ Failed"}`);
		console.log(
			`   Found ${listProductResponse.total || 0} certificates for product ${productId}`,
		);

		if (
			listProductResponse.certificates &&
			listProductResponse.certificates.length > 0
		) {
			listProductResponse.certificates.forEach((cert: any, i: number) => {
				console.log(
					`     ${i + 1}. ID: ${cert.id}, Uploaded: ${cert.uploadedAt}, Valid Until: ${cert.validUntil}`,
				);
			});
		}
	} catch (error) {
		testResults.push({
			test: "List certificates for specific product",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 5: List certificates for non-existent product
	try {
		console.log("\n5️⃣ Testing list certificates for non-existent product...");

		const nonExistentProductId = "non-existent-product-12345";
		await publishRequest("listProductCertificates", {
			productId: nonExistentProductId,
		});
		const listProductResponse = await waitForResponse(
			"listProductCertificatesResponse",
		);

		const success =
			listProductResponse.operationType === "listProductCertificatesResponse" &&
			listProductResponse.productId === nonExistentProductId &&
			Array.isArray(listProductResponse.certificates) &&
			listProductResponse.total === 0;

		testResults.push({
			test: "List certificates for non-existent product",
			success,
			details: {
				productId: listProductResponse.productId,
				total: listProductResponse.total || 0,
				certificatesCount: listProductResponse.certificates?.length || 0,
			},
		});
		console.log(
			`   Result: ${success ? "✅ Correctly empty" : "❌ Unexpected data"}`,
		);
		console.log(
			`   Found ${listProductResponse.total || 0} certificates for non-existent product`,
		);
	} catch (error) {
		testResults.push({
			test: "List certificates for non-existent product",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 6: List certificates with missing productId
	try {
		console.log("\n6️⃣ Testing list certificates with missing productId...");

		await publishRequest("listProductCertificates", {});
		const listProductResponse = await waitForResponse(
			"listProductCertificatesResponse",
		);

		// Should handle missing productId gracefully
		const success =
			listProductResponse.operationType === "listProductCertificatesResponse";

		testResults.push({
			test: "List certificates with missing productId",
			success,
			details: {
				productId: listProductResponse.productId,
				total: listProductResponse.total || 0,
			},
		});
		console.log(
			`   Result: ${success ? "✅ Handled gracefully" : "❌ Failed to handle"}`,
		);
	} catch (error) {
		testResults.push({
			test: "List certificates with missing productId",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 7: Verify certificate data structure
	try {
		console.log("\n7️⃣ Testing certificate data structure...");

		const productId = testProducts[0].id;
		await publishRequest("listProductCertificates", { productId });
		const listProductResponse = await waitForResponse(
			"listProductCertificatesResponse",
		);

		let hasValidStructure = false;
		if (
			listProductResponse.certificates &&
			listProductResponse.certificates.length > 0
		) {
			const cert = listProductResponse.certificates[0];
			hasValidStructure =
				typeof cert.id === "string" &&
				typeof cert.bucketPath === "string" &&
				typeof cert.uploadedAt === "string" &&
				typeof cert.verified === "boolean" &&
				(cert.validUntil === null || typeof cert.validUntil === "string");
		}

		const success = hasValidStructure;
		testResults.push({
			test: "Certificate data structure validation",
			success,
			details: {
				hasCertificates: (listProductResponse.certificates?.length || 0) > 0,
				structureValid: hasValidStructure,
				sampleCertificate: listProductResponse.certificates?.[0] || null,
			},
		});
		console.log(
			`   Result: ${success ? "✅ Valid structure" : "❌ Invalid structure"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Certificate data structure validation",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Summary
	console.log("\n📊 Test Summary:");
	const passed = testResults.filter((r) => r.success).length;
	const total = testResults.length;

	testResults.forEach((result) => {
		const status = result.success ? "✅" : "❌";
		console.log(`   ${status} ${result.test}`);
		if (!result.success && result.details) {
			console.log(`      Details: ${JSON.stringify(result.details)}`);
		}
	});

	console.log(`\n🎯 Overall Result: ${passed}/${total} tests passed`);

	return passed === total;
}

// Run the test
testListOperations()
	.then((success) => {
		console.log("\n🏁 List operations tests completed");
		process.exit(success ? 0 : 1);
	})
	.catch((error) => {
		console.error("\n💥 Test suite failed:", error);
		process.exit(1);
	});
