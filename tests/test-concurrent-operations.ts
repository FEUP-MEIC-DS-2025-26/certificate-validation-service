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
	return messageId;
}

function waitForResponse(
	expectedType: string,
	timeoutMs: number = 20000,
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

			setTimeout(checkQueue, 100);
		};

		console.log(`⏳ Waiting for ${expectedType} response...`);
		checkQueue();
	});
}

async function testConcurrentOperations() {
	console.log("🧪 Testing Concurrent Operations\n");

	const file = fs.readFileSync("test_to_send/spiderweb.pdf");
	const fileBase64 = file.toString("base64");

	const testResults: Array<{ test: string; success: boolean; details?: any }> =
		[];

	// Test 1: Concurrent uploads to different products
	try {
		console.log("1️⃣ Testing concurrent uploads to different products...");

		const concurrentCount = 10;
		const uploadPromises = [];
		const productIds = [];

		// Create multiple upload promises
		for (let i = 0; i < concurrentCount; i++) {
			const productId = `concurrent-upload-${i}`;
			productIds.push(productId);

			uploadPromises.push(
				publishRequest("upload", {
					productId,
					file: fileBase64,
					certificateId:
						i % 2 === 0
							? "ISCC-CORSIA-Cert-US201-2440920252"
							: "EU-ISCC-Cert-ES216-20254133",
				}),
			);
		}

		// Publish all requests concurrently
		const messageIds = await Promise.all(uploadPromises);
		console.log(`   Published ${messageIds.length} concurrent upload requests`);

		// Wait for all responses
		const uploadResponses = [];
		for (let i = 0; i < concurrentCount; i++) {
			try {
				const response = await waitForResponse("uploadResponse", 25000);
				uploadResponses.push(response);
			} catch (error) {
				uploadResponses.push({ error: error.message });
			}
		}

		const successCount = uploadResponses.filter(
			(r) => r.status === true,
		).length;
		const success = successCount === concurrentCount;

		testResults.push({
			test: "Concurrent uploads to different products",
			success,
			details: {
				totalRequests: concurrentCount,
				successfulUploads: successCount,
				failedUploads: concurrentCount - successCount,
			},
		});
		console.log(
			`   Result: ${success ? "✅ All succeeded" : "❌ Some failed"} (${successCount}/${concurrentCount})`,
		);
	} catch (error) {
		testResults.push({
			test: "Concurrent uploads to different products",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 2: Concurrent uploads to same product
	try {
		console.log("\n2️⃣ Testing concurrent uploads to same product...");

		const concurrentCount = 5;
		const productId = "concurrent-same-product";
		const uploadPromises = [];

		// Create multiple upload promises for same product
		for (let i = 0; i < concurrentCount; i++) {
			uploadPromises.push(
				publishRequest("upload", {
					productId,
					file: fileBase64,
					certificateId: "ISCC-CORSIA-Cert-US201-2440920252",
				}),
			);
		}

		// Publish all requests concurrently
		const messageIds = await Promise.all(uploadPromises);
		console.log(
			`   Published ${messageIds.length} concurrent upload requests to same product`,
		);

		// Wait for all responses
		const uploadResponses = [];
		for (let i = 0; i < concurrentCount; i++) {
			try {
				const response = await waitForResponse("uploadResponse", 25000);
				uploadResponses.push(response);
			} catch (error) {
				uploadResponses.push({ error: error.message });
			}
		}

		const successCount = uploadResponses.filter(
			(r) => r.status === true,
		).length;
		const success = successCount >= 1; // At least one should succeed

		testResults.push({
			test: "Concurrent uploads to same product",
			success,
			details: {
				totalRequests: concurrentCount,
				successfulUploads: successCount,
				failedUploads: concurrentCount - successCount,
			},
		});
		console.log(
			`   Result: ${success ? "✅ Some succeeded" : "❌ All failed"} (${successCount}/${concurrentCount})`,
		);
	} catch (error) {
		testResults.push({
			test: "Concurrent uploads to same product",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 3: Mixed concurrent operations
	try {
		console.log("\n3️⃣ Testing mixed concurrent operations...");

		const operations = [];
		const expectedResponses = [];

		// Create a mix of different operations
		for (let i = 0; i < 8; i++) {
			if (i % 3 === 0) {
				// Upload operation
				const productId = `mixed-upload-${i}`;
				operations.push(
					publishRequest("upload", {
						productId,
						file: fileBase64,
						certificateId: "ISCC-CORSIA-Cert-US201-2440920252",
					}),
				);
				expectedResponses.push("uploadResponse");
			} else if (i % 3 === 1) {
				// List operation
				operations.push(publishRequest("list", {}));
				expectedResponses.push("listResponse");
			} else {
				// List product certificates operation
				const productId = `mixed-list-${i}`;
				operations.push(
					publishRequest("listProductCertificates", { productId }),
				);
				expectedResponses.push("listProductCertificatesResponse");
			}
		}

		// Execute all operations concurrently
		const messageIds = await Promise.all(operations);
		console.log(
			`   Published ${messageIds.length} mixed concurrent operations`,
		);

		// Wait for all responses
		const responses = [];
		for (const expectedType of expectedResponses) {
			try {
				const response = await waitForResponse(expectedType, 25000);
				responses.push(response);
			} catch (error) {
				responses.push({ error: error.message, expectedType });
			}
		}

		const successCount = responses.filter((r) => !r.error).length;
		const success = successCount >= expectedResponses.length * 0.8; // At least 80% should succeed

		testResults.push({
			test: "Mixed concurrent operations",
			success,
			details: {
				totalOperations: expectedResponses.length,
				successfulOperations: successCount,
				failedOperations: expectedResponses.length - successCount,
			},
		});
		console.log(
			`   Result: ${success ? "✅ Most succeeded" : "❌ Many failed"} (${successCount}/${expectedResponses.length})`,
		);
	} catch (error) {
		testResults.push({
			test: "Mixed concurrent operations",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 4: Concurrent list operations
	try {
		console.log("\n4️⃣ Testing concurrent list operations...");

		const concurrentCount = 15;
		const listPromises = [];

		// Create multiple list promises
		for (let i = 0; i < concurrentCount; i++) {
			if (i % 2 === 0) {
				// List all products
				listPromises.push(publishRequest("list", {}));
			} else {
				// List specific product
				const productId = `list-concurrent-${i}`;
				listPromises.push(
					publishRequest("listProductCertificates", { productId }),
				);
			}
		}

		// Execute all list operations concurrently
		const messageIds = await Promise.all(listPromises);
		console.log(`   Published ${messageIds.length} concurrent list operations`);

		// Wait for all responses
		const responses = [];
		for (let i = 0; i < concurrentCount; i++) {
			const expectedType =
				i % 2 === 0 ? "listResponse" : "listProductCertificatesResponse";
			try {
				const response = await waitForResponse(expectedType, 20000);
				responses.push(response);
			} catch (error) {
				responses.push({ error: error.message, expectedType });
			}
		}

		const successCount = responses.filter((r) => !r.error).length;
		const success = successCount === concurrentCount;

		testResults.push({
			test: "Concurrent list operations",
			success,
			details: {
				totalOperations: concurrentCount,
				successfulOperations: successCount,
				failedOperations: concurrentCount - successCount,
			},
		});
		console.log(
			`   Result: ${success ? "✅ All succeeded" : "❌ Some failed"} (${successCount}/${concurrentCount})`,
		);
	} catch (error) {
		testResults.push({
			test: "Concurrent list operations",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 5: Stress test - high volume concurrent operations
	try {
		console.log("\n5️⃣ Testing high volume concurrent operations...");

		const highVolumeCount = 25;
		const operations = [];
		const expectedResponses = [];

		// Create a high volume of operations
		for (let i = 0; i < highVolumeCount; i++) {
			const operationType = i % 4;
			if (operationType === 0) {
				// Upload
				const productId = `stress-upload-${i}`;
				operations.push(
					publishRequest("upload", {
						productId,
						file: fileBase64,
						certificateId: "ISCC-CORSIA-Cert-US201-2440920252",
					}),
				);
				expectedResponses.push("uploadResponse");
			} else if (operationType === 1) {
				// List all
				operations.push(publishRequest("list", {}));
				expectedResponses.push("listResponse");
			} else if (operationType === 2) {
				// List product
				const productId = `stress-list-${i}`;
				operations.push(
					publishRequest("listProductCertificates", { productId }),
				);
				expectedResponses.push("listProductCertificatesResponse");
			} else {
				// Upload with different cert
				const productId = `stress-upload-alt-${i}`;
				operations.push(
					publishRequest("upload", {
						productId,
						file: fileBase64,
						certificateId: "EU-ISCC-Cert-ES216-20254133",
					}),
				);
				expectedResponses.push("uploadResponse");
			}
		}

		// Execute all operations concurrently
		const startTime = Date.now();
		const messageIds = await Promise.all(operations);
		console.log(
			`   Published ${messageIds.length} high volume concurrent operations`,
		);

		// Wait for all responses with extended timeout
		const responses = [];
		for (const expectedType of expectedResponses) {
			try {
				const response = await waitForResponse(expectedType, 35000);
				responses.push(response);
			} catch (error) {
				responses.push({ error: error.message, expectedType });
			}
		}
		const endTime = Date.now();

		const successCount = responses.filter((r) => !r.error).length;
		const successRate = successCount / expectedResponses.length;
		const totalTime = endTime - startTime;
		const success = successRate >= 0.8; // At least 80% success rate

		testResults.push({
			test: "High volume concurrent operations",
			success,
			details: {
				totalOperations: expectedResponses.length,
				successfulOperations: successCount,
				failedOperations: expectedResponses.length - successCount,
				successRate: Math.round(successRate * 100),
				totalTimeMs: totalTime,
				avgTimePerOp: Math.round(totalTime / expectedResponses.length),
			},
		});
		console.log(
			`   Result: ${success ? "✅ Good success rate" : "❌ Poor success rate"} (${successCount}/${expectedResponses.length}, ${Math.round(successRate * 100)}%)`,
		);
		console.log(
			`   Total time: ${totalTime}ms, Avg per operation: ${Math.round(totalTime / expectedResponses.length)}ms`,
		);
	} catch (error) {
		testResults.push({
			test: "High volume concurrent operations",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 6: Race condition test - upload and delete same product
	try {
		console.log("\n6️⃣ Testing race conditions (upload/delete same product)...");

		const productId = "race-condition-test";
		const operations = [];

		// Upload certificate
		operations.push(
			publishRequest("upload", {
				productId,
				file: fileBase64,
				certificateId: "ISCC-CORSIA-Cert-US201-2440920252",
			}),
		);

		// Wait a bit for upload to complete
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Get the certificate ID
		await publishRequest("listProductCertificates", { productId });
		const listResponse = await waitForResponse(
			"listProductCertificatesResponse",
			15000,
		);

		if (listResponse.certificates && listResponse.certificates.length > 0) {
			const certId = listResponse.certificates[0].id;

			// Create multiple delete operations for the same certificate
			for (let i = 0; i < 3; i++) {
				operations.push(
					publishRequest("deleteProductCertificate", {
						productId,
						certificateId: certId,
					}),
				);
			}
		}

		// Execute all operations
		const messageIds = await Promise.all(operations);
		console.log(
			`   Published ${messageIds.length} race condition test operations`,
		);

		// Wait for responses
		const responses = [];
		for (let i = 0; i < operations.length; i++) {
			const expectedType =
				i === 0 ? "uploadResponse" : "deleteProductCertificateResponse";
			try {
				const response = await waitForResponse(expectedType, 20000);
				responses.push(response);
			} catch (error) {
				responses.push({ error: error.message, expectedType });
			}
		}

		const uploadSuccess = responses[0]?.status === true;
		const deleteSuccesses = responses
			.slice(1)
			.filter((r) => r.status === true).length;
		const success =
			uploadSuccess && (deleteSuccesses === 1 || deleteSuccesses === 0); // Should be 1 or 0 successful deletes

		testResults.push({
			test: "Race condition test",
			success,
			details: {
				uploadSuccess,
				deleteSuccesses,
				totalDeleteAttempts: responses.length - 1,
			},
		});
		console.log(
			`   Result: ${success ? "✅ Handled gracefully" : "❌ Unexpected behavior"} (Upload: ${uploadSuccess}, Deletes: ${deleteSuccesses})`,
		);
	} catch (error) {
		testResults.push({
			test: "Race condition test",
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
testConcurrentOperations()
	.then((success) => {
		console.log("\n🏁 Concurrent operations tests completed");
		process.exit(success ? 0 : 1);
	})
	.catch((error) => {
		console.error("\n💥 Test suite failed:", error);
		process.exit(1);
	});
