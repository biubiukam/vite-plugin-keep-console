import MagicString from "magic-string"
import type { OxcParserModule, TransformBackend, TransformResult } from "./backend-types"
import type { NormalizedConsoleKeeperOptions } from "./options"
import { shouldProcessConsoleMethod } from "./options"
import { createTransformStats, recordConsoleEvent, type ConsolePolicyReason } from "./report"

interface OxcNode {
	type: string
	start?: number
	end?: number
	[key: string]: unknown
}

interface Mutation {
	start: number
	end: number
	replacement?: string
}

type ConsoleReference =
	| {
			kind: "console-object"
	  }
	| {
			kind: "console-method"
			method?: string
	  }

const statementBodyParentTypes = new Set([
	"IfStatement",
	"ForStatement",
	"ForInStatement",
	"ForOfStatement",
	"WhileStatement",
	"DoWhileStatement",
	"WithStatement",
	"LabeledStatement"
])

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
	const consoleAliases = new Map<string, ConsoleReference>()

	walk(program, undefined, (node, parent, ancestors) => {
		recordConsoleAlias(node, consoleAliases)

		const consoleCall = getConsoleCall(node, options, consoleAliases)
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
		const statementParent =
			mutationTarget !== node ? ancestors[ancestors.length - 2] : undefined

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

		mutations.push(createRemovalMutation(code, node, mutationTarget, statementParent, options))
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

function getConsoleCall(
	node: OxcNode,
	options: NormalizedConsoleKeeperOptions,
	consoleAliases: Map<string, ConsoleReference>
) {
	if (node.type !== "CallExpression") return { isConsole: false, shouldProcess: false }

	const callee = node.callee as OxcNode | undefined
	const reference = getConsoleReference(callee, consoleAliases)
	if (reference?.kind !== "console-method") return { isConsole: false, shouldProcess: false }

	const method = reference.method

	if (options.methods.length === 0) return { isConsole: true, shouldProcess: true, method }

	return {
		isConsole: true,
		shouldProcess: method !== undefined && shouldProcessConsoleMethod(method, options),
		method
	}
}

function recordConsoleAlias(node: OxcNode, consoleAliases: Map<string, ConsoleReference>) {
	if (node.type === "VariableDeclarator") {
		const reference = getConsoleReference(node.init as OxcNode | undefined, consoleAliases)
		if (!reference) return

		const id = node.id as OxcNode | undefined

		if (id?.type === "Identifier" && typeof id.name === "string") {
			consoleAliases.set(id.name, reference)
			return
		}

		if (reference.kind === "console-object" && id?.type === "ObjectPattern") {
			recordObjectPatternAliases(id, consoleAliases)
		}
	}

	if (node.type === "AssignmentExpression") {
		const left = node.left as OxcNode | undefined
		if (left?.type !== "Identifier" || typeof left.name !== "string") return

		const reference = getConsoleReference(node.right as OxcNode | undefined, consoleAliases)
		if (reference) {
			consoleAliases.set(left.name, reference)
		} else {
			consoleAliases.delete(left.name)
		}
	}
}

function recordObjectPatternAliases(
	pattern: OxcNode,
	consoleAliases: Map<string, ConsoleReference>
) {
	const properties = Array.isArray(pattern.properties) ? pattern.properties : []

	for (const property of properties) {
		if (!isNode(property) || property.type !== "Property" || property.computed) continue

		const method = getPropertyName(property.key as OxcNode | undefined)
		const local = property.value as OxcNode | undefined

		if (!method || local?.type !== "Identifier" || typeof local.name !== "string") continue

		consoleAliases.set(local.name, {
			kind: "console-method",
			method
		})
	}
}

function getConsoleReference(
	node: OxcNode | undefined,
	consoleAliases: Map<string, ConsoleReference>
): ConsoleReference | undefined {
	if (!node) return undefined

	if (node.type === "Identifier" && typeof node.name === "string") {
		if (node.name === "console") return { kind: "console-object" }
		return consoleAliases.get(node.name)
	}

	if (node.type === "MemberExpression") {
		const objectReference = getConsoleReference(
			node.object as OxcNode | undefined,
			consoleAliases
		)
		if (objectReference?.kind !== "console-object") return undefined

		return {
			kind: "console-method",
			method: getMemberMethodName(node)
		}
	}

	return undefined
}

function getMemberMethodName(memberExpression: OxcNode) {
	const property = memberExpression.property as OxcNode | undefined

	if (
		property?.type === "Identifier" &&
		!memberExpression.computed &&
		typeof property.name === "string"
	) {
		return property.name
	}

	return undefined
}

function getPropertyName(property: OxcNode | undefined) {
	if (property?.type === "Identifier" && typeof property.name === "string") return property.name
	if (property?.type === "Literal" && typeof property.value === "string") return property.value
	return undefined
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
	statementParent: OxcNode | undefined,
	options: NormalizedConsoleKeeperOptions
): Mutation {
	const isExpressionStatement = mutationTarget !== node

	if (!options.preserveArguments) {
		return {
			start: getStart(mutationTarget),
			end: getEnd(mutationTarget),
			replacement: getEmptyStatementReplacement(mutationTarget, statementParent, node)
		}
	}

	const replacement = createPreservedArgumentReplacement(code, node, isExpressionStatement)

	return {
		start: getStart(mutationTarget),
		end: getEnd(mutationTarget),
		replacement
	}
}

function getEmptyStatementReplacement(
	mutationTarget: OxcNode,
	statementParent: OxcNode | undefined,
	node: OxcNode
) {
	if (mutationTarget === node) return "undefined"
	if (statementParent && statementBodyParentTypes.has(statementParent.type)) return "{}"
	return undefined
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
	enter: (node: OxcNode, parent: OxcNode | undefined, ancestors: Array<OxcNode>) => void,
	ancestors: Array<OxcNode> = []
) {
	if (!isNode(node)) return

	enter(node, parent, ancestors)

	for (const [key, value] of Object.entries(node)) {
		if (key === "range" || key === "loc") continue

		if (Array.isArray(value)) {
			for (const child of value) walk(child, node, enter, [...ancestors, node])
		} else if (isNode(value)) {
			walk(value, node, enter, [...ancestors, node])
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
