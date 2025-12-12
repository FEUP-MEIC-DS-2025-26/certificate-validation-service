import { Firestore } from "@google-cloud/firestore";
import dotenv from "dotenv";

dotenv.config();

const PROJECT_ID = process.env.PROJECT_ID || "test-project";
const firestore = new Firestore({ projectId: PROJECT_ID });

async function testFirestore() {
	console.log("🔥 Testing Firestore connectivity...");

	try {
		// Test basic connectivity
		const testDoc = {
			test: true,
			timestamp: new Date().toISOString(),
		};

		console.log("📝 Writing test document...");
		await firestore.collection("test").doc("test").set(testDoc);
		console.log("✅ Write successful");

		console.log("📖 Reading test document...");
		const doc = await firestore.collection("test").doc("test").get();
		console.log("✅ Read successful:", doc.data());

		console.log("🗑️ Cleaning up test document...");
		await firestore.collection("test").doc("test").delete();
		console.log("✅ Delete successful");
	} catch (error) {
		console.error("❌ Firestore error:", error);
	}
}

testFirestore().catch(console.error);
