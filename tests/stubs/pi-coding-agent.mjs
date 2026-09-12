export const CONFIG_DIR_NAME = ".omp";

export function getAgentDir() {
	return "/tmp/sol-pi-omp-test-agent";
}

function dummyTool(name) {
	return {
		name,
		label: name,
		description: name,
		parameters: { properties: { path: {} } },
		async execute() {
			return { content: [{ type: "text", text: `${name} ok` }] };
		},
		renderCall() {
			return undefined;
		},
		renderResult() {
			return undefined;
		},
	};
}

export function createEditToolDefinition() {
	return dummyTool("edit");
}

export function createWriteToolDefinition() {
	return dummyTool("write");
}

export function createBashToolDefinition() {
	return dummyTool("bash");
}

// Intentionally no findCutPoint export — this is the OMP 18.1.17 shim surface.
