export const Type = {
	Object: (shape) => ({ properties: shape?.properties ?? shape ?? {} }),
	String: (opts) => opts ?? {},
	Optional: (inner) => inner,
	Integer: (opts) => opts ?? {},
	Number: (opts) => opts ?? {},
};
