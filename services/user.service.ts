// services/user.service.ts

interface User {
	id: string;
	name: string;
	email: string;
}

export class UserService {
	private users: Map<string, User> = new Map();

	constructor() {
		// Dados de exemplo
		this.users.set("1", { id: "1", name: "João Silva", email: "joao@example.com" });
		this.users.set("2", { id: "2", name: "Maria Santos", email: "maria@example.com" });
	}

	getUser(id: string): User | undefined {
		return this.users.get(id);
	}

	createUser(name: string, email: string): User {
		const id = crypto.randomUUID();
		const user: User = { id, name, email };
		this.users.set(id, user);
		return user;
	}

	listUsers(): User[] {
		return Array.from(this.users.values());
	}
}
