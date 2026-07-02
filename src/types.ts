export type ConsoleMethod =
	| "debug"
	| "error"
	| "info"
	| "log"
	| "warn"
	| "dir"
	| "dirxml"
	| "table"
	| "trace"
	| "group"
	| "groupCollapsed"
	| "groupEnd"
	| "clear"
	| "count"
	| "countReset"
	| "assert"
	| "profile"
	| "profileEnd"
	| "time"
	| "timeLog"
	| "timeEnd"
	| "timeStamp"
	| "context"
	| "createTask"
	| "memory"

export type ConsoleKeeperMode = "remove" | "report" | "keep"

export type ConsoleKeeperReportOption = boolean | "summary" | "detailed"

export type ConsoleKeeperPathPattern = string | RegExp

export interface ConsolePolicyFileReport {
	removed: number
	kept: number
	skipped: number
	failures: number
}

export interface ConsolePolicyReport {
	removed: number
	kept: number
	skipped: number
	failures: number
	files: Record<string, ConsolePolicyFileReport>
}

export interface ConsoleKeeperOptions {
	/**
	 * AST backend used to remove console calls.
	 *
	 * - "auto": prefer OXC when the current Node runtime supports it and
	 *   oxc-parser can be loaded dynamically; otherwise fall back to Babel.
	 * - "oxc": require OXC and throw an actionable error when it cannot be loaded.
	 * - "babel": keep the legacy Babel implementation.
	 */
	backend?: "auto" | "oxc" | "babel"
	/** Console methods to process. If empty, all console methods are processed. */
	methods?: Array<ConsoleMethod>
	/** @deprecated Use methods instead. */
	includes?: Array<ConsoleMethod>
	/** Files to include for processing. If empty, every supported file is included. */
	include?: Array<ConsoleKeeperPathPattern>
	/** Files to exclude from processing. */
	exclude?: Array<ConsoleKeeperPathPattern>
	/** @deprecated Use include instead. */
	external?: Array<ConsoleKeeperPathPattern>
	/** 需要保留的console方法的注释 */
	keepComments?: Array<string>
	/**
	 * Policy mode for unkept console calls.
	 *
	 * - "remove": remove matching console calls.
	 * - "report": keep matching console calls and only report them.
	 * - "keep": keep matching console calls without removing them.
	 */
	mode?: ConsoleKeeperMode
	/** Fail the build when unkept console calls are found. */
	failOnConsole?: boolean
	/** Print an aggregated build report. */
	report?: ConsoleKeeperReportOption
	/** Preserve console argument evaluation when removing calls. */
	preserveArguments?: boolean
}
