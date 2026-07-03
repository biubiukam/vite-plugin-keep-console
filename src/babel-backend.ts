import { parse } from "@babel/parser"
import { generate } from "@babel/generator"
import traverse, { NodePath } from "@babel/traverse"
import * as t from "@babel/types"
import type { Comment, CallExpression, Node } from "@babel/types"
import type { TransformBackend } from "./backend-types"
import { shouldProcessConsoleMethod } from "./options"
import { createTransformStats, recordConsoleEvent, type ConsolePolicyReason } from "./report"

const traverseFun = typeof traverse !== "function" ? traverse.default : traverse

type ConsoleReference =
	| {
			kind: "console-object"
	  }
	| {
			kind: "console-method"
			method?: string
	  }

type ConsoleBinding = object
type BabelPath = NodePath<Node> & {
	scope: {
		getBinding(name: string): ConsoleBinding | undefined
	}
}

export function createBabelBackend(): TransformBackend {
	return {
		name: "babel",
		transform(code, id, options) {
			const stats = createTransformStats()
			const consoleAliases = new WeakMap<ConsoleBinding, ConsoleReference>()
			const ast = parse(code, {
				sourceType: "module",
				plugins: ["typescript", "jsx", "decorators-legacy", "classProperties"]
			})

			traverseFun(ast, {
				VariableDeclarator(path: NodePath<t.VariableDeclarator> & BabelPath) {
					const reference = getConsoleReference(path.node.init, path, consoleAliases)
					if (!reference) return

					if (t.isIdentifier(path.node.id)) {
						recordAlias(
							path.scope.getBinding(path.node.id.name),
							reference,
							consoleAliases
						)
						return
					}

					if (reference.kind === "console-object" && t.isObjectPattern(path.node.id)) {
						recordObjectPatternAliases(path.node.id, path, consoleAliases)
					}
				},
				AssignmentExpression(path: NodePath<t.AssignmentExpression> & BabelPath) {
					if (!t.isIdentifier(path.node.left)) return

					const binding = path.scope.getBinding(path.node.left.name)
					const reference = getConsoleReference(path.node.right, path, consoleAliases)

					if (reference) {
						recordAlias(binding, reference, consoleAliases)
					} else if (binding) {
						consoleAliases.delete(binding)
					}
				},
				CallExpression(path: NodePath<CallExpression> & BabelPath) {
					const node = path.node
					const consoleReference = getConsoleReference(node.callee, path, consoleAliases)

					if (!consoleReference || consoleReference.kind !== "console-method") return

					const method = consoleReference.method
					const shouldProcess =
						options.methods.length === 0 ||
						(method !== undefined && shouldProcessConsoleMethod(method, options))

					if (!shouldProcess) {
						recordConsoleEvent(stats, {
							action: "skipped",
							file: id,
							method: method || "computed",
							reason: "method-filter"
						})
						return
					}

					const hasKeep = hasKeepComment(path, node, options.keepComments)
					if (hasKeep) {
						recordConsoleEvent(stats, {
							action: "kept",
							file: id,
							method: method || "computed",
							reason: "keep-comment"
						})
						return
					}

					const nonRemoveReason = getNonRemoveReason(options.mode)
					if (nonRemoveReason) {
						recordConsoleEvent(stats, {
							action: "skipped",
							file: id,
							method: method || "computed",
							reason: nonRemoveReason
						})
						return
					}

					recordConsoleEvent(stats, {
						action: "removed",
						file: id,
						method: method || "computed",
						reason: "removed"
					})

					if (path.parentPath.isExpressionStatement()) {
						const preserved = createPreservedArgumentExpression(node)

						if (options.preserveArguments && preserved) {
							path.parentPath.replaceWith(t.expressionStatement(preserved))
						} else {
							path.parentPath.remove()
						}
					} else {
						path.replaceWith(
							options.preserveArguments
								? createPreservedArgumentExpression(node) ||
										t.identifier("undefined")
								: t.identifier("undefined")
						)
					}
				}
			})

			const output = generate(ast, {
				sourceMaps: true,
				sourceFileName: id
			})

			return {
				code: output.code,
				map: output.map,
				stats
			}
		}
	}
}

function recordAlias(
	binding: ConsoleBinding | undefined,
	reference: ConsoleReference,
	consoleAliases: WeakMap<ConsoleBinding, ConsoleReference>
) {
	if (binding) consoleAliases.set(binding, reference)
}

function recordObjectPatternAliases(
	pattern: t.ObjectPattern,
	path: BabelPath,
	consoleAliases: WeakMap<ConsoleBinding, ConsoleReference>
) {
	for (const property of pattern.properties) {
		if (!t.isObjectProperty(property) || property.computed) continue

		const method = getPropertyName(property.key)
		const local = t.isIdentifier(property.value) ? property.value : undefined
		if (!method || !local) continue

		recordAlias(
			path.scope.getBinding(local.name),
			{
				kind: "console-method",
				method
			},
			consoleAliases
		)
	}
}

function getConsoleReference(
	node: Node | null | undefined,
	path: BabelPath,
	consoleAliases: WeakMap<ConsoleBinding, ConsoleReference>
): ConsoleReference | undefined {
	if (!node) return undefined

	if (t.isIdentifier(node)) {
		if (node.name === "console") return { kind: "console-object" }

		const binding = path.scope.getBinding(node.name)
		return binding ? consoleAliases.get(binding) : undefined
	}

	if (t.isMemberExpression(node)) {
		const objectReference = getConsoleReference(node.object, path, consoleAliases)
		if (objectReference?.kind !== "console-object") return undefined

		return {
			kind: "console-method",
			method: getConsoleMethod(node)
		}
	}

	return undefined
}

function getConsoleMethod(callee: t.MemberExpression) {
	if (t.isIdentifier(callee.property) && !callee.computed) return callee.property.name
	return undefined
}

function getPropertyName(property: Node) {
	if (t.isIdentifier(property)) return property.name
	if (t.isStringLiteral(property)) return property.value
	return undefined
}

function hasKeepComment(
	path: NodePath<CallExpression>,
	node: CallExpression,
	keepComments: Array<string>
) {
	const leadingComments: Comment[] =
		node.leadingComments || (path.parentPath.node as Node).leadingComments || []
	const trailingComments: Comment[] =
		node.trailingComments || (path.parentPath.node as Node).trailingComments || []
	const innerComments: Comment[] =
		node.innerComments || (path.parentPath.node as Node).innerComments || []

	const argumentComments = node.arguments.flatMap((arg: Node) => {
		return [
			...(arg.leadingComments || []),
			...(arg.innerComments || []),
			...(arg.trailingComments || [])
		]
	})

	const allComments: Comment[] = [
		...leadingComments,
		...trailingComments,
		...innerComments,
		...argumentComments
	]

	return allComments.some((comment: Comment) =>
		keepComments.some((marker) => comment.value.includes(marker))
	)
}

function getNonRemoveReason(mode: "remove" | "report" | "keep"): ConsolePolicyReason | undefined {
	if (mode === "report") return "mode-report"
	if (mode === "keep") return "mode-keep"
	return undefined
}

function createPreservedArgumentExpression(node: CallExpression) {
	const expressions = node.arguments
		.map((argument) => {
			if (t.isSpreadElement(argument)) return argument.argument
			return argument
		})
		.filter((argument): argument is t.Expression => t.isExpression(argument))

	if (expressions.length === 0) return undefined

	return t.sequenceExpression([
		...expressions.map((expression) => t.cloneNode(expression)),
		t.identifier("undefined")
	])
}
