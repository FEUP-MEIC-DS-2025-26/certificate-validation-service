import { Elysia } from '../deps.ts';
import { ProductService } from '../services/product.service.ts';

export const ProductController = new Elysia({ prefix: '/products' })
	.get('/', () => ProductService.getAll())
	.get('/:id', ({ params }) => {
		const product = ProductService.getById(Number(params.id));
		return product ?? { error: 'Product not found' };
	})
	.post('/', ({ body }) => {
		if (!body.name) return { error: 'Name is required' };
		return ProductService.create(body.name);
	});

