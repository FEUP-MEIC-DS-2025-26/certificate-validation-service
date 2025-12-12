#!/usr/bin/env bun

/**
 * Simple test runner for certificate validation service
 * Usage: bun run-simple-test.ts [test-name]
 *
 * Available tests:
 * - upload-valid
 * - upload-invalid
 * - list-operations
 * - delete-operations
 * - edge-cases
 * - concurrent-operations
 * - all
 */

const testFiles = {
	"upload-valid": "test-upload-valid.ts",
	"upload-invalid": "test-upload-invalid.ts",
	"list-operations": "test-list-operations.ts",
	"delete-operations": "test-delete-operations.ts",
	"edge-cases": "test-edge-cases.ts",
	"concurrent-operations": "test-concurrent-operations.ts",
};

function runTest(testFile: string): Promise<number> {
	return new Promise((resolve) => {
		console.log(`🧪 Running test: ${testFile}`);
		console.log("─".repeat(50));

		const testProcess = spawn("bun", ["run", `tests/${testFile}`], {
			stdio: "inherit",
			env: {
				...process.env,
				USE_MOCK_STORAGE: "true",
			},
		});

		testProcess.on("close", (code: number) => {
			console.log("─".repeat(50));
			console.log(`✅ Test completed with exit code: ${code}`);
			resolve(code);
		});

		testProcess.on("error", (error: Error) => {
			console.error("❌ Test failed to start:", error.message);
			resolve(1);
		});
	});
}

async function runAllTests(): Promise<number> {
	console.log("🎯 Running all tests sequentially...");

	const testNames = Object.keys(testFiles);
	let totalPassed = 0;
	const totalTests = testNames.length;

	for (const testName of testNames) {
		const testFile = testFiles[testName as keyof typeof testFiles];
		const exitCode = await runTest(testFile);

		if (exitCode === 0) {
			totalPassed++;
		}

		// Wait between tests
		if (testName !== testNames[testNames.length - 1]) {
			console.log("⏳ Waiting 3 seconds before next test...");
			await new Promise((resolve) => setTimeout(resolve, 3000));
		}
	}

	console.log(`\n${"=".repeat(50)}`);
	console.log("📊 FINAL RESULTS");
	console.log("=".repeat(50));
	console.log(`✅ Passed: ${totalPassed}/${totalTests}`);
	console.log(`❌ Failed: ${totalTests - totalPassed}/${totalTests}`);
	console.log(
		`📈 Success Rate: ${Math.round((totalPassed / totalTests) * 100)}%`,
	);

	if (totalPassed === totalTests) {
		console.log("🎉 ALL TESTS PASSED!");
		return 0;
	} else {
		console.log("⚠️ Some tests failed");
		return 1;
	}
}

// Main execution
async function main() {
	const testName = process.argv[2];

	if (!testName) {
		console.log("📋 Available tests:");
		Object.keys(testFiles).forEach((name) => {
			console.log(`   - ${name}`);
		});
		console.log("   - all (run all tests)");
		console.log("\nUsage: bun run-simple-test.ts <test-name>");
		process.exit(1);
	}

	if (testName === "all") {
		const exitCode = await runAllTests();
		process.exit(exitCode);
	}

	const testFile = testFiles[testName as keyof typeof testFiles];
	if (!testFile) {
		console.error(`❌ Unknown test: ${testName}`);
		console.log("Available tests:", Object.keys(testFiles).join(", "));
		process.exit(1);
	}

	const exitCode = await runTest(testFile);
	process.exit(exitCode);
}

// Import spawn for child process execution
import { spawn } from "node:child_process";

main().catch((error) => {
	console.error("💥 Fatal error:", error);
	process.exit(1);
});
