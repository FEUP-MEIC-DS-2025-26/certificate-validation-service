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

async function testEdgeCases() {
	console.log("🧪 Testing Edge Cases and Error Handling\n");

	const file = fs.readFileSync("test_to_send/spiderweb.pdf");
	const fileBase64 = file.toString("base64");

	const testResults: Array<{ test: string; success: boolean; details?: any }> =
		[];

	// Test 1: Malformed JSON message
	try {
		console.log("1️⃣ Testing malformed JSON message...");

		// Send malformed JSON directly to the topic
		const malformedPayload = "{ invalid json structure";
		await pubSubClient.topic(REQUEST_TOPIC).publishMessage({
			data: Buffer.from(malformedPayload),
		});
		console.log("   Published malformed JSON");

		// Wait a bit to see if service handles it gracefully
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Test if service is still responsive by sending a valid request
		await publishRequest("list", {});
		const response = await waitForResponse("listResponse", 10000);

		const success = response && response.operationType === "listResponse";
		testResults.push({
			test: "Malformed JSON handling",
			success,
			details: { serviceResponsive: success },
		});
		console.log(
			`   Result: ${success ? "✅ Service handled gracefully" : "❌ Service crashed"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Malformed JSON handling",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 2: Missing operationType
	try {
		console.log("\n2️⃣ Testing message with missing operationType...");

		const payload = JSON.stringify({
			// operationType missing
			data: {
				productId: "test-product",
				certificateId: "ISCC-CORSIA-Cert-US201-2440920252",
			},
		});

		await pubSubClient.topic(REQUEST_TOPIC).publishMessage({
			data: Buffer.from(payload),
		});

		// Wait and check if service is still responsive
		await new Promise((resolve) => setTimeout(resolve, 2000));

		await publishRequest("list", {});
		const response = await waitForResponse("listResponse", 10000);

		const success = response && response.operationType === "listResponse";
		testResults.push({
			test: "Missing operationType",
			success,
			details: { serviceResponsive: success },
		});
		console.log(
			`   Result: ${success ? "✅ Handled gracefully" : "❌ Service crashed"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Missing operationType",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 3: Invalid operationType
	try {
		console.log("\n3️⃣ Testing invalid operationType...");

		await publishRequest("invalidOperation", { productId: "test" });

		// Should not receive a response for invalid operation
		// Wait a reasonable time and check if service is still responsive
		await new Promise((resolve) => setTimeout(resolve, 3000));

		await publishRequest("list", {});
		const response = await waitForResponse("listResponse", 10000);

		const success = response && response.operationType === "listResponse";
		testResults.push({
			test: "Invalid operationType",
			success,
			details: { serviceResponsive: success },
		});
		console.log(
			`   Result: ${success ? "✅ Handled gracefully" : "❌ Service crashed"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Invalid operationType",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 4: Empty message
	try {
		console.log("\n4️⃣ Testing empty message...");

		await pubSubClient.topic(REQUEST_TOPIC).publishMessage({
			data: Buffer.from(""),
		});

		// Wait and check if service is still responsive
		await new Promise((resolve) => setTimeout(resolve, 2000));

		await publishRequest("list", {});
		const response = await waitForResponse("listResponse", 10000);

		const success = response && response.operationType === "listResponse";
		testResults.push({
			test: "Empty message",
			success,
			details: { serviceResponsive: success },
		});
		console.log(
			`   Result: ${success ? "✅ Handled gracefully" : "❌ Service crashed"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Empty message",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 5: Extremely long productId
	try {
		console.log("\n5️⃣ Testing extremely long productId...");

		const longProductId = "a".repeat(1000);
		await publishRequest("upload", {
			productId: longProductId,
			file: fileBase64,
			certificateId: "ISCC-CORSIA-Cert-US201-2440920252",
		});
		const response = await waitForResponse("uploadResponse", 20000);

		// Should either succeed or fail gracefully, not crash
		const success = response && typeof response.status === "boolean";
		testResults.push({
			test: "Extremely long productId",
			success,
			details: {
				status: response?.status,
				productIdLength: longProductId.length,
			},
		});
		console.log(
			`   Result: ${success ? "✅ Handled gracefully" : "❌ Unexpected response"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Extremely long productId",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 6: Special characters in productId
	try {
		console.log("\n6️⃣ Testing special characters in productId...");

		const specialProductId = "test-product-!@#$%^&*()_+-=[]{}|;':\",./<>?";
		await publishRequest("upload", {
			productId: specialProductId,
			file: fileBase64,
			certificateId: "ISCC-CORSIA-Cert-US201-2440920252",
		});
		const response = await waitForResponse("uploadResponse", 20000);

		const success = response && typeof response.status === "boolean";
		testResults.push({
			test: "Special characters in productId",
			success,
			details: {
				status: response?.status,
				productId: specialProductId,
			},
		});
		console.log(
			`   Result: ${success ? "✅ Handled gracefully" : "❌ Unexpected response"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Special characters in productId",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 7: Unicode characters in productId
	try {
		console.log("\n7️⃣ Testing Unicode characters in productId...");

		const unicodeProductId = "test-product-🏭-📋-🔍-✅";
		await publishRequest("upload", {
			productId: unicodeProductId,
			file: fileBase64,
			certificateId: "ISCC-CORSIA-Cert-US201-2440920252",
		});
		const response = await waitForResponse("uploadResponse", 20000);

		const success = response && typeof response.status === "boolean";
		testResults.push({
			test: "Unicode characters in productId",
			success,
			details: {
				status: response?.status,
				productId: unicodeProductId,
			},
		});
		console.log(
			`   Result: ${success ? "✅ Handled gracefully" : "❌ Unexpected response"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Unicode characters in productId",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 8: Null values in request
	try {
		console.log("\n8️⃣ Testing null values in request...");

		await publishRequest("upload", {
			productId: null,
			file: null,
			certificateId: null,
		});
		const response = await waitForResponse("uploadResponse", 20000);

		const success = response && response.status === false;
		testResults.push({
			test: "Null values in request",
			success,
			details: { status: response?.status },
		});
		console.log(
			`   Result: ${success ? "✅ Correctly rejected" : "❌ Unexpectedly accepted"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Null values in request",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 9: Very large file data (simulate)
	try {
		console.log("\n9️⃣ Testing very large file data...");

		// Create a large base64 string (simulate large file)
		const largeFileData = fileBase64.repeat(100); // Make it 100x larger
		const largeProductId = "test-large-file";

		await publishRequest("upload", {
			productId: largeProductId,
			file: largeFileData,
			certificateId: "ISCC-CORSIA-Cert-US201-2440920252",
		});
		const response = await waitForResponse("uploadResponse", 30000);

		const success = response && typeof response.status === "boolean";
		testResults.push({
			test: "Very large file data",
			success,
			details: {
				status: response?.status,
				dataSize: largeFileData.length,
			},
		});
		console.log(
			`   Result: ${success ? "✅ Handled gracefully" : "❌ Unexpected response"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Very large file data",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 10: Concurrent requests to same product
	try {
		console.log("\n🔟 Testing concurrent requests to same product...");

		const concurrentProductId = "test-concurrent";
		const concurrentRequests = [];

		// Send 5 upload requests simultaneously
		for (let i = 0; i < 5; i++) {
			concurrentRequests.push(
				publishRequest("upload", {
					productId: concurrentProductId,
					file: fileBase64,
					certificateId: "ISCC-CORSIA-Cert-US201-2440920252",
				}),
			);
		}

		// Wait for all to be published
		await Promise.all(concurrentRequests);
		console.log("   Published 5 concurrent requests");

		// Wait for responses
		const responses = [];
		for (let i = 0; i < 5; i++) {
			try {
				const response = await waitForResponse("uploadResponse", 20000);
				responses.push(response);
			} catch (error) {
				responses.push({ error: error.message });
			}
		}

		const success =
			responses.length === 5 &&
			responses.every((r) => typeof r.status === "boolean");

		testResults.push({
			test: "Concurrent requests to same product",
			success,
			details: {
				responsesReceived: responses.length,
				allValidResponses: success,
			},
		});
		console.log(
			`   Result: ${success ? "✅ Handled gracefully" : "❌ Some requests failed"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Concurrent requests to same product",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 11: Service responsiveness check
	try {
		console.log("\n1️⃣1️⃣ Testing overall service responsiveness...");

		await publishRequest("list", {});
		const response = await waitForResponse("listResponse", 10000);

		const success =
			response &&
			response.operationType === "listResponse" &&
			Array.isArray(response.productIds);

		testResults.push({
			test: "Service responsiveness",
			success,
			details: {
				operationType: response?.operationType,
				hasProductIds: Array.isArray(response?.productIds),
			},
		});
		console.log(
			`   Result: ${success ? "✅ Service responsive" : "❌ Service unresponsive"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Service responsiveness",
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
testEdgeCases()
	.then((success) => {
		console.log("\n🏁 Edge cases tests completed");
		process.exit(success ? 0 : 1);
	})
	.catch((error) => {
		console.error("\n💥 Test suite failed:", error);
		process.exit(1);
	});
