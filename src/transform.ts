import { resolveTransformBackend } from "./backend"
import type { BackendResolverHooks } from "./backend-types"
import type { ConsoleKeeperOptions } from "./types"
import { cleanId, normalizeOptions, shouldTransformFile } from "./options"
import { mergeTransformStats } from "./report"
import type { ConsolePolicyReport } from "./types"

export function generateTransform(
	options?: ConsoleKeeperOptions,
	resolverHooks?: BackendResolverHooks,
	report?: ConsolePolicyReport
) {
	const normalizedOptions = normalizeOptions(options)
	let backendPromise: ReturnType<typeof resolveTransformBackend> | undefined

	const getBackend = () => {
		backendPromise ||= resolveTransformBackend(normalizedOptions, resolverHooks)
		return backendPromise
	}

	return async (code: string, id: string) => {
		if (!shouldTransformFile(id, normalizedOptions)) return { code }

		const backend = await getBackend()

		const scriptBlocks = getScriptBlocks(code, cleanId(id))
		if (scriptBlocks.length > 0) {
			return transformScriptBlocks(code, id, scriptBlocks, backend, normalizedOptions, report)
		}

		const result = await backend.transform(code, id, normalizedOptions)
		if (report && result.stats) mergeTransformStats(report, result.stats)

		return {
			code: result.code,
			map: result.map
		}
	}
}

interface ScriptBlock {
	contentStart: number
	contentEnd: number
}

async function transformScriptBlocks(
	code: string,
	id: string,
	scriptBlocks: Array<ScriptBlock>,
	backend: Awaited<ReturnType<typeof resolveTransformBackend>>,
	options: ReturnType<typeof normalizeOptions>,
	report?: ConsolePolicyReport
) {
	let transformedCode = code
	let offset = 0

	for (const block of scriptBlocks) {
		const currentStart = block.contentStart + offset
		const currentEnd = block.contentEnd + offset
		const content = transformedCode.slice(currentStart, currentEnd)
		const result = await backend.transform(content, id, options)

		if (report && result.stats) mergeTransformStats(report, result.stats)

		transformedCode =
			transformedCode.slice(0, currentStart) + result.code + transformedCode.slice(currentEnd)
		offset += result.code.length - content.length
	}

	return {
		code: transformedCode
	}
}

function getScriptBlocks(code: string, id: string) {
	if (!/\.(vue|svelte)$/.test(id) || !code.includes("<script")) return []

	const blocks: Array<ScriptBlock> = []
	const scriptRE = /<script\b[^>]*>([\s\S]*?)<\/script>/gi
	let match: RegExpExecArray | null

	while ((match = scriptRE.exec(code))) {
		const contentStart = match.index + match[0].indexOf(">") + 1
		const contentEnd = contentStart + match[1].length
		blocks.push({
			contentStart,
			contentEnd
		})
	}

	return blocks
}
