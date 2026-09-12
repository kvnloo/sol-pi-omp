import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { createSolPiOmpExtension, DEFAULT_CONFIG } from "../src/index.ts";
import {
	mapSettleToCompact,
	OCC_SETTLE_EVENTS,
	registerOnlineContextCompactAdapter,
} from "../src/occ-adapter.ts";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

test("OCC adapter default is off", () => {
	assert.equal(DEFAULT_CONFIG.onlineContextCompact, false);
});

test("OCC adapter does not statically import findCutPoint", () => {
	const files = [];
	const walk = (dir) => {
		for (const name of readdirSync(dir)) {
			const path = join(dir, name);
			if (statSync(path).isDirectory()) walk(path);
			else if (name.endsWith(".ts")) files.push(path);
		}
	};
	walk(join(root, "src"));
	for (const file of files) {
		const text = readFileSync(file, "utf8");
		assert.doesNotMatch(text, /\bimport\s*\{[^}]*\bfindCutPoint\b/, `${file} must not statically import findCutPoint`);
		assert.doesNotMatch(
			text,
			/\bimport\s+findCutPoint\s+from\b/,
			`${file} must not default-import findCutPoint`,
		);
	}
	const adapter = readFileSync(join(root, "src/occ-adapter.ts"), "utf8");
	assert.doesNotMatch(adapter, /\bfindCutPoint\s*\(/);
	assert.doesNotMatch(adapter, /\bfrom\s+["'][^"']*online-context-compact[^"']*["']/);
});

test("mapSettleToCompact waits for idle then compact", async () => {
	const order = [];
	const result = await mapSettleToCompact({
		async waitForIdle() {
			order.push("wait");
		},
		async compact() {
			order.push("compact");
		},
	});
	assert.deepEqual(order, ["wait", "compact"]);
	assert.equal(result.status, "compacted");
});

test("mapSettleToCompact skips without throwing when compact is missing", async () => {
	const result = await mapSettleToCompact({
		async waitForIdle() {},
	});
	assert.equal(result.status, "skipped");
	assert.equal(result.reason, "missing_compact");
});

test("mapSettleToCompact still compacts when waitForIdle is missing", async () => {
	let compacted = false;
	const result = await mapSettleToCompact({
		async compact() {
			compacted = true;
		},
	});
	assert.equal(result.status, "compacted");
	assert.equal(compacted, true);
});

test("register adapter maps session_stop and agent_settled once", async () => {
	const handlers = {};
	const pi = {
		on(event, handler) {
			handlers[event] = handler;
		},
	};
	registerOnlineContextCompactAdapter(pi);
	for (const event of OCC_SETTLE_EVENTS) {
		assert.equal(typeof handlers[event], "function");
	}

	let compactCalls = 0;
	const ctx = {
		async waitForIdle() {},
		async compact() {
			compactCalls += 1;
		},
	};
	await handlers.session_stop({}, ctx);
	await handlers.agent_settled({}, ctx);
	assert.equal(compactCalls, 1);
});

test("phase-0 factory does not register OCC settle handlers", async () => {
	const handlers = {};
	const pi = {
		on(event, handler) {
			handlers[event] = handler;
		},
		registerTool() {},
	};
	createSolPiOmpExtension(() => DEFAULT_CONFIG)(pi);
	await handlers.session_start({}, { cwd: process.cwd(), isProjectTrusted: () => false });
	assert.equal(handlers.session_stop, undefined);
	assert.equal(handlers.agent_settled, undefined);
});

test("enabling OCC registers session_stop settle map without findCutPoint", async () => {
	const handlers = {};
	let compactCalls = 0;
	const pi = {
		on(event, handler) {
			handlers[event] = handler;
		},
		registerTool() {},
	};
	createSolPiOmpExtension(() => ({ ...DEFAULT_CONFIG, onlineContextCompact: true }))(pi);
	await handlers.session_start({}, { cwd: process.cwd() });
	assert.equal(typeof handlers.session_stop, "function");
	assert.equal(typeof handlers.agent_settled, "function");
	await handlers.session_stop(
		{},
		{
			async waitForIdle() {},
			async compact() {
				compactCalls += 1;
			},
		},
	);
	assert.equal(compactCalls, 1);
});
