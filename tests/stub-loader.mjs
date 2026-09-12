import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const stubs = {
	"@earendil-works/pi-coding-agent": join(here, "stubs/pi-coding-agent.mjs"),
	"@earendil-works/pi-tui": join(here, "stubs/pi-tui.mjs"),
	"@earendil-works/pi-agent-core": join(here, "stubs/pi-agent-core.mjs"),
	"@earendil-works/pi-ai": join(here, "stubs/pi-ai.mjs"),
	typebox: join(here, "stubs/typebox.mjs"),
};

export async function resolve(specifier, context, nextResolve) {
	const mapped = stubs[specifier];
	if (mapped) {
		return { url: pathToFileURL(mapped).href, shortCircuit: true };
	}
	return nextResolve(specifier, context);
}
