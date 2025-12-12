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

async function testDeleteOperations() {
	console.log("🧪 Testing DeleteProductCertificate Operations\n");

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

	// Helper function to get certificates for a product
	async function getProductCertificates(productId: string) {
		await publishRequest("listProductCertificates", { productId });
		const response = await waitForResponse("listProductCertificatesResponse");
		return response;
	}

	// Test 1: Delete existing certificate
	try {
		console.log("1️⃣ Testing delete existing certificate...");

		const productId = "delete-test-product-1";
		const certificateId = "ISCC-CORSIA-Cert-US201-2440920252";

		// First upload a certificate
		console.log("   Uploading test certificate...");
		const uploaded = await uploadTestData(productId, certificateId);
		if (!uploaded) {
			throw new Error("Failed to upload test certificate");
		}

		// Get the certificate ID from the response
		const productCerts = await getProductCertificates(productId);
		if (!productCerts.certificates || productCerts.certificates.length === 0) {
			throw new Error("No certificates found after upload");
		}

		const certToDelete = productCerts.certificates[0];
		console.log(
			`   Deleting certificate ${certToDelete.id} from product ${productId}...`,
		);

		// Delete the certificate
		await publishRequest("deleteProductCertificate", {
			productId,
			certificateId: certToDelete.id,
		});
		const deleteResponse = await waitForResponse(
			"deleteProductCertificateResponse",
		);

		const success =
			deleteResponse.status === true &&
			deleteResponse.productId === productId &&
			deleteResponse.certificateId === certToDelete.id;

		testResults.push({
			test: "Delete existing certificate",
			success,
			details: {
				productId: deleteResponse.productId,
				certificateId: deleteResponse.certificateId,
				status: deleteResponse.status,
			},
		});
		console.log(`   Result: ${success ? "✅ Success" : "❌ Failed"}`);
	} catch (error) {
		testResults.push({
			test: "Delete existing certificate",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 2: Verify certificate was actually deleted
	try {
		console.log("\n2️⃣ Verifying certificate was deleted...");

		const productId = "delete-test-product-1";
		const productCerts = await getProductCertificates(productId);

		const success = productCerts.total === 0;
		testResults.push({
			test: "Verify certificate deletion",
			success,
			details: {
				productId,
				totalCertificates: productCerts.total || 0,
				certificates: productCerts.certificates || [],
			},
		});
		console.log(
			`   Result: ${success ? "✅ Certificate deleted" : "❌ Certificate still exists"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Verify certificate deletion",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 3: Delete non-existent certificate
	try {
		console.log("\n3️⃣ Testing delete non-existent certificate...");

		const productId = "delete-test-product-2";
		const nonExistentCertId = "non-existent-cert-12345";

		// Upload a certificate first
		await uploadTestData(productId, "EU-ISCC-Cert-ES216-20254133");

		// Try to delete a non-existent certificate
		await publishRequest("deleteProductCertificate", {
			productId,
			certificateId: nonExistentCertId,
		});
		const deleteResponse = await waitForResponse(
			"deleteProductCertificateResponse",
		);

		const success = deleteResponse.status === false;
		testResults.push({
			test: "Delete non-existent certificate",
			success,
			details: {
				productId: deleteResponse.productId,
				certificateId: deleteResponse.certificateId,
				status: deleteResponse.status,
			},
		});
		console.log(
			`   Result: ${success ? "✅ Correctly rejected" : "❌ Unexpectedly succeeded"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Delete non-existent certificate",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 4: Delete certificate from non-existent product
	try {
		console.log("\n4️⃣ Testing delete certificate from non-existent product...");

		const nonExistentProductId = "non-existent-product-12345";
		const certId = "some-cert-id";

		await publishRequest("deleteProductCertificate", {
			productId: nonExistentProductId,
			certificateId: certId,
		});
		const deleteResponse = await waitForResponse(
			"deleteProductCertificateResponse",
		);

		const success = deleteResponse.status === false;
		testResults.push({
			test: "Delete from non-existent product",
			success,
			details: {
				productId: deleteResponse.productId,
				certificateId: deleteResponse.certificateId,
				status: deleteResponse.status,
			},
		});
		console.log(
			`   Result: ${success ? "✅ Correctly rejected" : "❌ Unexpectedly succeeded"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Delete from non-existent product",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 5: Delete with missing productId
	try {
		console.log("\n5️⃣ Testing delete with missing productId...");

		await publishRequest("deleteProductCertificate", {
			// productId missing
			certificateId: "some-cert-id",
		});
		const deleteResponse = await waitForResponse(
			"deleteProductCertificateResponse",
		);

		const success = deleteResponse.status === false;
		testResults.push({
			test: "Delete with missing productId",
			success,
			details: {
				productId: deleteResponse.productId,
				certificateId: deleteResponse.certificateId,
				status: deleteResponse.status,
			},
		});
		console.log(
			`   Result: ${success ? "✅ Correctly rejected" : "❌ Unexpectedly succeeded"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Delete with missing productId",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 6: Delete with missing certificateId
	try {
		console.log("\n6️⃣ Testing delete with missing certificateId...");

		await publishRequest("deleteProductCertificate", {
			productId: "some-product-id",
			// certificateId missing
		});
		const deleteResponse = await waitForResponse(
			"deleteProductCertificateResponse",
		);

		const success = deleteResponse.status === false;
		testResults.push({
			test: "Delete with missing certificateId",
			success,
			details: {
				productId: deleteResponse.productId,
				certificateId: deleteResponse.certificateId,
				status: deleteResponse.status,
			},
		});
		console.log(
			`   Result: ${success ? "✅ Correctly rejected" : "❌ Unexpectedly succeeded"}`,
		);
	} catch (error) {
		testResults.push({
			test: "Delete with missing certificateId",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 7: Delete one certificate from product with multiple certificates
	try {
		console.log(
			"\n7️⃣ Testing delete one certificate from product with multiple certificates...",
		);

		const productId = "delete-test-product-multi";

		// Upload multiple certificates
		console.log("   Uploading multiple certificates...");
		await uploadTestData(productId, "ISCC-CORSIA-Cert-US201-2440920252");
		await uploadTestData(productId, "EU-ISCC-Cert-ES216-20254133");

		// Get certificates before deletion
		const beforeCerts = await getProductCertificates(productId);
		const initialCount = beforeCerts.total || 0;

		if (initialCount < 2) {
			throw new Error(
				`Expected at least 2 certificates, found ${initialCount}`,
			);
		}

		// Delete one certificate
		const certToDelete = beforeCerts.certificates[0];
		console.log(`   Deleting certificate ${certToDelete.id}...`);

		await publishRequest("deleteProductCertificate", {
			productId,
			certificateId: certToDelete.id,
		});
		const deleteResponse = await waitForResponse(
			"deleteProductCertificateResponse",
		);

		// Verify one certificate was deleted but others remain
		const afterCerts = await getProductCertificates(productId);
		const finalCount = afterCerts.total || 0;

		const success =
			deleteResponse.status === true &&
			finalCount === initialCount - 1 &&
			!afterCerts.certificates?.some((c: any) => c.id === certToDelete.id);

		testResults.push({
			test: "Delete one from multiple certificates",
			success,
			details: {
				productId,
				initialCount,
				finalCount,
				deletedCertId: certToDelete.id,
				deleteStatus: deleteResponse.status,
			},
		});
		console.log(`   Result: ${success ? "✅ Success" : "❌ Failed"}`);
		console.log(`   Certificates: ${initialCount} → ${finalCount}`);
	} catch (error) {
		testResults.push({
			test: "Delete one from multiple certificates",
			success: false,
			details: { error: error.message },
		});
		console.log(`   Result: ❌ Error - ${error.message}`);
	}

	// Test 8: Delete last certificate from product (should remove product entirely)
	try {
		console.log("\n8️⃣ Testing delete last certificate from product...");

		const productId = "delete-test-product-last";

		// Upload one certificate
		await uploadTestData(productId, "ISCC-CORSIA-Cert-US201-2440920252");

		// Get the certificate and delete it
		const beforeCerts = await getProductCertificates(productId);
		if (beforeCerts.total !== 1) {
			throw new Error(`Expected 1 certificate, found ${beforeCerts.total}`);
		}

		const certToDelete = beforeCerts.certificates[0];

		await publishRequest("deleteProductCertificate", {
			productId,
			certificateId: certToDelete.id,
		});
		const deleteResponse = await waitForResponse(
			"deleteProductCertificateResponse",
		);

		// Verify product no longer exists
		const afterCerts = await getProductCertificates(productId);

		const success = deleteResponse.status === true && afterCerts.total === 0;

		testResults.push({
			test: "Delete last certificate from product",
			success,
			details: {
				productId,
				deleteStatus: deleteResponse.status,
				finalCount: afterCerts.total || 0,
			},
		});
		console.log(`   Result: ${success ? "✅ Success" : "❌ Failed"}`);
	} catch (error) {
		testResults.push({
			test: "Delete last certificate from product",
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
testDeleteOperations()
	.then((success) => {
		console.log("\n🏁 Delete operations tests completed");
		process.exit(success ? 0 : 1);
	})
	.catch((error) => {
		console.error("\n💥 Test suite failed:", error);
		process.exit(1);
	});
