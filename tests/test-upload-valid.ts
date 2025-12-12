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

async function testValidUploads() {
	console.log("🧪 Testing Upload Operations with Valid Certificates\n");

	const file = fs.readFileSync("test_to_send/spiderweb.pdf");
	const fileBase64 = file.toString("base64");

	const validCertificates = [
		{
			id: "ISCC-CORSIA-Cert-US201-2440920252",
			product: "test-product-valid-1",
		},
		{ id: "EU-ISCC-Cert-ES216-20254133", product: "test-product-valid-2" },
	];

	const testResults: Array<{ test: string; success: boolean; details?: any }> =
		[];

	// Test 1: Upload with first valid certificate
	try {
		console.log("1️⃣ Testing upload with valid certificate #1...");
		await publishRequest("upload", {
			productId: validCertificates[0].product,
			file: fileBase64,
			certificateId: validCertificates[0].id,
		});
		const response = await waitForResponse("uploadResponse");

		const success = response.status === true;
		testResults.push({
			test: "Valid certificate #1 upload",
			success,
			details: {
				status: response.status,
				productId: validCertificates[0].product,
			},
		});
		console.log(`   Result: ${success ? "✅ Success" : "❌ Failed"}`);
	} catch (error) {
		testResults.push({
			test: "Valid certificate #1 upload",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 2: Upload with second valid certificate
	try {
		console.log("\n2️⃣ Testing upload with valid certificate #2...");
		await publishRequest("upload", {
			productId: validCertificates[1].product,
			file: fileBase64,
			certificateId: validCertificates[1].id,
		});
		const response = await waitForResponse("uploadResponse");

		const success = response.status === true;
		testResults.push({
			test: "Valid certificate #2 upload",
			success,
			details: {
				status: response.status,
				productId: validCertificates[1].product,
			},
		});
		console.log(`   Result: ${success ? "✅ Success" : "❌ Failed"}`);
	} catch (error) {
		testResults.push({
			test: "Valid certificate #2 upload",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 3: Upload multiple certificates to same product
	try {
		console.log("\n3️⃣ Testing multiple certificates for same product...");
		const productId = "test-product-multiple";

		// First certificate
		await publishRequest("upload", {
			productId,
			file: fileBase64,
			certificateId: validCertificates[0].id,
		});
		const response1 = await waitForResponse("uploadResponse");

		// Second certificate
		await publishRequest("upload", {
			productId,
			file: fileBase64,
			certificateId: validCertificates[1].id,
		});
		const response2 = await waitForResponse("uploadResponse");

		const success = response1.status === true && response2.status === true;
		testResults.push({
			test: "Multiple certificates for same product",
			success,
			details: {
				firstUpload: response1.status,
				secondUpload: response2.status,
				productId,
			},
		});
		console.log(`   Result: ${success ? "✅ Success" : "❌ Failed"}`);
	} catch (error) {
		testResults.push({
			test: "Multiple certificates for same product",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 4: Verify certificates were stored correctly
	try {
		console.log("\n4️⃣ Verifying certificates were stored...");

		// List all products
		await publishRequest("list", {});
		const listResponse = await waitForResponse("listResponse");

		// Check if our test products are in the list
		const expectedProducts = [
			validCertificates[0].product,
			validCertificates[1].product,
			"test-product-multiple",
		];

		const foundProducts = expectedProducts.filter((p) =>
			listResponse.productIds?.includes(p),
		);

		const success = foundProducts.length === expectedProducts.length;
		testResults.push({
			test: "Certificates storage verification",
			success,
			details: {
				expected: expectedProducts,
				found: listResponse.productIds || [],
				totalFound: foundProducts.length,
			},
		});
		console.log(`   Result: ${success ? "✅ Success" : "❌ Failed"}`);
		console.log(
			`   Found ${foundProducts.length}/${expectedProducts.length} test products`,
		);
	} catch (error) {
		testResults.push({
			test: "Certificates storage verification",
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
testValidUploads()
	.then((success) => {
		console.log("\n🏁 Valid upload tests completed");
		process.exit(success ? 0 : 1);
	})
	.catch((error) => {
		console.error("\n💥 Test suite failed:", error);
		process.exit(1);
	});
