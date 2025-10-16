import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { UserService } from "./services/user.service.ts";
import path from "path";

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

if (!userProto || !userProto.UserService) {
	console.error("❌ Error: UserService not found in .proto file");
	process.exit(1);
}

const userService = new UserService();

const server = new grpc.Server();

server.addService(userProto.UserService.service, {
	GetUser: (call: any, callback: any) => {
		const { id } = call.request;
		console.log(`📥 GetUser request: ${id}`);

		const user = userService.getUser(id);

		if (user) {
			callback(null, user);
		} else {
			callback({
				code: grpc.status.NOT_FOUND,
				message: `User with id ${id} not found`,
			});
		}
	},

	CreateUser: (call: any, callback: any) => {
		const { name, email } = call.request;
		console.log(`📥 CreateUser request: ${name}, ${email}`);

		const user = userService.createUser(name, email);
		callback(null, user);
	},

	ListUsers: (_call: any, callback: any) => {
		console.log(`📥 ListUsers request`);

		const users = userService.listUsers();
		callback(null, { users });
	},
});

const PORT = "0.0.0.0:50051";
server.bindAsync(
	PORT,
	grpc.ServerCredentials.createInsecure(),
	(error, port) => {
		if (error) {
			console.error("❌ Error starting server: ", error);
			process.exit(1);
		}
		console.log(`🚀 Server running on ${PORT}`);
		console.log(`📡 Port: ${port}`);
	}
);
