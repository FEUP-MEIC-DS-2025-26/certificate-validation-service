interface Product {
	id: number;
	name: string;
}

let products: Product[] = [
	{ id: 1, name: 'Laptop' },
	{ id: 2, name: 'Monitor' }
];

export const ProductService = {
	getAll: (): Product[] => products,

	getById: (id: number): Product | undefined =>
		products.find((p) => p.id === id),

	create: (name: string): Product => {
		const newProduct = { id: products.length + 1, name };
		products.push(newProduct);
		return newProduct;
	}
};

