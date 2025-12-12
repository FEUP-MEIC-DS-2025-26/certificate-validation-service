import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

interface TestResult {
	name: string;
	success: boolean;
	duration: number;
	error?: string;
	details?: any;
}

interface TestSuite {
	name: string;
	file: string;
	description: string;
}

class TestRunner {
	private serviceProcess: any = null;
	private testResults: TestResult[] = [];
	private startTime: number = 0;

	private testSuites: TestSuite[] = [
		{
			name: "Upload Valid Certificates",
			file: "test-upload-valid.ts",
			description: "Test upload operations with valid certificate IDs",
		},
		{
			name: "Upload Invalid Certificates",
			file: "test-upload-invalid.ts",
			description:
				"Test upload operations with invalid certificate IDs and malformed data",
		},
		{
			name: "List Operations",
			file: "test-list-operations.ts",
			description:
				"Test list operations for all products and specific products",
		},
		{
			name: "Delete Operations",
			file: "test-delete-operations.ts",
			description: "Test deleteProductCertificate operations",
		},
		{
			name: "Edge Cases",
			file: "test-edge-cases.ts",
			description: "Test edge cases and error handling scenarios",
		},
		{
			name: "Concurrent Operations",
			file: "test-concurrent-operations.ts",
			description: "Test concurrent operations and race conditions",
		},
	];

	async startService(): Promise<boolean> {
		console.log("🚀 Starting certificate validation service...");

		return new Promise((resolve) => {
			// Set environment for mock storage to avoid interfering with production data
			const env = {
				...process.env,
				USE_MOCK_STORAGE: "true",
				PORT: "8081", // Use different port to avoid conflicts
			};

			this.serviceProcess = spawn("bun", ["run", "server.ts"], {
				cwd: process.cwd(),
				env: env,
				stdio: ["pipe", "pipe", "pipe"],
			});

			let _serviceOutput = "";
			let _serviceError = "";

			this.serviceProcess.stdout.on("data", (data: Buffer) => {
				const output = data.toString();
				_serviceOutput += output;
				console.log(`[SERVICE] ${output.trim()}`);

				// Check if service is ready
				if (
					output.includes("HTTP server listening") ||
					output.includes("Server listening for messages")
				) {
					console.log("✅ Service started successfully");
					resolve(true);
				}
			});

			this.serviceProcess.stderr.on("data", (data: Buffer) => {
				const output = data.toString();
				_serviceError += output;
				console.error(`[SERVICE ERROR] ${output.trim()}`);
			});

			this.serviceProcess.on("error", (error: Error) => {
				console.error("❌ Failed to start service:", error.message);
				resolve(false);
			});

			this.serviceProcess.on("exit", (code: number) => {
				if (code !== 0) {
					console.error(`❌ Service exited with code ${code}`);
					resolve(false);
				}
			});

			// Timeout after 30 seconds
			setTimeout(() => {
				console.error("❌ Service startup timeout");
				resolve(false);
			}, 30000);
		});
	}

	async stopService(): Promise<void> {
		if (this.serviceProcess) {
			console.log("🛑 Stopping service...");
			this.serviceProcess.kill("SIGTERM");

			// Wait a bit for graceful shutdown
			await new Promise((resolve) => setTimeout(resolve, 5000));

			// Force kill if still running
			if (this.serviceProcess && !this.serviceProcess.killed) {
				this.serviceProcess.kill("SIGKILL");
			}

			console.log("✅ Service stopped");
		}
	}

	async runTest(testSuite: TestSuite): Promise<TestResult> {
		const startTime = Date.now();
		console.log(`\n🧪 Running: ${testSuite.name}`);
		console.log(`📝 ${testSuite.description}`);
		console.log(`📁 File: ${testSuite.file}`);
		console.log("─".repeat(60));

		try {
			// Check if test file exists
			const testFilePath = path.join("tests", testSuite.file);
			if (!fs.existsSync(testFilePath)) {
				throw new Error(`Test file not found: ${testFilePath}`);
			}

			// Run the test
			const result = await this.executeTest(testFilePath);
			const duration = Date.now() - startTime;

			return {
				name: testSuite.name,
				success: result.success,
				duration,
				error: result.error,
				details: result.details,
			};
		} catch (error) {
			const duration = Date.now() - startTime;
			return {
				name: testSuite.name,
				success: false,
				duration,
				error: error.message,
			};
		}
	}

	async executeTest(
		testFilePath: string,
	): Promise<{ success: boolean; error?: string; details?: any }> {
		return new Promise((resolve) => {
			const testProcess = spawn("bun", ["run", testFilePath], {
				cwd: process.cwd(),
				stdio: ["pipe", "pipe", "pipe"],
				env: {
					...process.env,
					USE_MOCK_STORAGE: "true",
				},
			});

			let output = "";
			let errorOutput = "";

			testProcess.stdout.on("data", (data: Buffer) => {
				const text = data.toString();
				output += text;
				process.stdout.write(text);
			});

			testProcess.stderr.on("data", (data: Buffer) => {
				const text = data.toString();
				errorOutput += text;
				process.stderr.write(`[TEST ERROR] ${text}`);
			});

			testProcess.on("close", (code: number) => {
				const success = code === 0;

				// Extract test details from output if possible
				let details = null;
				if (
					output.includes("Test Summary:") ||
					output.includes("Overall Result:")
				) {
					try {
						const summaryMatch = output.match(
							/Overall Result: (\d+)\/(\d+) tests passed/,
						);
						if (summaryMatch) {
							details = {
								passed: parseInt(summaryMatch[1], 10),
								total: parseInt(summaryMatch[2], 10),
								successRate: Math.round(
									(parseInt(summaryMatch[1], 10) /
										parseInt(summaryMatch[2], 10)) *
										100,
								),
							};
						}
					} catch (_e) {
						// Ignore parsing errors
					}
				}

				resolve({
					success,
					error: success
						? undefined
						: errorOutput || `Test exited with code ${code}`,
					details,
				});
			});

			testProcess.on("error", (error: Error) => {
				resolve({
					success: false,
					error: error.message,
				});
			});

			// Timeout after 5 minutes
			setTimeout(() => {
				testProcess.kill("SIGKILL");
				resolve({
					success: false,
					error: "Test timeout (5 minutes)",
				});
			}, 300000);
		});
	}

	async runAllTests(): Promise<void> {
		this.startTime = Date.now();

		console.log("🎯 Certificate Validation Service - Comprehensive Test Suite");
		console.log(`📅 Started at: ${new Date().toISOString()}`);
		console.log(`🧪 Total test suites: ${this.testSuites.length}`);
		console.log("=".repeat(80));

		// Start the service
		const serviceStarted = await this.startService();
		if (!serviceStarted) {
			console.error("❌ Failed to start service. Aborting tests.");
			process.exit(1);
		}

		// Wait a bit for service to be fully ready
		console.log("⏳ Waiting for service to be fully ready...");
		await new Promise((resolve) => setTimeout(resolve, 5000));

		// Run all test suites
		for (const testSuite of this.testSuites) {
			const result = await this.runTest(testSuite);
			this.testResults.push(result);

			// Wait between tests to avoid interference
			console.log("⏳ Waiting between tests...");
			await new Promise((resolve) => setTimeout(resolve, 3000));
		}

		// Stop the service
		await this.stopService();

		// Generate final report
		this.generateReport();
	}

	generateReport(): void {
		const totalDuration = Date.now() - this.startTime;
		const passedTests = this.testResults.filter((r) => r.success).length;
		const totalTests = this.testResults.length;
		const successRate = Math.round((passedTests / totalTests) * 100);

		console.log(`\n${"=".repeat(80)}`);
		console.log("📊 FINAL TEST REPORT");
		console.log("=".repeat(80));

		console.log(`⏱️  Total Duration: ${Math.round(totalDuration / 1000)}s`);
		console.log(
			`🧪 Test Suites: ${passedTests}/${totalTests} passed (${successRate}%)`,
		);

		console.log("\n📋 Detailed Results:");
		this.testResults.forEach((result, index) => {
			const status = result.success ? "✅" : "❌";
			const duration = Math.round(result.duration / 1000);
			console.log(`${index + 1}. ${status} ${result.name} (${duration}s)`);

			if (!result.success) {
				console.log(`   Error: ${result.error}`);
			}

			if (result.details) {
				console.log(`   Details: ${JSON.stringify(result.details)}`);
			}
		});

		console.log(`\n${"─".repeat(80)}`);

		if (successRate === 100) {
			console.log(
				"🎉 ALL TESTS PASSED! The certificate validation service is working correctly.",
			);
		} else if (successRate >= 80) {
			console.log(
				`⚠️  MOST TESTS PASSED (${successRate}%). Some issues need attention.`,
			);
		} else {
			console.log(
				`❌ MANY TESTS FAILED (${successRate}%). The service has significant issues.`,
			);
		}

		console.log("─".repeat(80));

		// Exit with appropriate code
		if (successRate === 100) {
			console.log("✅ Exiting with success code (0)");
			process.exit(0);
		} else {
			console.log("❌ Exiting with failure code (1)");
			process.exit(1);
		}
	}

	async cleanup(): Promise<void> {
		console.log("🧹 Cleaning up...");
		await this.stopService();
	}
}

// Handle process termination
process.on("SIGINT", async () => {
	console.log("\n🛑 Received SIGINT, cleaning up...");
	const runner = new TestRunner();
	await runner.cleanup();
	process.exit(1);
});

process.on("SIGTERM", async () => {
	console.log("\n🛑 Received SIGTERM, cleaning up...");
	const runner = new TestRunner();
	await runner.cleanup();
	process.exit(1);
});

// Main execution
async function main() {
	const runner = new TestRunner();

	try {
		await runner.runAllTests();
	} catch (error) {
		console.error("💥 Test runner failed:", error);
		await runner.cleanup();
		process.exit(1);
	}
}

// Run if called directly
if (import.meta.main) {
	main().catch((error) => {
		console.error("💥 Fatal error:", error);
		process.exit(1);
	});
}
