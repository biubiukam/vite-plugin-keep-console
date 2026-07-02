import { describe, it, expect, vi } from "vitest"
import { ConsoleKeeper } from "../src"

describe("vite-plugin-keep-console", () => {
	it("should be defined", () => {
		expect(ConsoleKeeper).toBeDefined()
	})

	it("should return a valid Vite plugin", () => {
		const plugin = ConsoleKeeper()
		expect(plugin).toBeDefined()
		expect(plugin.name).toBe("vite-plugin-keep-console")
		expect(plugin.enforce).toBe("pre")
		expect(typeof plugin.transform).toBe("function")
	})

	it("should ignore non-JS/TS files", async () => {
		const plugin = ConsoleKeeper()
		const code = 'console.log("test");'
		const result = await plugin.transform(code, "file.css")

		expect(result.code).toBe(code)
	})

	it("should remove console statements without keep comment", async () => {
		const plugin = ConsoleKeeper()
		const code = 'console.log("test");'
		const result = await plugin.transform(code, "file.js")
		expect(typeof result).toBe("object")
		expect(result.code).not.toContain("console.log")
	})

	it("should keep console statements with default keep comment", async () => {
		const plugin = ConsoleKeeper()
		const code = '// keep-console\nconsole.log("test");'
		const result = await plugin.transform(code, "file.js")
		expect(typeof result).toBe("object")
		expect(result.code).toContain("console.log")
	})

	it("should use custom keep comments", async () => {
		const plugin = ConsoleKeeper({ keepComments: ["preserve-log"] })
		const code = '// preserve-log\nconsole.log("test");'
		const result = await plugin.transform(code, "file.js")
		expect(typeof result).toBe("object")
		expect(result.code).toContain("console.log")
	})

	it("should respect includes option with string pattern", async () => {
		const plugin = ConsoleKeeper({ external: ["src/components"] })

		const includeCode = 'console.log("test");'
		const includeResult = await plugin.transform(includeCode, "src/components/test.js")
		expect(typeof includeResult).toBe("object")
		expect(includeResult.code).not.toContain("console.log")

		const excludeCode = 'console.log("test");'
		const excludeResult = await plugin.transform(excludeCode, "src/utils/test.js")
		expect(excludeResult.code).toBe(excludeCode)
	})

	it("should respect includes option with RegExp pattern", async () => {
		const plugin = ConsoleKeeper({ external: [/components\/.*\.js$/] })

		const includeCode = 'console.log("test");'
		const includeResult = await plugin.transform(includeCode, "src/components/test.js")
		expect(typeof includeResult).toBe("object")
		expect(includeResult.code).not.toContain("console.log")

		const excludeCode = 'console.log("test");'
		const excludeResult = await plugin.transform(excludeCode, "src/utils/test.js")
		expect(excludeResult.code).toBe(excludeCode)
	})

	it("reports aggregated removed, kept, and skipped console calls at build end", async () => {
		const plugin = ConsoleKeeper({
			backend: "babel",
			methods: ["error"],
			report: "summary"
		})
		const warn = vi.fn()

		await plugin.transform(
			[
				"console.log('skipped by method');",
				"// keep-console",
				"console.error('kept');",
				"console.error('removed');"
			].join("\n"),
			"src/main.ts"
		)

		plugin.buildEnd.call({ warn })

		expect(warn).toHaveBeenCalledOnce()
		expect(warn.mock.calls[0][0]).toContain("removed: 1")
		expect(warn.mock.calls[0][0]).toContain("kept: 1")
		expect(warn.mock.calls[0][0]).toContain("skipped: 1")
	})

	it("resets aggregated report state on build start and supports detailed output", async () => {
		const plugin = ConsoleKeeper({
			backend: "babel",
			report: "detailed"
		})
		const warn = vi.fn()

		await plugin.transform("console.error('old build');", "src/old.ts")
		plugin.buildStart()
		await plugin.transform(
			["// keep-console", "console.error('new build');"].join("\n"),
			"src/new.ts"
		)

		plugin.buildEnd.call({ warn })

		expect(warn).toHaveBeenCalledOnce()
		expect(warn.mock.calls[0][0]).toContain("removed: 0")
		expect(warn.mock.calls[0][0]).toContain("kept: 1")
		expect(warn.mock.calls[0][0]).toContain("- src/new.ts: removed: 0, kept: 1, skipped: 0")
		expect(warn.mock.calls[0][0]).not.toContain("src/old.ts")
	})

	it("fails the build at build end when failOnConsole is enabled and policy findings exist", async () => {
		const plugin = ConsoleKeeper({
			backend: "babel",
			mode: "report",
			failOnConsole: true,
			report: false
		})

		await plugin.transform("console.error('reported only');", "src/main.ts")

		expect(() => plugin.buildEnd.call({ warn: vi.fn() })).toThrow(
			/vite-plugin-keep-console found 1 console call/
		)
	})

	it("uses plural wording when failOnConsole finds multiple policy violations", async () => {
		const plugin = ConsoleKeeper({
			backend: "babel",
			failOnConsole: true
		})

		await plugin.transform(
			["console.error('first');", "console.warn('second');"].join("\n"),
			"src/main.ts"
		)

		expect(() => plugin.buildEnd.call({ warn: vi.fn() })).toThrow(
			/vite-plugin-keep-console found 2 console calls/
		)
	})

	it("reports SFC script blocks that produce no transform stats", async () => {
		const plugin = ConsoleKeeper({
			backend: "babel",
			report: true
		})
		const warn = vi.fn()

		await plugin.transform(
			"<template><p>Hello</p></template><script>const value = 1;</script>",
			"src/App.vue"
		)
		plugin.buildEnd.call({ warn })

		expect(warn.mock.calls[0][0]).toContain("removed: 0, kept: 0, skipped: 0")
	})
})
