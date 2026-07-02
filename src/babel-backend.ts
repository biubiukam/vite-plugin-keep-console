import { parse } from "@babel/parser"
import { generate } from "@babel/generator"
import traverse, { NodePath } from "@babel/traverse"
import * as t from "@babel/types"
import type { Comment, CallExpression, Node } from "@babel/types"
import type { TransformBackend } from "./backend-types"
import { shouldProcessConsoleMethod } from "./options"
import { createTransformStats, recordConsoleEvent, type ConsolePolicyReason } from "./report"

const traverseFun = typeof traverse !== "function" ? traverse.default : traverse

export function createBabelBackend(): TransformBackend {
	return {
		name: "babel",
		transform(code, id, options) {
			const stats = createTransformStats()
			const ast = parse(code, {
				sourceType: "module",
				plugins: ["typescript", "jsx", "decorators-legacy", "classProperties"]
			})

			traverseFun(ast, {
				CallExpression(path: NodePath<CallExpression>) {
					const node = path.node

					if (!t.isMemberExpression(path.node.callee)) return

					const callee = path.node.callee

					const isConsole =
						t.isIdentifier(callee.object) && callee.object.name === "console"

					if (!isConsole) return

					const method = getConsoleMethod(callee)
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

function getConsoleMethod(callee: t.MemberExpression) {
	if (t.isIdentifier(callee.property) && !callee.computed) return callee.property.name
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
