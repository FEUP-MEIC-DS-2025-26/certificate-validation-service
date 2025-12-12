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

async function testInvalidUploads() {
	console.log("🧪 Testing Upload Operations with Invalid Certificates\n");

	const file = fs.readFileSync("test_to_send/spiderweb.pdf");
	const fileBase64 = file.toString("base64");

	const testResults: Array<{ test: string; success: boolean; details?: any }> =
		[];

	// Test 1: Upload with invalid certificate ID
	try {
		console.log("1️⃣ Testing upload with invalid certificate ID...");
		await publishRequest("upload", {
			productId: "test-product-invalid-1",
			file: fileBase64,
			certificateId: "INVALID-CERT-ID-12345",
		});
		const response = await waitForResponse("uploadResponse");

		// Should fail with invalid certificate
		const success = response.status === false;
		testResults.push({
			test: "Invalid certificate ID",
			success,
			details: { status: response.status, expected: false },
		});
		console.log(
			`   Result: ${success ? "✅ Correctly rejected" : "❌ Unexpectedly accepted"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Invalid certificate ID",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 2: Upload with missing certificate ID
	try {
		console.log("\n2️⃣ Testing upload with missing certificate ID...");
		await publishRequest("upload", {
			productId: "test-product-missing-cert",
			file: fileBase64,
			// certificateId is missing
		});
		const response = await waitForResponse("uploadResponse");

		// Should fail due to missing certificate ID
		const success = response.status === false;
		testResults.push({
			test: "Missing certificate ID",
			success,
			details: { status: response.status, expected: false },
		});
		console.log(
			`   Result: ${success ? "✅ Correctly rejected" : "❌ Unexpectedly accepted"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Missing certificate ID",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 3: Upload with empty certificate ID
	try {
		console.log("\n3️⃣ Testing upload with empty certificate ID...");
		await publishRequest("upload", {
			productId: "test-product-empty-cert",
			file: fileBase64,
			certificateId: "",
		});
		const response = await waitForResponse("uploadResponse");

		// Should fail due to empty certificate ID
		const success = response.status === false;
		testResults.push({
			test: "Empty certificate ID",
			success,
			details: { status: response.status, expected: false },
		});
		console.log(
			`   Result: ${success ? "✅ Correctly rejected" : "❌ Unexpectedly accepted"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Empty certificate ID",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 4: Upload with malformed file data
	try {
		console.log("\n4️⃣ Testing upload with malformed file data...");
		await publishRequest("upload", {
			productId: "test-product-malformed-file",
			file: "not-a-valid-base64-string!!!@@@###",
			certificateId: "ISCC-CORSIA-Cert-US201-2440920252", // Valid cert but bad file
		});
		const response = await waitForResponse("uploadResponse");

		// Should fail due to malformed file data
		const success = response.status === false;
		testResults.push({
			test: "Malformed file data",
			success,
			details: { status: response.status, expected: false },
		});
		console.log(
			`   Result: ${success ? "✅ Correctly rejected" : "❌ Unexpectedly accepted"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Malformed file data",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 5: Upload with missing file data
	try {
		console.log("\n5️⃣ Testing upload with missing file data...");
		await publishRequest("upload", {
			productId: "test-product-missing-file",
			// file is missing
			certificateId: "ISCC-CORSIA-Cert-US201-2440920252",
		});
		const response = await waitForResponse("uploadResponse");

		// Should fail due to missing file data
		const success = response.status === false;
		testResults.push({
			test: "Missing file data",
			success,
			details: { status: response.status, expected: false },
		});
		console.log(
			`   Result: ${success ? "✅ Correctly rejected" : "❌ Unexpectedly accepted"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Missing file data",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 6: Upload with missing product ID
	try {
		console.log("\n6️⃣ Testing upload with missing product ID...");
		await publishRequest("upload", {
			// productId is missing
			file: fileBase64,
			certificateId: "ISCC-CORSIA-Cert-US201-2440920252",
		});
		const response = await waitForResponse("uploadResponse");

		// Should fail due to missing product ID
		const success = response.status === false;
		testResults.push({
			test: "Missing product ID",
			success,
			details: { status: response.status, expected: false },
		});
		console.log(
			`   Result: ${success ? "✅ Correctly rejected" : "❌ Unexpectedly accepted"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Missing product ID",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 7: Upload with expired certificate (if we can find one)
	try {
		console.log("\n7️⃣ Testing upload with potentially expired certificate...");
		await publishRequest("upload", {
			productId: "test-product-expired",
			file: fileBase64,
			certificateId: "ISCC-CERT-OLD-12345", // Likely non-existent/expired
		});
		const response = await waitForResponse("uploadResponse");

		// Should fail due to invalid/expired certificate
		const success = response.status === false;
		testResults.push({
			test: "Potentially expired certificate",
			success,
			details: { status: response.status, expected: false },
		});
		console.log(
			`   Result: ${success ? "✅ Correctly rejected" : "❌ Unexpectedly accepted"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Potentially expired certificate",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 8: Verify invalid uploads didn't create any data
	try {
		console.log("\n8️⃣ Verifying invalid uploads didn't create data...");

		// List all products to check if any invalid uploads were stored
		await publishRequest("list", {});
		const listResponse = await waitForResponse("listResponse");

		// Check that none of our test products with invalid data were created
		const invalidProducts = [
			"test-product-invalid-1",
			"test-product-missing-cert",
			"test-product-empty-cert",
			"test-product-malformed-file",
			"test-product-missing-file",
			"test-product-expired",
		];

		const foundInvalidProducts = invalidProducts.filter((p) =>
			listResponse.productIds?.includes(p),
		);

		const success = foundInvalidProducts.length === 0;
		testResults.push({
			test: "No invalid data created",
			success,
			details: {
				invalidProductsFound: foundInvalidProducts,
				totalInvalid: foundInvalidProducts.length,
			},
		});
		console.log(
			`   Result: ${success ? "✅ No invalid data found" : "❌ Invalid data was created"}`,
		);
		if (foundInvalidProducts.length > 0) {
			console.log(
				`   Found invalid products: ${foundInvalidProducts.join(", ")}`,
			);
		}
	} catch (error) {
		testResults.push({
			test: "No invalid data created",
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
testInvalidUploads()
	.then((success) => {
		console.log("\n🏁 Invalid upload tests completed");
		process.exit(success ? 0 : 1);
	})
	.catch((error) => {
		console.error("\n💥 Test suite failed:", error);
		process.exit(1);
	});
