import { describe, it, expect } from "vitest";
import { generateTransform } from "../src/transform";

describe("transform.ts", () => {
  // List of all common console methods to test
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
    "timeStamp",
  ];

  // List of file extensions to test
  const fileExtensions = ["js", "jsx", "ts", "tsx", "vue", "svelte"];

  const commentStyles = {
    blockComment: "/* keep-console */",
    lineComment: "// keep-console",
    jsDocComment: "/** keep-console */",
  };
  // Different comment styles
  //   const commentStyles = [
  //     { name: "block comment", format: "/* keep-console */" },
  //     { name: "line comment", format: "// keep-console" },
  //     { name: "JSDoc style", format: "/** keep-console */" },
  //   ];

  // Standard transformation function
  const transform = generateTransform();

  it("should handle all console methods with different comment styles", () => {
    // Test each method with each comment style individually
    consoleMethods.forEach((method) => {
      Object.keys(commentStyles).forEach((commentStylesKey) => {
        const format = commentStyles[commentStylesKey];
        // Test with leading comment
        const codeWithLeadingComment = `${format}\nconsole.${method}("This is a ${method} message");`;
        const resultLeading = transform(codeWithLeadingComment, "test.js");
        expect(resultLeading.code).toContain(`console.${method}`);

        // Test with trailing comment
        const codeWithTrailingComment = `console.${method}("This is a ${method} message"); ${format}`;
        const resultTrailing = transform(codeWithTrailingComment, "test.js");
        expect(resultTrailing.code).toContain(`console.${method}`);

        // Test with inline comment (without parameters)
        if (format !== commentStyles.lineComment) {
          const codeWithInlineComment = `console.${method}(${format});`;
          const resultInline = transform(codeWithInlineComment, "test.js");
          expect(resultInline.code).toContain(`console.${method}`);
        }
      });

      // Test without any keep comment (should be removed)
      const codeWithoutComment = `console.${method}("This should be removed");`;
      const resultWithoutComment = transform(codeWithoutComment, "test.js");
      expect(resultWithoutComment.code).not.toContain(`console.${method}`);
    });
  });

  it("should process different file types correctly", () => {
    fileExtensions.forEach((ext) => {
      // Console call that should be kept
      const codeToKeep = `// keep-console\nconsole.log("This should be kept");`;
      const resultToKeep = transform(codeToKeep, `test.${ext}`);
      expect(resultToKeep.code).toContain("console.log");

      // Console call that should be removed
      const codeToRemove = `console.log("This should be removed");`;
      const resultToRemove = transform(codeToRemove, `test.${ext}`);
      expect(resultToRemove.code).not.toContain("console.log");
    });
  });

  it("should handle complex code scenarios", () => {
    // Test nested console calls
    const nestedCode = `
      function test() {
        if (condition) {
          // keep-console
          console.log("Keep this");
          console.warn("Remove this");
        }
      }
    `;
    const nestedResult = transform(nestedCode, "test.js");
    expect(nestedResult.code).toContain("console.log");
    expect(nestedResult.code).not.toContain("console.warn");

    // Test console calls inside expressions
    const expressionCode = `
      const result = condition ? console.log("Remove this") : /* keep-console */ console.warn("Keep this");
    `;
    const expressionResult = transform(expressionCode, "test.js");
    expect(expressionResult.code).not.toContain("console.log");
    expect(expressionResult.code).toContain("console.warn");
  });

  it("should respect custom keepComments configuration", () => {
    const customTransform = generateTransform({
      keepComments: ["preserve-log"],
    });

    // Should keep comment with custom marker
    const codeWithCustomMarker = `// preserve-log\nconsole.log("Keep this");`;
    const resultWithCustomMarker = customTransform(
      codeWithCustomMarker,
      "test.js"
    );
    expect(resultWithCustomMarker.code).toContain("console.log");

    // Should not keep with default marker
    const codeWithDefaultMarker = `// keep-console\nconsole.log("Remove this");`;
    const resultWithDefaultMarker = customTransform(
      codeWithDefaultMarker,
      "test.js"
    );
    expect(resultWithDefaultMarker.code).not.toContain("console.log");
  });

  it("should respect includes option", () => {
    const includesTransform = generateTransform({
      external: ["src/components"],
    });

    // Should process files in includes paths
    const code = `console.log("Process this");`;

    const resultIncluded = includesTransform(
      code,
      "src/components/Component.vue"
    );
    expect(resultIncluded.code).not.toContain("console.log");

    const resultNotIncluded = includesTransform(code, "src/utils/helper.js");
    expect(resultNotIncluded.code).toBe(code);
  });

  it("should properly handle TypeScript and JSX syntax", () => {
    // TypeScript code
    const tsCode = `
      interface Logger {
        log: (message: string) => void;
      }
      
      // keep-console
      console.log<string>("TypeScript generic");
      
      const x = 5;
      console.error("This should be removed");
    `;
    const tsResult = transform(tsCode, "test.ts");
    expect(tsResult.code).toContain("console.log");
    expect(tsResult.code).not.toContain("console.error");

    // JSX code
    const jsxCode = `
      function Component() {
        useEffect(() => {
          /* keep-console */
          console.log("Render");
          console.info("This should be removed");
        }, []);
        
        return <div onClick={() => console.debug("Remove this")}>Hello</div>;
      }
    `;
    const jsxResult = transform(jsxCode, "test.jsx");
    expect(jsxResult.code).toContain("console.log");
    expect(jsxResult.code).not.toContain("console.info");
    expect(jsxResult.code).not.toContain("console.debug");
  });

  it("should handle Vue and Svelte files", () => {
    // Vue code with script only
    const vueCode = `
// This is a simplified representation of a Vue component for testing purposes
export default {
  mounted() {
    /** keep-console */
    console.log("Component mounted");
    console.warn("This should be removed");
  }
}
`;
    const vueResult = transform(vueCode, "Component.vue");
    expect(vueResult.code).toContain('console.log("Component mounted")');
    expect(vueResult.code).not.toContain(
      'console.warn("This should be removed")'
    );

    // Svelte code with script only
    const svelteCode = `
// This is a simplified representation of a Svelte component for testing purposes
import { onMount } from 'svelte';
  
onMount(() => {
  // keep-console
  console.log("Svelte component mounted");
  console.error("This should be removed");
});
`;
    const svelteResult = transform(svelteCode, "Component.svelte");
    expect(svelteResult.code).toContain(
      'console.log("Svelte component mounted")'
    );
    expect(svelteResult.code).not.toContain(
      'console.error("This should be removed")'
    );
  });
});
