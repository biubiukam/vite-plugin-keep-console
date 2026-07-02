import { describe, it, expect } from "vitest"
import { generateTransform } from "../src/transform"

describe("transform.ts", () => {
	const consoleMethods = [
		"log",
		"warn",
		"error",
		"info",
		"debug",
		"trace",
		"table",
		"count",
		"time",
		"timeEnd",
		"assert",
		"dir",
		"dirxml",
		"group",
		"groupEnd",
		"profile",
		"profileEnd",
		"timeStamp"
	]

	const fileExtensions = ["js", "jsx", "ts", "tsx", "vue", "svelte"]

	const commentStyles = {
		blockComment: "/* keep-console */",
		lineComment: "// keep-console",
		jsDocComment: "/** keep-console */"
	}

	const transform = generateTransform()

	it("should handle all console methods with different comment styles", async () => {
		for (const method of consoleMethods) {
			for (const format of Object.values(commentStyles)) {
				const codeWithLeadingComment = `${format}\nconsole.${method}("This is a ${method} message");`
				const resultLeading = await transform(codeWithLeadingComment, "test.js")
				expect(resultLeading.code).toContain(`console.${method}`)

				const codeWithTrailingComment = `console.${method}("This is a ${method} message"); ${format}`
				const resultTrailing = await transform(codeWithTrailingComment, "test.js")
				expect(resultTrailing.code).toContain(`console.${method}`)

				if (format !== commentStyles.lineComment) {
					const codeWithInlineComment = `console.${method}(${format});`
					const resultInline = await transform(codeWithInlineComment, "test.js")
					expect(resultInline.code).toContain(`console.${method}`)
				}
			}

			const codeWithoutComment = `console.${method}("This should be removed");`
			const resultWithoutComment = await transform(codeWithoutComment, "test.js")
			expect(resultWithoutComment.code).not.toContain(`console.${method}`)
		}
	})

	it("should process different file types correctly", async () => {
		for (const ext of fileExtensions) {
			const codeToKeep = `// keep-console\nconsole.log("This should be kept");`
			const resultToKeep = await transform(codeToKeep, `test.${ext}`)
			expect(resultToKeep.code).toContain("console.log")

			const codeToRemove = `console.log("This should be removed");`
			const resultToRemove = await transform(codeToRemove, `test.${ext}`)
			expect(resultToRemove.code).not.toContain("console.log")
		}
	})

	it("should handle complex code scenarios", async () => {
		const nestedCode = `
      function test() {
        if (condition) {
          // keep-console
          console.log("Keep this");
          console.warn("Remove this");
        }
      }
    `
		const nestedResult = await transform(nestedCode, "test.js")
		expect(nestedResult.code).toContain("console.log")
		expect(nestedResult.code).not.toContain("console.warn")

		const expressionCode = `
      const result = condition ? console.log("Remove this") : /* keep-console */ console.warn("Keep this");
    `
		const expressionResult = await transform(expressionCode, "test.js")
		expect(expressionResult.code).not.toContain("console.log")
		expect(expressionResult.code).toContain("console.warn")
	})

	it("preserves console argument evaluation when preserveArguments is enabled", async () => {
		const transform = generateTransform({
			backend: "babel",
			preserveArguments: true
		})

		const result = await transform(
			[
				"console.log(expensive(), value);",
				"const result = condition ? console.warn(sideEffect()) : 1;"
			].join("\n"),
			"test.js"
		)

		expect(result.code).not.toContain("console.log")
		expect(result.code).not.toContain("console.warn")
		expect(result.code).toContain("expensive(), value, undefined")
		expect(result.code).toContain("condition ? (sideEffect(), undefined) : 1")

		const noArgumentResult = await transform("const value = console.error();", "test.js")
		expect(noArgumentResult.code).toContain("const value = undefined")

		const spreadResult = await transform("console.log(...items);", "test.js")
		expect(spreadResult.code).toContain("items, undefined")
	})

	it("keeps code unchanged in report mode while still honoring keep comments", async () => {
		const transform = generateTransform({
			backend: "babel",
			mode: "report"
		})

		const result = await transform(
			["console.log('reported');", "// keep-console", "console.warn('kept');"].join("\n"),
			"test.js"
		)

		expect(result.code).toContain("console.log")
		expect(result.code).toContain("console.warn")
	})

	it("keeps matching console calls unchanged in keep mode", async () => {
		const transform = generateTransform({
			backend: "babel",
			mode: "keep"
		})

		const result = await transform("console.error('keep mode');", "test.js")

		expect(result.code).toContain("console.error")
	})

	it("handles computed console calls across keep, method filter, and report branches", async () => {
		const keepTransform = generateTransform({
			backend: "babel"
		})
		const filteredTransform = generateTransform({
			backend: "babel",
			methods: ["error"]
		})
		const reportTransform = generateTransform({
			backend: "babel",
			mode: "report"
		})

		const kept = await keepTransform('/* keep-console */ console["log"]("keep");', "test.js")
		const filtered = await filteredTransform('console["error"]("filtered");', "test.js")
		const reported = await reportTransform('console["warn"]("reported");', "test.js")

		expect(kept.code).toContain('console["log"]')
		expect(filtered.code).toContain('console["error"]')
		expect(reported.code).toContain('console["warn"]')
	})

	it("leaves non-console member calls untouched", async () => {
		const result = await transform('logger.warn("keep logger");', "test.js")

		expect(result.code).toContain("logger.warn")
	})

	it("should keep legacy behavior for computed console members when includes is empty", async () => {
		const result = await transform(`console["log"]("Remove this");`, "test.js")

		expect(result.code).not.toContain("console")
	})

	it("should respect custom keepComments configuration", async () => {
		const customTransform = generateTransform({
			keepComments: ["preserve-log"]
		})

		const codeWithCustomMarker = `// preserve-log\nconsole.log("Keep this");`
		const resultWithCustomMarker = await customTransform(codeWithCustomMarker, "test.js")
		expect(resultWithCustomMarker.code).toContain("console.log")

		const codeWithDefaultMarker = `// keep-console\nconsole.log("Remove this");`
		const resultWithDefaultMarker = await customTransform(codeWithDefaultMarker, "test.js")
		expect(resultWithDefaultMarker.code).not.toContain("console.log")
	})

	it("should respect includes option", async () => {
		const includesTransform = generateTransform({
			external: ["src/components"]
		})

		const code = `console.log("Process this");`

		const resultIncluded = await includesTransform(code, "src/components/Component.vue")
		expect(resultIncluded.code).not.toContain("console.log")

		const resultNotIncluded = await includesTransform(code, "src/utils/helper.js")
		expect(resultNotIncluded.code).toBe(code)
	})

	it("should properly handle TypeScript and JSX syntax", async () => {
		const tsCode = `
      interface Logger {
        log: (message: string) => void;
      }
      
      // keep-console
      console.log<string>("TypeScript generic");
      
      const x = 5;
      console.error("This should be removed");
    `
		const tsResult = await transform(tsCode, "test.ts")
		expect(tsResult.code).toContain("console.log")
		expect(tsResult.code).not.toContain("console.error")

		const jsxCode = `
      function Component() {
        useEffect(() => {
          /* keep-console */
          console.log("Render");
          console.info("This should be removed");
        }, []);
        
        return <div onClick={() => console.debug("Remove this")}>Hello</div>;
      }
    `
		const jsxResult = await transform(jsxCode, "test.jsx")
		expect(jsxResult.code).toContain("console.log")
		expect(jsxResult.code).not.toContain("console.info")
		expect(jsxResult.code).not.toContain("console.debug")
	})

	it("should handle Vue and Svelte files", async () => {
		const vueCode = `
// This is a simplified representation of a Vue component for testing purposes
export default {
  mounted() {
    /** keep-console */
    console.log("Component mounted");
    console.warn("This should be removed");
  }
}
`
		const vueResult = await transform(vueCode, "Component.vue")
		expect(vueResult.code).toContain('console.log("Component mounted")')
		expect(vueResult.code).not.toContain('console.warn("This should be removed")')

		const svelteCode = `
// This is a simplified representation of a Svelte component for testing purposes
import { onMount } from 'svelte';
  
onMount(() => {
  // keep-console
  console.log("Svelte component mounted");
  console.error("This should be removed");
});
`
		const svelteResult = await transform(svelteCode, "Component.svelte")
		expect(svelteResult.code).toContain('console.log("Svelte component mounted")')
		expect(svelteResult.code).not.toContain('console.error("This should be removed")')
	})
})
