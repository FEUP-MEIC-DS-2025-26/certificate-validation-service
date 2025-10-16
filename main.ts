import { Elysia } from './deps.ts';
import { UserController } from './controller/user.controller.ts';
import { ProductController } from './controller/product.controller.ts';

const app = new Elysia()
	.get('/', () => ({ message: 'Welcome to Elysia + Deno 👋' }))
	.use(UserController)
	.use(ProductController)
	.listen(8080);

console.log(`🚀 Server running at http://localhost:${app.server?.port}`);

