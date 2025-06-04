import { describe, it, expect } from "vitest";
import { ConsoleKeeper } from "../src";

describe("vite-plugin-keep-console", () => {
  it("should be defined", () => {
    expect(ConsoleKeeper).toBeDefined();
  });

  it("should return a valid Vite plugin", () => {
    const plugin = ConsoleKeeper();
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe("vite-plugin-keep-console");
    expect(plugin.enforce).toBe("pre");
    expect(typeof plugin.transform).toBe("function");
  });

  it("should ignore non-JS/TS files", async () => {
    const plugin = ConsoleKeeper();
    const code = 'console.log("test");';
    const result = await plugin.transform(code, "file.css");

    console.log(result);
    expect(result.code).toBe(code);
  });

  it("should remove console statements without keep comment", () => {
    const plugin = ConsoleKeeper();
    const code = 'console.log("test");';
    const result = plugin.transform(code, "file.js");
    expect(typeof result).toBe("object");
    expect(result.code).not.toContain("console.log");
  });

  it("should keep console statements with default keep comment", () => {
    const plugin = ConsoleKeeper();
    const code = '// keep-console\nconsole.log("test");';
    const result = plugin.transform(code, "file.js");
    expect(typeof result).toBe("object");
    expect(result.code).toContain("console.log");
  });

  it("should use custom keep comments", () => {
    const plugin = ConsoleKeeper({ keepComments: ["preserve-log"] });
    const code = '// preserve-log\nconsole.log("test");';
    const result = plugin.transform(code, "file.js");
    expect(typeof result).toBe("object");
    expect(result.code).toContain("console.log");
  });

  it("should respect includes option with string pattern", () => {
    const plugin = ConsoleKeeper({ external: ["src/components"] });

    const includeCode = 'console.log("test");';
    const includeResult = plugin.transform(
      includeCode,
      "src/components/test.js"
    );
    expect(typeof includeResult).toBe("object");
    expect(includeResult.code).not.toContain("console.log");

    const excludeCode = 'console.log("test");';
    const excludeResult = plugin.transform(excludeCode, "src/utils/test.js");
    expect(excludeResult.code).toBe(excludeCode);
  });

  it("should respect includes option with RegExp pattern", () => {
    const plugin = ConsoleKeeper({ external: [/components\/.*\.js$/] });

    const includeCode = 'console.log("test");';
    const includeResult = plugin.transform(
      includeCode,
      "src/components/test.js"
    );
    expect(typeof includeResult).toBe("object");
    expect(includeResult.code).not.toContain("console.log");

    const excludeCode = 'console.log("test");';
    const excludeResult = plugin.transform(excludeCode, "src/utils/test.js");
    expect(excludeResult.code).toBe(excludeCode);
  });
});
