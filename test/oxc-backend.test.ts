import { describe, expect, it } from "vitest"
import { createOxcBackend } from "../src/oxc-backend"
import type { OxcParseResult, OxcParserModule } from "../src/backend-types"
import type { ConsoleKeeperOptions } from "../src/types"
import { normalizeOptions } from "../src/options"

type OxcNode = {
	type: string
	start?: number
	end?: number
	[key: string]: unknown
}

const createParser = (result: OxcParseResult): OxcParserModule => ({
	parseSync(filename, sourceText, options) {
		expect(filename).toBe("file.ts")
		expect(sourceText).toEqual(expect.any(String))
		expect(options).toMatchObject({
			sourceType: "module",
			range: true,
			preserveParens: true
		})
		return result
	}
})

const runOxc = (
	code: string,
	program: OxcNode,
	comments: OxcParseResult["comments"] = [],
	options: ConsoleKeeperOptions = {}
) => {
	const backend = createOxcBackend(
		createParser({
			errors: [],
			comments,
			program
		})
	)

	return backend.transform(code, "file.ts", normalizeOptions({ backend: "oxc", ...options }))
}

const program = (code: string, body: OxcNode[], extra: Record<string, unknown> = {}): OxcNode => ({
	type: "Program",
	start: 0,
	end: code.length,
	range: [0, code.length],
	loc: { start: 0, end: code.length },
	body,
	...extra
})

const identifier = (name: string): OxcNode => ({
	type: "Identifier",
	name
})

const literal = (value: string): OxcNode => ({
	type: "Literal",
	value
})

const consoleCall = (
	code: string,
	source: string,
	method: string,
	overrides: Partial<OxcNode> = {}
): OxcNode => {
	const start = code.indexOf(source)
	const end = start + source.length

	return {
		type: "CallExpression",
		start,
		end,
		callee: {
			type: "MemberExpression",
			object: identifier("console"),
			property: identifier(method)
		},
		arguments: [],
		...overrides
	}
}

const expressionStatement = (code: string, expression: OxcNode): OxcNode => ({
	type: "ExpressionStatement",
	start: expression.start,
	end: code.indexOf(";", expression.start) + 1,
	expression
})

describe("oxc backend", () => {
	it.each([
		{
			error: { message: "Unexpected token", codeframe: "code frame" },
			expected: "code frame"
		},
		{
			error: { message: "Unexpected token", codeframe: null },
			expected: "Unexpected token"
		},
		{
			error: { message: "", codeframe: null },
			expected: "OXC parse failed"
		}
	])("throws the most helpful OXC parse error", ({ error, expected }) => {
		const backend = createOxcBackend(
			createParser({
				errors: [error],
				comments: [],
				program: program("const value = ;", [])
			})
		)

		expect(() =>
			backend.transform("const value = ;", "file.ts", normalizeOptions({ backend: "oxc" }))
		).toThrow(expected)
	})

	it("returns original code when OXC finds no console calls", () => {
		const code = "const value = 1;"
		const result = runOxc(
			code,
			program(
				code,
				[
					{
						type: "VariableDeclaration",
						start: 0,
						end: code.length,
						declarations: [],
						range: [0, code.length],
						loc: { start: 0, end: code.length }
					}
				],
				{
					extra: [null, "not-a-node"]
				}
			)
		)

		expect(result).toEqual({ code })
	})

	it("respects includes and leaves computed or non-console member calls untouched", () => {
		const code = [
			'console.error("drop");',
			'console.log("keep");',
			'console["error"]("keep computed");',
			'logger.error("keep logger");'
		].join("\n")

		const errorCall = consoleCall(code, 'console.error("drop")', "error")
		const logCall = consoleCall(code, 'console.log("keep")', "log")
		const computedCall = consoleCall(code, 'console["error"]("keep computed")', "error", {
			callee: {
				type: "MemberExpression",
				object: identifier("console"),
				property: literal("error")
			}
		})
		const loggerCall = consoleCall(code, 'logger.error("keep logger")', "error", {
			callee: {
				type: "MemberExpression",
				object: identifier("logger"),
				property: identifier("error")
			}
		})

		const result = runOxc(
			code,
			program(code, [
				expressionStatement(code, errorCall),
				expressionStatement(code, logCall),
				expressionStatement(code, computedCall),
				expressionStatement(code, loggerCall)
			]),
			[],
			{ includes: ["error"] }
		)

		expect(result.code).not.toContain('console.error("drop")')
		expect(result.code).toContain('console.log("keep")')
		expect(result.code).toContain('console["error"]("keep computed")')
		expect(result.code).toContain('logger.error("keep logger")')
	})

	it("records computed console calls with fallback method names across policy actions", () => {
		const computedCallee = (method: string) => ({
			type: "MemberExpression",
			object: identifier("console"),
			property: literal(method)
		})

		const keptCode = '/* keep-console */\nconsole["log"]("keep");'
		const keptCall = consoleCall(keptCode, 'console["log"]("keep")', "log", {
			callee: computedCallee("log")
		})
		const keptResult = runOxc(
			keptCode,
			program(keptCode, [expressionStatement(keptCode, keptCall)]),
			[{ type: "Block", value: " keep-console ", start: 0, end: "/* keep-console */".length }]
		)

		expect(keptResult.stats?.events[0]).toMatchObject({
			action: "kept",
			method: "computed"
		})

		const reportedCode = 'console["warn"]("report");'
		const reportedCall = consoleCall(reportedCode, 'console["warn"]("report")', "warn", {
			callee: computedCallee("warn")
		})
		const reportedResult = runOxc(
			reportedCode,
			program(reportedCode, [expressionStatement(reportedCode, reportedCall)]),
			[],
			{ mode: "report" }
		)

		expect(reportedResult.stats?.events[0]).toMatchObject({
			action: "skipped",
			method: "computed"
		})

		const removedCode = 'console["error"]("remove");'
		const removedCall = consoleCall(removedCode, 'console["error"]("remove")', "error", {
			callee: computedCallee("error")
		})
		const removedResult = runOxc(
			removedCode,
			program(removedCode, [expressionStatement(removedCode, removedCall)])
		)

		expect(removedResult.code).toBe("")
		expect(removedResult.stats?.events[0]).toMatchObject({
			action: "removed",
			method: "computed"
		})
	})

	it("preserves console argument evaluation when preserveArguments is enabled", () => {
		const code = "console.log(expensive(), value);"
		const firstArgStart = code.indexOf("expensive()")
		const secondArgStart = code.indexOf("value")
		const call = consoleCall(code, "console.log(expensive(), value)", "log", {
			arguments: [
				{
					type: "CallExpression",
					start: firstArgStart,
					end: firstArgStart + "expensive()".length,
					callee: identifier("expensive"),
					arguments: []
				},
				{
					type: "Identifier",
					name: "value",
					start: secondArgStart,
					end: secondArgStart + "value".length
				}
			]
		})

		const result = runOxc(code, program(code, [expressionStatement(code, call)]), [], {
			preserveArguments: true
		})

		expect(result.code).toBe("expensive(), value, undefined;")
	})

	it("keeps code unchanged and records skipped events in report mode", () => {
		const code = 'console.warn("report only");'
		const call = consoleCall(code, 'console.warn("report only")', "warn")

		const result = runOxc(code, program(code, [expressionStatement(code, call)]), [], {
			mode: "report"
		})

		expect(result.code).toBe(code)
		expect(result.stats?.events).toEqual([
			{
				action: "skipped",
				file: "file.ts",
				method: "warn",
				reason: "mode-report"
			}
		])
	})

	it("removes empty console calls with preserveArguments in statement and expression positions", () => {
		const statementCode = "console.log();"
		const statementCall = consoleCall(statementCode, "console.log()", "log")

		const statementResult = runOxc(
			statementCode,
			program(statementCode, [expressionStatement(statementCode, statementCall)]),
			[],
			{ preserveArguments: true }
		)

		expect(statementResult.code).toBe("")

		const expressionCode = "const value = console.log();"
		const expressionCall = consoleCall(expressionCode, "console.log()", "log")

		const expressionResult = runOxc(
			expressionCode,
			program(expressionCode, [
				{
					type: "VariableDeclaration",
					start: 0,
					end: expressionCode.length,
					declarations: [
						{
							type: "VariableDeclarator",
							start: expressionCode.indexOf("value"),
							end: expressionCode.length - 1,
							init: expressionCall
						}
					]
				}
			]),
			[],
			{ preserveArguments: true }
		)

		expect(expressionResult.code).toBe("const value = undefined;")
	})

	it("preserves OXC console arguments in expression positions", () => {
		const code = "const value = console.log(sideEffect());"
		const argStart = code.indexOf("sideEffect()")
		const call = consoleCall(code, "console.log(sideEffect())", "log", {
			arguments: [
				{
					type: "CallExpression",
					start: argStart,
					end: argStart + "sideEffect()".length,
					callee: identifier("sideEffect"),
					arguments: []
				}
			]
		})

		const result = runOxc(
			code,
			program(code, [
				{
					type: "VariableDeclaration",
					start: 0,
					end: code.length,
					declarations: [
						{
							type: "VariableDeclarator",
							start: code.indexOf("value"),
							end: code.length - 1,
							init: call
						}
					]
				}
			]),
			[],
			{ preserveArguments: true }
		)

		expect(result.code).toBe("const value = (sideEffect(), undefined);")
	})

	it("ignores missing and non-node OXC argument entries when preserving arguments", () => {
		const missingArgumentsCode = "console.log();"
		const missingArgumentsCall = consoleCall(missingArgumentsCode, "console.log()", "log", {
			arguments: undefined
		})
		const missingArgumentsResult = runOxc(
			missingArgumentsCode,
			program(missingArgumentsCode, [
				expressionStatement(missingArgumentsCode, missingArgumentsCall)
			]),
			[],
			{ preserveArguments: true }
		)

		expect(missingArgumentsResult.code).toBe("")

		const nonNodeArgumentCode = "console.log(value);"
		const nonNodeArgumentCall = consoleCall(nonNodeArgumentCode, "console.log(value)", "log", {
			arguments: [null]
		})
		const nonNodeArgumentResult = runOxc(
			nonNodeArgumentCode,
			program(nonNodeArgumentCode, [
				expressionStatement(nonNodeArgumentCode, nonNodeArgumentCall)
			]),
			[],
			{ preserveArguments: true }
		)

		expect(nonNodeArgumentResult.code).toBe("")
	})

	it("unwraps spread arguments when preserving console argument evaluation", () => {
		const code = "console.log(...items);"
		const itemsStart = code.indexOf("items")
		const call = consoleCall(code, "console.log(...items)", "log", {
			arguments: [
				{
					type: "SpreadElement",
					start: code.indexOf("...items"),
					end: itemsStart + "items".length,
					argument: {
						type: "Identifier",
						name: "items",
						start: itemsStart,
						end: itemsStart + "items".length
					}
				}
			]
		})

		const result = runOxc(code, program(code, [expressionStatement(code, call)]), [], {
			preserveArguments: true
		})

		expect(result.code).toBe("items, undefined;")
	})

	it("keeps code unchanged and records skipped events in keep mode", () => {
		const code = 'console.info("keep mode");'
		const call = consoleCall(code, 'console.info("keep mode")', "info")

		const result = runOxc(code, program(code, [expressionStatement(code, call)]), [], {
			mode: "keep"
		})

		expect(result.code).toBe(code)
		expect(result.stats?.events[0]).toMatchObject({
			action: "skipped",
			method: "info",
			reason: "mode-keep"
		})
	})

	it("removes console calls when keep comments are unrelated or not adjacent", () => {
		const code = [
			"/* note */",
			"/* keep-console */const side = 1;",
			'console.warn("drop");'
		].join("\n")
		const warnCall = consoleCall(code, 'console.warn("drop")', "warn")

		const result = runOxc(code, program(code, [expressionStatement(code, warnCall)]), [
			{ type: "Block", value: " note ", start: 0, end: 10 },
			{ type: "Block", value: " keep-console ", start: 11, end: 31 }
		])

		expect(result.code).not.toContain('console.warn("drop")')
	})

	it("removes the longest overlapping mutation only once", () => {
		const code = 'console.log("one");'
		const call = consoleCall(code, 'console.log("one")', "log")

		const result = runOxc(
			code,
			program(code, [
				expressionStatement(code, call),
				{
					...call,
					end: code.indexOf(")")
				}
			])
		)

		expect(result.code).toBe("")
	})

	it("throws when an OXC node is missing its start range", () => {
		const code = 'console.log("missing start");'
		const call = consoleCall(code, 'console.log("missing start")', "log")

		expect(() =>
			runOxc(code, program(code, [{ ...expressionStatement(code, call), start: undefined }]))
		).toThrow("OXC node is missing start")
	})

	it("throws when an OXC node is missing its end range", () => {
		const code = 'console.log("missing end");'
		const call = consoleCall(code, 'console.log("missing end")', "log")

		expect(() =>
			runOxc(code, program(code, [{ ...expressionStatement(code, call), end: undefined }]))
		).toThrow("OXC node is missing end")
	})

	it("ignores calls whose callee is not a member expression", () => {
		const code = 'log("keep");'
		const call = {
			type: "CallExpression",
			start: 0,
			end: code.length - 1,
			callee: identifier("log"),
			arguments: []
		}

		const result = runOxc(code, program(code, [expressionStatement(code, call)]))

		expect(result.code).toBe(code)
	})
})
