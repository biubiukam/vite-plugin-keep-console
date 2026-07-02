import MagicString from "magic-string"
import type { OxcParserModule, TransformBackend, TransformResult } from "./backend-types"
import type { NormalizedConsoleKeeperOptions } from "./options"
import { shouldProcessConsoleMethod } from "./options"
import { createTransformStats, recordConsoleEvent, type ConsolePolicyReason } from "./report"

interface OxcNode {
	type?: string
	start?: number
	end?: number
	[key: string]: unknown
}

interface Mutation {
	start: number
	end: number
	replacement?: string
}

export function createOxcBackend(oxcParser: OxcParserModule): TransformBackend {
	return {
		name: "oxc",
		transform(code, id, options) {
			const result = oxcParser.parseSync(id, code, {
				sourceType: "module",
				range: true,
				preserveParens: true
			})

			if (result.errors.length > 0) {
				const firstError = result.errors[0]
				throw new Error(firstError.codeframe || firstError.message || "OXC parse failed")
			}

			return transformOxcProgram(
				code,
				id,
				result.program as OxcNode,
				result.comments,
				options
			)
		}
	}
}

function transformOxcProgram(
	code: string,
	id: string,
	program: OxcNode,
	comments: Array<{ value: string; start: number; end: number }>,
	options: NormalizedConsoleKeeperOptions
): TransformResult {
	const mutations: Mutation[] = []
	const stats = createTransformStats()

	walk(program, undefined, (node, parent) => {
		const consoleCall = getConsoleCall(node, options)
		if (!consoleCall.isConsole) return

		if (!consoleCall.shouldProcess) {
			recordConsoleEvent(stats, {
				action: "skipped",
				file: id,
				method: consoleCall.method || "computed",
				reason: "method-filter"
			})
			return
		}

		const mutationTarget =
			parent?.type === "ExpressionStatement" && parent.expression === node ? parent : node

		if (hasKeepComment(code, comments, node, mutationTarget, options)) {
			recordConsoleEvent(stats, {
				action: "kept",
				file: id,
				method: consoleCall.method || "computed",
				reason: "keep-comment"
			})
			return
		}

		const nonRemoveReason = getNonRemoveReason(options.mode)
		if (nonRemoveReason) {
			recordConsoleEvent(stats, {
				action: "skipped",
				file: id,
				method: consoleCall.method || "computed",
				reason: nonRemoveReason
			})
			return
		}

		recordConsoleEvent(stats, {
			action: "removed",
			file: id,
			method: consoleCall.method || "computed",
			reason: "removed"
		})

		mutations.push(createRemovalMutation(code, node, mutationTarget, options))
	})

	if (mutations.length === 0) {
		return stats.events.length > 0 ? { code, stats } : { code }
	}

	const magicString = new MagicString(code)
	const appliedMutations = removeOverlappingMutations(mutations)

	for (const mutation of appliedMutations) {
		if (mutation.replacement === undefined) {
			magicString.remove(mutation.start, mutation.end)
		} else {
			magicString.update(mutation.start, mutation.end, mutation.replacement)
		}
	}

	return {
		code: magicString.toString(),
		map: magicString.generateMap({
			source: id,
			includeContent: true,
			hires: true
		}),
		stats
	}
}

function getConsoleCall(node: OxcNode, options: NormalizedConsoleKeeperOptions) {
	if (node.type !== "CallExpression") return { isConsole: false, shouldProcess: false }

	const callee = node.callee as OxcNode | undefined
	if (callee?.type !== "MemberExpression") return { isConsole: false, shouldProcess: false }

	const object = callee.object as OxcNode | undefined
	const property = callee.property as OxcNode | undefined
	if (object?.type !== "Identifier" || object.name !== "console") {
		return { isConsole: false, shouldProcess: false }
	}

	const method =
		property?.type === "Identifier" && typeof property.name === "string"
			? property.name
			: undefined

	if (options.methods.length === 0) return { isConsole: true, shouldProcess: true, method }

	return {
		isConsole: true,
		shouldProcess: method !== undefined && shouldProcessConsoleMethod(method, options),
		method
	}
}

function hasKeepComment(
	code: string,
	comments: Array<{ value: string; start: number; end: number }>,
	node: OxcNode,
	mutationTarget: OxcNode,
	options: NormalizedConsoleKeeperOptions
) {
	const nodeStart = getStart(node)
	const nodeEnd = getEnd(node)
	const targetStart = getStart(mutationTarget)
	const targetEnd = getEnd(mutationTarget)

	return comments.some((comment) => {
		const hasMarker = options.keepComments.some((marker) => comment.value.includes(marker))
		if (!hasMarker) return false

		return (
			isInside(comment, nodeStart, nodeEnd) ||
			isAdjacentBefore(code, comment.end, nodeStart) ||
			isAdjacentAfter(code, nodeEnd, comment.start) ||
			isAdjacentBefore(code, comment.end, targetStart) ||
			isAdjacentAfter(code, targetEnd, comment.start)
		)
	})
}

function isInside(comment: { start: number; end: number }, start: number, end: number) {
	return comment.start >= start && comment.end <= end
}

function isAdjacentBefore(code: string, commentEnd: number, targetStart: number) {
	return commentEnd <= targetStart && isWhitespace(code.slice(commentEnd, targetStart))
}

function isAdjacentAfter(code: string, targetEnd: number, commentStart: number) {
	return targetEnd <= commentStart && isWhitespace(code.slice(targetEnd, commentStart))
}

function isWhitespace(value: string) {
	return /^\s*$/.test(value)
}

function removeOverlappingMutations(mutations: Mutation[]) {
	const sorted = [...mutations].sort((a, b) => {
		if (a.start !== b.start) return a.start - b.start
		return b.end - a.end
	})
	const result: Mutation[] = []
	let coveredUntil = -1

	for (const mutation of sorted) {
		if (mutation.start < coveredUntil) continue
		result.push(mutation)
		coveredUntil = mutation.end
	}

	return result.sort((a, b) => b.start - a.start)
}

function createRemovalMutation(
	code: string,
	node: OxcNode,
	mutationTarget: OxcNode,
	options: NormalizedConsoleKeeperOptions
): Mutation {
	const isExpressionStatement = mutationTarget !== node

	if (!options.preserveArguments) {
		return {
			start: getStart(mutationTarget),
			end: getEnd(mutationTarget),
			replacement: mutationTarget === node ? "undefined" : undefined
		}
	}

	const replacement = createPreservedArgumentReplacement(code, node, isExpressionStatement)

	return {
		start: getStart(mutationTarget),
		end: getEnd(mutationTarget),
		replacement
	}
}

function createPreservedArgumentReplacement(
	code: string,
	node: OxcNode,
	isExpressionStatement: boolean
) {
	const argumentSources = getArgumentSources(code, node)

	if (argumentSources.length === 0) {
		return isExpressionStatement ? undefined : "undefined"
	}

	const expression = `${argumentSources.join(", ")}, undefined`
	return isExpressionStatement ? `${expression};` : `(${expression})`
}

function getArgumentSources(code: string, node: OxcNode) {
	const args = Array.isArray(node.arguments) ? node.arguments : []

	return args
		.map((argument) => {
			if (!isNode(argument)) return undefined

			const sourceNode =
				argument.type === "SpreadElement" && isNode(argument.argument)
					? argument.argument
					: argument

			return code.slice(getStart(sourceNode), getEnd(sourceNode))
		})
		.filter((source): source is string => Boolean(source))
}

function getNonRemoveReason(mode: "remove" | "report" | "keep"): ConsolePolicyReason | undefined {
	if (mode === "report") return "mode-report"
	if (mode === "keep") return "mode-keep"
	return undefined
}

function walk(
	node: unknown,
	parent: OxcNode | undefined,
	enter: (node: OxcNode, parent: OxcNode | undefined) => void
) {
	if (!isNode(node)) return

	enter(node, parent)

	for (const [key, value] of Object.entries(node)) {
		if (key === "range" || key === "loc") continue

		if (Array.isArray(value)) {
			for (const child of value) walk(child, node, enter)
		} else if (isNode(value)) {
			walk(value, node, enter)
		}
	}
}

function isNode(value: unknown): value is OxcNode {
	return (
		typeof value === "object" && value !== null && typeof (value as OxcNode).type === "string"
	)
}

function getStart(node: OxcNode) {
	if (typeof node.start !== "number") throw new Error("OXC node is missing start")
	return node.start
}

function getEnd(node: OxcNode) {
	if (typeof node.end !== "number") throw new Error("OXC node is missing end")
	return node.end
}
