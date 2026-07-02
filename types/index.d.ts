declare module "@babel/traverse" {
	import * as t from "@babel/types"

	export interface NodePath<T = t.Node> {
		node: T
		parentPath: NodePath
		remove(): void
		replaceWith(node: t.Node): void
		isExpressionStatement(): boolean
	}

	const traverse: (ast: t.Node | { type: string }, visitors: Record<string, unknown>) => void
	export default { default: traverse }
}

declare module "@babel/generator" {
	interface GenerateResult {
		code: string
		map: unknown
	}

	export function generate(ast: unknown, options?: Record<string, unknown>): GenerateResult
}
