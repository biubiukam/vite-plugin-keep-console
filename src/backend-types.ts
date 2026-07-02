import type { NormalizedConsoleKeeperOptions } from "./options"
import type { ConsoleTransformStats } from "./report"

export interface TransformResult {
	code: string
	map?: unknown
	stats?: ConsoleTransformStats
}

export interface TransformBackend {
	name: "babel" | "oxc"
	transform(
		code: string,
		id: string,
		options: NormalizedConsoleKeeperOptions
	): TransformResult | Promise<TransformResult>
}

export interface OxcParseResult {
	program: unknown
	comments: Array<{
		type: "Line" | "Block"
		value: string
		start: number
		end: number
	}>
	errors: Array<{
		message: string
		codeframe?: string | null
	}>
}

export interface OxcParserModule {
	parseSync(
		filename: string,
		sourceText: string,
		options?: {
			sourceType?: "script" | "module" | "commonjs" | "unambiguous"
			range?: boolean
			preserveParens?: boolean
		}
	): OxcParseResult
}

export type LoadOxcParser = () => Promise<OxcParserModule>

export interface BackendResolverHooks {
	nodeVersion?: string
	loadOxcParser?: LoadOxcParser
}
