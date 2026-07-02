import { describe, expect, it } from "vitest"
import {
	cleanId,
	normalizeOptions,
	shouldProcessConsoleMethod,
	shouldTransformFile
} from "../src/options"

describe("options", () => {
	it("cleans query and hash suffixes from file ids", () => {
		expect(cleanId("src/App.vue?vue&type=script")).toBe("src/App.vue")
		expect(cleanId("src/App.tsx#debug")).toBe("src/App.tsx")
	})

	it("matches external string patterns after normalizing Windows path separators", () => {
		const options = normalizeOptions({
			external: ["src/components"]
		})

		expect(shouldTransformFile("src\\components\\Button.tsx?raw", options)).toBe(true)
		expect(shouldTransformFile("src\\utils\\logger.ts", options)).toBe(false)
	})

	it("matches external regular expression patterns against cleaned file ids", () => {
		const options = normalizeOptions({
			external: [/components\/.*\.vue$/]
		})

		expect(shouldTransformFile("src/components/Button.vue?type=script", options)).toBe(true)
		expect(shouldTransformFile("src/components/Button.css", options)).toBe(false)
	})

	it("matches include and exclude patterns before transforming files", () => {
		const options = normalizeOptions({
			include: ["src"],
			exclude: [/src\/vendor\//]
		})

		expect(shouldTransformFile("src/components/Button.tsx", options)).toBe(true)
		expect(shouldTransformFile("src/vendor/debug.ts", options)).toBe(false)
		expect(shouldTransformFile("tests/debug.ts", options)).toBe(false)
	})

	it("processes every console method by default and only configured methods when set", () => {
		expect(shouldProcessConsoleMethod("log", normalizeOptions())).toBe(true)

		const options = normalizeOptions({
			methods: ["error"]
		})

		expect(shouldProcessConsoleMethod("error", options)).toBe(true)
		expect(shouldProcessConsoleMethod("log", options)).toBe(false)
	})

	it("keeps legacy includes and external aliases compatible with the new option names", () => {
		const options = normalizeOptions({
			includes: ["warn"],
			external: ["src/components"]
		})

		expect(shouldProcessConsoleMethod("warn", options)).toBe(true)
		expect(shouldProcessConsoleMethod("error", options)).toBe(false)
		expect(shouldTransformFile("src/components/Button.tsx", options)).toBe(true)
		expect(shouldTransformFile("src/pages/App.tsx", options)).toBe(false)
	})

	it("normalizes policy mode, report, fail gate, and preserveArguments defaults", () => {
		expect(normalizeOptions()).toMatchObject({
			mode: "remove",
			report: false,
			failOnConsole: false,
			preserveArguments: false
		})

		expect(
			normalizeOptions({
				mode: "report",
				report: "detailed",
				failOnConsole: true,
				preserveArguments: true
			})
		).toMatchObject({
			mode: "report",
			report: "detailed",
			failOnConsole: true,
			preserveArguments: true
		})
	})
})
