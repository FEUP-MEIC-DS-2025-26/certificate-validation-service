import { Elysia } from '../deps.ts';
import { UserService } from '../services/user.service.ts';

export const UserController = new Elysia({ prefix: '/users' })
	.get('/', () => UserService.getAll())
	.get('/:id', ({ params }) => {
		const user = UserService.getById(Number(params.id));
		return user ?? { error: 'User not found' };
	})
	.post('/', ({ body }) => {
		if (!body.name) return { error: 'Name is required' };
		return UserService.create(body.name);
	})
	.delete('/:id', ({ params }) => {
		const deleted = UserService.delete(Number(params.id));
		return deleted
			? { message: 'User deleted successfully' }
			: { error: 'User not found' };
	});

