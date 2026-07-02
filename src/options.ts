import type {
	ConsoleKeeperMode,
	ConsoleKeeperOptions,
	ConsoleKeeperPathPattern,
	ConsoleKeeperReportOption,
	ConsoleMethod
} from "./types"

export interface NormalizedConsoleKeeperOptions {
	methods: Array<ConsoleMethod>
	include: Array<ConsoleKeeperPathPattern>
	exclude: Array<ConsoleKeeperPathPattern>
	keepComments: NonNullable<ConsoleKeeperOptions["keepComments"]>
	backend: NonNullable<ConsoleKeeperOptions["backend"]>
	mode: ConsoleKeeperMode
	failOnConsole: boolean
	report: ConsoleKeeperReportOption
	preserveArguments: boolean
}

const supportedFileRE = /\.(ts|tsx|js|jsx|vue|svelte)$/

export function normalizeOptions(options?: ConsoleKeeperOptions): NormalizedConsoleKeeperOptions {
	const methods = options?.methods ?? options?.includes ?? []
	const include = options?.include ?? options?.external ?? []

	return {
		methods,
		include,
		exclude: options?.exclude || [],
		keepComments: options?.keepComments || ["keep-console"],
		backend: options?.backend || "auto",
		mode: options?.mode || "remove",
		failOnConsole: options?.failOnConsole || false,
		report: options?.report || false,
		preserveArguments: options?.preserveArguments || false
	}
}

export function cleanId(id: string) {
	return id.replace(/[?#].*$/, "")
}

export function shouldTransformFile(id: string, options: NormalizedConsoleKeeperOptions) {
	const cleanFileId = cleanId(id)

	if (!supportedFileRE.test(cleanFileId)) return false

	if (matchesAnyPattern(cleanFileId, options.exclude)) return false

	if (options.include.length === 0) return true

	return matchesAnyPattern(cleanFileId, options.include)
}

function matchesAnyPattern(cleanFileId: string, patterns: Array<ConsoleKeeperPathPattern>) {
	return patterns.some((pattern) => {
		if (typeof pattern === "string") {
			const normalizedId = cleanFileId.replace(/\\/g, "/")
			const normalizedPattern = pattern.replace(/\\/g, "/")
			return normalizedId.includes(normalizedPattern)
		}

		return pattern.test(cleanFileId)
	})
}

export function shouldProcessConsoleMethod(
	method: string,
	options: NormalizedConsoleKeeperOptions
) {
	return options.methods.length === 0 || options.methods.includes(method as ConsoleMethod)
}
