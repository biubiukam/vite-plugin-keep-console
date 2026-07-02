import type { ConsolePolicyFileReport, ConsolePolicyReport } from "./types"

export type ConsolePolicyAction = "removed" | "kept" | "skipped"

export type ConsolePolicyReason =
	"keep-comment" | "method-filter" | "mode-keep" | "mode-report" | "removed"

export interface ConsolePolicyEvent {
	action: ConsolePolicyAction
	file: string
	method: string
	reason: ConsolePolicyReason
}

export interface ConsoleTransformStats {
	events: Array<ConsolePolicyEvent>
}

export function createTransformStats(): ConsoleTransformStats {
	return {
		events: []
	}
}

export function recordConsoleEvent(stats: ConsoleTransformStats, event: ConsolePolicyEvent) {
	stats.events.push(event)
}

export function createConsolePolicyReport(): ConsolePolicyReport {
	return {
		removed: 0,
		kept: 0,
		skipped: 0,
		failures: 0,
		files: {}
	}
}

export function resetConsolePolicyReport(report: ConsolePolicyReport) {
	report.removed = 0
	report.kept = 0
	report.skipped = 0
	report.failures = 0
	report.files = {}
}

export function mergeTransformStats(report: ConsolePolicyReport, stats: ConsoleTransformStats) {
	for (const event of stats.events) {
		const fileReport = getFileReport(report, event.file)
		fileReport[event.action] += 1
		report[event.action] += 1

		if (isFailingEvent(event)) {
			fileReport.failures += 1
			report.failures += 1
		}
	}
}

export function countFailingConsoleEvents(stats: ConsolePolicyReport) {
	return stats.failures
}

export function formatConsolePolicyReport(report: ConsolePolicyReport, detail: boolean) {
	const lines = [
		`[vite-plugin-keep-console] console policy report: removed: ${report.removed}, kept: ${report.kept}, skipped: ${report.skipped}`
	]

	if (detail) {
		for (const file of Object.keys(report.files).sort()) {
			const fileReport = report.files[file]
			lines.push(
				`- ${file}: removed: ${fileReport.removed}, kept: ${fileReport.kept}, skipped: ${fileReport.skipped}`
			)
		}
	}

	return lines.join("\n")
}

function getFileReport(report: ConsolePolicyReport, file: string): ConsolePolicyFileReport {
	report.files[file] ||= {
		removed: 0,
		kept: 0,
		skipped: 0,
		failures: 0
	}

	return report.files[file]
}

function isFailingEvent(event: ConsolePolicyEvent) {
	return (
		event.action === "removed" || event.reason === "mode-report" || event.reason === "mode-keep"
	)
}
