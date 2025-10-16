interface User {
	id: number;
	name: string;
}

let users: User[] = [
	{ id: 1, name: 'Tomás' },
	{ id: 2, name: 'Leite' }
];

export const UserService = {
	getAll: (): User[] => users,

	getById: (id: number): User | undefined =>
		users.find((u) => u.id === id),

	create: (name: string): User => {
		const newUser = { id: users.length + 1, name };
		users.push(newUser);
		return newUser;
	},

	delete: (id: number): boolean => {
		const initialLength = users.length;
		users = users.filter((u) => u.id !== id);
		return users.length < initialLength;
	}
};

