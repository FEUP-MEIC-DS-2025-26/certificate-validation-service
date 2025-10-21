import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "path";
import fs from 'fs';

const PROTO_PATH = path.join(process.cwd(), "proto", "user.proto");


const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
	keepCase: true,
	longs: String,
	enums: String,
	defaults: true,
	oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const userProto = protoDescriptor.user as any;


const client = new userProto.UserService(
	"localhost:50051",
	grpc.credentials.createInsecure()
);

console.log("🔌 Client connected with server!\n");

/*
console.log("1️⃣ Testing GetUser (id: 1)...");
client.GetUser({ id: "1" }, (error: any, user: any) => {
	if (error) {
		console.error("❌ Error:", error.message);
	} else {
		console.log("✅ User Found:", user);
	}
	console.log("");


	console.log("2️⃣ Testing CreateUser...");
	client.CreateUser(
		{ name: "Pedro Costa", email: "pedro@example.com" },
		(error: any, user: any) => {
			if (error) {
				console.error("❌ Error:", error.message);
			} else {
				console.log("✅ User Created:", user);
			}
			console.log("");


			console.log("3️⃣ Testing ListUsers...");
			client.ListUsers({}, (error: any, response: any) => {
				if (error) {
					console.error("❌ Error:", error.message);
				} else {
					console.log("✅ Users List:");
					response.users.forEach((user: any, index: number) => {
						console.log(`   ${index + 1}. ${user.name} (${user.email})`);
					});
				}


				process.exit(0);
			});
		}
	);
});
*/

console.log("1️⃣ Sending certificate...\n");
const certificate = fs.readFileSync('test_to_send/spiderweb.pdf')
client.UploadCertificate({productId: Math.floor(Math.random() * 1000), file: certificate}, (error: any, response: any) => {
	if (error) {
		console.error("❌ Error:", error.message);
	} else {
		console.log(response.message);
	}
});
