import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { createSolPiOmpExtension, DEFAULT_CONFIG } from "../src/index.ts";
import { hostExportsFindCutPoint } from "../src/optional-mechanisms.ts";
import {
	isProjectTrusted,
	modelRegistryComplete,
	probeHostShim,
	setUiStatus,
} from "../src/host-shim.ts";
import { showSolPiSavings } from "../src/tui.ts";

/**
 * Session-smoke as unit tests. Stub host only — the `omp` CLI is not required
 * and is not invoked when missing.
 */

function ompOnPath(): boolean {
	try {
		execFileSync("omp", ["--version"], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

function stubPi() {
	const tools = [];
	const handlers = {};
	const pi = {
		on(event, handler) {
			handlers[event] = handler;
		},
		registerTool(tool) {
			tools.push(tool.name);
		},
	};
	return { pi, tools, handlers };
}

test("live omp is optional; suite uses the host stub", () => {
	assert.equal(typeof ompOnPath(), "boolean");
});

test("session-smoke: factory constructs when host lacks findCutPoint", async () => {
	assert.equal(await hostExportsFindCutPoint(), false);
	const host = await import("@earendil-works/pi-coding-agent");
	assert.equal("findCutPoint" in host, false);

	const { pi, handlers } = stubPi();
	assert.doesNotThrow(() => createSolPiOmpExtension()(pi));
	assert.equal(typeof handlers.session_start, "function");
});

test("session-smoke: missing modelRegistry.complete / isProjectTrusted / setStatus do not throw at construct or session_start", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "sol-pi-omp-smoke-"));
	const { pi, handlers, tools } = stubPi();
	const factory = createSolPiOmpExtension();
	assert.doesNotThrow(() => factory(pi));

	const ctx = {
		cwd,
		// Intentionally omit isProjectTrusted, modelRegistry, ui.setStatus.
		ui: { notify() {} },
		mode: "tui",
	};

	assert.equal("isProjectTrusted" in ctx, false);
	assert.equal("modelRegistry" in ctx, false);
	assert.equal(typeof ctx.ui.setStatus, "undefined");
	assert.equal(typeof modelRegistryComplete(ctx), "undefined");
	assert.equal(isProjectTrusted(ctx), false);
	assert.deepEqual(probeHostShim(ctx), {
		projectTrusted: false,
		modelRegistryComplete: false,
		uiSetStatus: false,
	});

	await handlers.session_start({}, ctx);
	assert.ok(tools.includes("edit"));
	assert.ok(tools.includes("write"));
	assert.ok(tools.includes("obs_recall"));
});

test("session-smoke: ctx.ui.setStatus missing does not throw when showing savings", () => {
	const ctx = {
		mode: "tui",
		ui: {
			notify() {},
			// no setStatus
		},
	};
	assert.doesNotThrow(() => showSolPiSavings(ctx, "Observation Pack", "session-smoke"));
	assert.equal(setUiStatus(ctx.ui, "sol-pi-savings", "x"), false);
});

test("session-smoke: isProjectTrusted that throws is treated as untrusted", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "sol-pi-omp-trust-"));
	const { pi, handlers } = stubPi();
	createSolPiOmpExtension()(pi);
	const ctx = {
		cwd,
		isProjectTrusted() {
			throw new Error("shim isProjectTrusted exploded");
		},
		modelRegistry: {},
		ui: {},
	};
	assert.equal(isProjectTrusted(ctx), false);
	assert.equal(typeof modelRegistryComplete(ctx), "undefined");
	await handlers.session_start({}, ctx);
});

test("session-smoke: modelRegistry.complete is detected when present and never called at construct", async () => {
	let completeCalls = 0;
	const { pi, handlers } = stubPi();
	createSolPiOmpExtension(() => DEFAULT_CONFIG)(pi);
	const ctx = {
		cwd: mkdtempSync(join(tmpdir(), "sol-pi-omp-complete-")),
		isProjectTrusted: () => true,
		modelRegistry: {
			complete() {
				completeCalls += 1;
				throw new Error("complete must not run at factory construct");
			},
		},
		ui: {
			setStatus() {
				throw new Error("setStatus must not run at factory construct");
			},
		},
	};
	assert.equal(probeHostShim(ctx).modelRegistryComplete, true);
	assert.equal(probeHostShim(ctx).uiSetStatus, true);
	await handlers.session_start({}, ctx);
	assert.equal(completeCalls, 0);
});
