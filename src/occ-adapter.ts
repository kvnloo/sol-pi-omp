/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 Kevin Rajan
 * SPDX-License-Identifier: MIT
 *
 * OMP adapter for Online Context Compact. Stock SoL-Pi waits for Pi
 * `agent_settled` then ctx.compact(). Oh My Pi 18.1.17 never emits
 * agent_settled; it has session_stop plus waitForIdle() and ctx.compact().
 *
 * This module maps settle → session_stop / waitForIdle + compact().
 * It never loads the host cut-point helper. Default off — register only
 * when onlineContextCompact is true.
 */

type SettleExtensionAPI = {
	on: (...args: unknown[]) => unknown;
};

export const OCC_SETTLE_EVENTS = ["session_stop", "agent_settled"] as const;

export const OCC_COMPACT_INSTRUCTIONS =
	"Preserve completed work, verification results, important decisions, and remaining work.";

export type CompactHostContext = {
	readonly waitForIdle?: () => Promise<void>;
	readonly compact?: (instructionsOrOptions?: unknown) => Promise<void> | void;
	readonly isIdle?: () => boolean;
};

export type SettleMapResult =
	| { readonly status: "compacted" }
	| {
			readonly status: "skipped";
			readonly reason: "missing_compact" | "wait_failed" | "compact_failed";
	  };

export async function mapSettleToCompact(ctx: CompactHostContext): Promise<SettleMapResult> {
	try {
		if (typeof ctx.waitForIdle === "function") {
			await ctx.waitForIdle();
		}
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		console.warn(`[sol-pi-omp] OCC waitForIdle failed; compact skipped: ${reason}`);
		return { status: "skipped", reason: "wait_failed" };
	}

	if (typeof ctx.compact !== "function") {
		console.warn("[sol-pi-omp] OCC settle mapped but ctx.compact is missing; skipped");
		return { status: "skipped", reason: "missing_compact" };
	}

	try {
		await ctx.compact({ customInstructions: OCC_COMPACT_INSTRUCTIONS });
		return { status: "compacted" };
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		console.warn(`[sol-pi-omp] OCC compact failed: ${reason}`);
		return { status: "skipped", reason: "compact_failed" };
	}
}

export function registerOnlineContextCompactAdapter(pi: SettleExtensionAPI): void {
	let compacting = false;
	let compacted = false;

	const onSettle = async (_event: unknown, ctx: CompactHostContext): Promise<void> => {
		if (compacting || compacted) return;
		compacting = true;
		try {
			const result = await mapSettleToCompact(ctx);
			if (result.status === "compacted") compacted = true;
		} finally {
			compacting = false;
		}
	};

	for (const event of OCC_SETTLE_EVENTS) {
		pi.on(event, onSettle);
	}
}
