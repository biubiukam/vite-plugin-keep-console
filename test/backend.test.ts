import { describe, expect, it, vi } from "vitest"
import { resolveTransformBackend, supportsOxcRuntime } from "../src/backend"
import { generateTransform } from "../src/transform"

const missingOxcLoader = async () => {
	throw new Error("Cannot find package 'oxc-parser'")
}

describe("backend resolution", () => {
	it.each([
		["20.18.9", false],
		["20.19.0", true],
		["20.20.0", true],
		["22.11.9", false],
		["22.12.0", true],
		["23.0.0", true],
		["", false]
	])("detects whether Node %s supports OXC", (nodeVersion, expected) => {
		expect(supportsOxcRuntime(nodeVersion)).toBe(expected)
	})

	it("resolves backend auto to Babel when OXC cannot be loaded", async () => {
		const backend = await resolveTransformBackend(
			{ backend: "auto" },
			{
				nodeVersion: "22.22.2",
				loadOxcParser: missingOxcLoader
			}
		)

		expect(backend.name).toBe("babel")
	})

	it("defaults an unspecified backend option to auto", async () => {
		const backend = await resolveTransformBackend(
			{},
			{
				nodeVersion: "22.22.2",
				loadOxcParser: missingOxcLoader
			}
		)

		expect(backend.name).toBe("babel")
	})

	it("resolves backend auto to Babel when Node does not satisfy OXC runtime requirements", async () => {
		let attemptedOxcLoad = false

		const backend = await resolveTransformBackend(
			{ backend: "auto" },
			{
				nodeVersion: "18.19.0",
				loadOxcParser: async () => {
					attemptedOxcLoad = true
					throw new Error("OXC should not be loaded on unsupported Node")
				}
			}
		)

		expect(backend.name).toBe("babel")
		expect(attemptedOxcLoad).toBe(false)
	})

	it("throws an actionable error when backend oxc is requested but OXC cannot be loaded", async () => {
		await expect(
			resolveTransformBackend(
				{ backend: "oxc" },
				{
					nodeVersion: "22.22.2",
					loadOxcParser: missingOxcLoader
				}
			)
		).rejects.toThrow(/backend "oxc".*install oxc-parser.*Node \^20\.19\.0 \|\| >=22\.12\.0/is)
	})

	it("throws an actionable error when backend oxc is requested on an unsupported Node runtime", async () => {
		await expect(
			resolveTransformBackend(
				{ backend: "oxc" },
				{
					nodeVersion: "18.19.0",
					loadOxcParser: async () => {
						throw new Error("OXC should not be loaded on unsupported Node")
					}
				}
			)
		).rejects.toThrow(/Current Node version 18\.19\.0 does not satisfy/)
	})

	it("includes non-Error loader failures in backend oxc errors", async () => {
		await expect(
			resolveTransformBackend(
				{ backend: "oxc" },
				{
					nodeVersion: "22.22.2",
					loadOxcParser: async () => {
						throw "plain loader failure"
					}
				}
			)
		).rejects.toThrow(/plain loader failure/)
	})

	it("treats a missing process Node version as unsupported and reports it as unknown", async () => {
		const originalProcess = globalThis.process
		vi.stubGlobal("process", undefined)

		const isSupported = supportsOxcRuntime()
		const backendPromise = resolveTransformBackend({ backend: "oxc" })

		vi.stubGlobal("process", originalProcess)

		expect(isSupported).toBe(false)
		await expect(backendPromise).rejects.toThrow(
			/Current Node version unknown does not satisfy/
		)
	})

	it("treats a process object without versions as an unsupported OXC runtime", () => {
		const originalProcess = globalThis.process
		vi.stubGlobal("process", {})

		const isSupported = supportsOxcRuntime()

		vi.stubGlobal("process", originalProcess)

		expect(isSupported).toBe(false)
	})

	it("treats a process versions object without node as an unsupported OXC runtime", () => {
		const originalProcess = globalThis.process
		vi.stubGlobal("process", { versions: {} })

		const isSupported = supportsOxcRuntime()

		vi.stubGlobal("process", originalProcess)

		expect(isSupported).toBe(false)
	})
})

describe("generateTransform backend option", () => {
	it("keeps Babel behavior when backend is explicitly babel", async () => {
		const transform = generateTransform({ backend: "babel" })

		const result = await transform(
			`// keep-console
console.log("keep");
console.warn("drop");
const value = condition ? console.error("drop expression") : /* keep-console */ console.info("keep expression");`,
			"file.ts"
		)

		expect(result.code).toContain('console.log("keep")')
		expect(result.code).toContain('console.info("keep expression")')
		expect(result.code).not.toContain("console.warn")
		expect(result.code).not.toContain("console.error")
		expect(result.code).toContain("condition ? undefined")
	})

	it("only processes included console methods with the Babel backend", async () => {
		const transform = generateTransform({
			backend: "babel",
			includes: ["error"]
		})

		const result = await transform(
			`console.log("keep");
console.error("drop");`,
			"file.ts"
		)

		expect(result.code).toContain('console.log("keep")')
		expect(result.code).not.toContain("console.error")
	})

	it("falls back to Babel once in auto mode when OXC cannot be loaded", async () => {
		let attempts = 0
		const transform = generateTransform(
			{ backend: "auto" },
			{
				nodeVersion: "22.22.2",
				loadOxcParser: async () => {
					attempts += 1
					throw new Error("Cannot find package 'oxc-parser'")
				}
			}
		)

		const first = await transform('console.log("first");', "file.js")
		const second = await transform('console.warn("second");', "file.js")

		expect(first.code).not.toContain("console.log")
		expect(second.code).not.toContain("console.warn")
		expect(attempts).toBe(1)
	})

	it("uses the OXC backend when explicitly requested and loaded dynamically", async () => {
		const code = `// keep-console
console.log("keep");
console.warn("drop");
const value = condition ? console.error("drop expression") : /* keep-console */ console.info("keep expression");`

		const transform = generateTransform(
			{ backend: "oxc" },
			{
				nodeVersion: "22.22.2",
				loadOxcParser: async () => ({
					parseSync: () => ({
						errors: [],
						comments: [
							{ type: "Line", value: " keep-console", start: 0, end: 15 },
							{ type: "Block", value: " keep-console ", start: 120, end: 138 }
						],
						program: {
							type: "Program",
							start: 0,
							end: code.length,
							body: [
								{
									type: "ExpressionStatement",
									start: 16,
									end: 36,
									expression: {
										type: "CallExpression",
										start: 16,
										end: 35,
										callee: {
											type: "MemberExpression",
											computed: false,
											object: { type: "Identifier", name: "console" },
											property: { type: "Identifier", name: "log" }
										},
										arguments: [{ type: "Literal", start: 28, end: 34 }]
									}
								},
								{
									type: "ExpressionStatement",
									start: 37,
									end: 58,
									expression: {
										type: "CallExpression",
										start: 37,
										end: 57,
										callee: {
											type: "MemberExpression",
											computed: false,
											object: { type: "Identifier", name: "console" },
											property: { type: "Identifier", name: "warn" }
										},
										arguments: [{ type: "Literal", start: 50, end: 56 }]
									}
								},
								{
									type: "VariableDeclaration",
									start: 59,
									end: code.length,
									declarations: [
										{
											type: "VariableDeclarator",
											start: 65,
											end: code.length - 1,
											init: {
												type: "ConditionalExpression",
												start: 73,
												end: code.length - 1,
												test: {
													type: "Identifier",
													name: "condition",
													start: 73,
													end: 82
												},
												consequent: {
													type: "CallExpression",
													start: 85,
													end: 117,
													callee: {
														type: "MemberExpression",
														computed: false,
														object: {
															type: "Identifier",
															name: "console"
														},
														property: {
															type: "Identifier",
															name: "error"
														}
													},
													arguments: [
														{ type: "Literal", start: 99, end: 116 }
													]
												},
												alternate: {
													type: "CallExpression",
													start: 139,
													end: 170,
													callee: {
														type: "MemberExpression",
														computed: false,
														object: {
															type: "Identifier",
															name: "console"
														},
														property: {
															type: "Identifier",
															name: "info"
														}
													},
													arguments: [
														{ type: "Literal", start: 152, end: 169 }
													]
												}
											}
										}
									]
								}
							]
						}
					})
				})
			}
		)

		const result = await transform(code, "file.ts")

		expect(result.code).toContain('console.log("keep")')
		expect(result.code).toContain('console.info("keep expression")')
		expect(result.code).not.toContain("console.warn")
		expect(result.code).not.toContain("console.error")
		expect(result.code).toContain("condition ? undefined")
	})
})
