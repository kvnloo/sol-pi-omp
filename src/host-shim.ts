/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 Kevin Rajan
 * SPDX-License-Identifier: MIT
 *
 * Oh My Pi 18.1.17's coding-agent shim is a subset of Pi 0.84.2. Session
 * construct must not throw when modelRegistry.complete, isProjectTrusted, or
 * ctx.ui.setStatus are missing. Never call those symbols without a typeof guard.
 */

export type HostShimProbe = {
	readonly projectTrusted: boolean;
	readonly modelRegistryComplete: boolean;
	readonly uiSetStatus: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (typeof value !== "object" || value === null) return undefined;
	return value as Record<string, unknown>;
}

function callBool(fn: unknown): boolean {
	if (typeof fn !== "function") return false;
	try {
		return Boolean(fn());
	} catch {
		return false;
	}
}

export function probeHostShim(ctx: unknown): HostShimProbe {
	const record = asRecord(ctx);
	const registry = asRecord(record?.modelRegistry);
	const ui = asRecord(record?.ui);
	return {
		projectTrusted: callBool(record?.isProjectTrusted),
		modelRegistryComplete: typeof registry?.complete === "function",
		uiSetStatus: typeof ui?.setStatus === "function",
	};
}

export function isProjectTrusted(ctx: unknown): boolean {
	return probeHostShim(ctx).projectTrusted;
}

export function modelRegistryComplete(ctx: unknown): ((...args: never[]) => unknown) | undefined {
	const complete = asRecord(asRecord(ctx)?.modelRegistry)?.complete;
	return typeof complete === "function" ? (complete as (...args: never[]) => unknown) : undefined;
}

export function notifyUi(ui: unknown, message: string, level: string): void {
	const fn = asRecord(ui)?.notify;
	if (typeof fn !== "function") return;
	try {
		fn.call(ui, message, level);
	} catch {
		// Shim notify is optional; savings display must fail open.
	}
}

export function setUiStatus(ui: unknown, key: string, text: string | undefined): boolean {
	const fn = asRecord(ui)?.setStatus;
	if (typeof fn !== "function") return false;
	try {
		fn.call(ui, key, text);
		return true;
	} catch {
		return false;
	}
}

export function hasUiSetStatus(ui: unknown): boolean {
	return typeof asRecord(ui)?.setStatus === "function";
}
