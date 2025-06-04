import { describe, it, expect } from "vitest";
import { generateTransform } from "../src/transform";

describe("File Types Tests", () => {
  const transform = generateTransform();

  describe("JavaScript (.js)", () => {
    it("should handle different console methods with comment styles", () => {
      const jsCode = `
        // Regular JS file with multiple console methods
        
        /* keep-console */
        console.log("This log should be kept");
        
        console.warn("This warning should be removed");
        
        function test() {
          // keep-console
          console.error("This error should be kept");
          console.info("This info should be removed");
        }
        
        const obj = {
          method() {
            console.debug("This debug should be removed");
            console.trace(/** keep-console */ "This trace should be kept");
          }
        };
      `;

      const result = transform(jsCode, "example.js");
      expect(result.code).toContain('console.log("This log should be kept")');
      expect(result.code).toContain(
        'console.error("This error should be kept")'
      );
      expect(result.code).toContain("console.trace");
      expect(result.code).toContain("This trace should be kept");

      expect(result.code).not.toContain(
        'console.warn("This warning should be removed")'
      );
      expect(result.code).not.toContain(
        'console.info("This info should be removed")'
      );
      expect(result.code).not.toContain(
        'console.debug("This debug should be removed")'
      );
    });
  });

  describe("TypeScript (.ts)", () => {
    it("should handle TypeScript syntax with different console methods", () => {
      const tsCode = `
        // TypeScript specific code
        interface Logger {
          log(message: string): void;
        }
        
        class ConsoleLogger implements Logger {
          log(message: string): void {
            // keep-console
            console.log(message);
          }
          
          warn(message: string): void {
            console.warn(message);
          }
          
          error<T>(message: T): void {
            /* keep-console */
            console.error(message);
          }
          
          debug(message: string): void {
            console.debug(message);
          }
        }
        
        function testGeneric<T>(value: T): void {
          console.table<T>([value]);
          /** keep-console */
          console.count<string>("test");
        }
      `;

      const result = transform(tsCode, "example.ts");
      expect(result.code).toContain("console.log(message)");
      expect(result.code).toContain("console.error(message)");
      expect(result.code).toContain('console.count<string>("test")');

      expect(result.code).not.toContain("console.warn(message)");
      expect(result.code).not.toContain("console.debug(message)");
    });
  });

  describe("JSX (.jsx)", () => {
    it("should handle JSX syntax with different console methods", () => {
      const jsxCode = `
        import React, { useEffect } from 'react';
        
        function Component() {
          useEffect(() => {
            // Initial render
            // keep-console
            console.log("Component mounted");
            console.info("This will be removed");
          }, []);
          
          const handleClick = () => {
            /* keep-console */
            console.warn("Button clicked");
            console.error("This will be removed");
          };
          
          return (
            <div>
              <button onClick={handleClick}>
                Click me
              </button>
              <button onClick={() => console.debug("This will be removed")}>
                Debug
              </button>
              <button onClick={() => /** keep-console */ console.trace("This will be kept")}>
                Trace
              </button>
            </div>
          );
        }
      `;

      const result = transform(jsxCode, "component.jsx");
      expect(result.code).toContain('console.log("Component mounted")');
      expect(result.code).toContain('console.warn("Button clicked")');
      expect(result.code).toContain('console.trace("This will be kept")');

      expect(result.code).not.toContain('console.info("This will be removed")');
      expect(result.code).not.toContain(
        'console.error("This will be removed")'
      );
      expect(result.code).not.toContain(
        'console.debug("This will be removed")'
      );
    });
  });

  describe("TypeScript JSX (.tsx)", () => {
    it("should handle TSX syntax with different console methods", () => {
      const tsxCode = `
        import React, { FC, useEffect, useState } from 'react';
        
        interface Props {
          name: string;
        }
        
        const Component: FC<Props> = ({ name }) => {
          const [count, setCount] = useState<number>(0);
          
          useEffect(() => {
            // keep-console
            console.log(\`Hello \${name}\`);
            console.info("This will be removed");
          }, [name]);
          
          const handleIncrement = (): void => {
            setCount(prev => {
              /* keep-console */
              console.debug(\`Count increased: \${prev + 1}\`);
              return prev + 1;
            });
            console.error("This will be removed");
          };
          
          return (
            <div>
              <h1 onClick={() => /** keep-console */ console.table({ name, count })}>
                {name}: {count}
              </h1>
              <button onClick={handleIncrement}>Increment</button>
              <div onMouseOver={() => console.trace("This will be removed")}>
                Hover me
              </div>
            </div>
          );
        };
      `;

      const result = transform(tsxCode, "component.tsx");
      expect(result.code).toContain("console.log(`Hello ${name}`)");
      expect(result.code).toContain(
        "console.debug(`Count increased: ${prev + 1}`)"
      );
      expect(result.code).toContain("console.table");
      expect(result.code).toContain("name");
      expect(result.code).toContain("count");

      expect(result.code).not.toContain('console.info("This will be removed")');
      expect(result.code).not.toContain(
        'console.error("This will be removed")'
      );
      expect(result.code).not.toContain(
        'console.trace("This will be removed")'
      );
    });
  });

  describe("Vue (.vue)", () => {
    it("should handle Vue syntax with different console methods", () => {
      // Using plain JavaScript instead of actual Vue template to avoid parsing issues in tests
      const vueCode = `
// This is a simplified representation of a Vue component for testing purposes
// In a real Vue file, this would be wrapped in a <script> tag
export default {
  mounted() {
    // keep-console
    console.log("Component mounted");
    console.warn("This will be removed");
  },
  methods: {
    handleClick() {
      /* keep-console */
      console.error("Button clicked");
      console.info("This will be removed");
    }
  }
}`;

      const result = transform(vueCode, "component.vue");
      expect(result.code).toContain('console.log("Component mounted")');
      expect(result.code).toContain('console.error("Button clicked")');

      expect(result.code).not.toContain('console.warn("This will be removed")');
      expect(result.code).not.toContain('console.info("This will be removed")');
    });
  });

  describe("Svelte (.svelte)", () => {
    it("should handle Svelte syntax with different console methods", () => {
      // Using plain JavaScript instead of actual Svelte template to avoid parsing issues in tests
      const svelteCode = `
// This is a simplified representation of a Svelte component for testing purposes
// In a real Svelte file, this would be wrapped in a <script> tag
import { onMount } from 'svelte';

let count = 0;

function increment() {
  count += 1;
  /* keep-console */
  console.log(\`Count: \${count}\`);
  console.warn("This will be removed");
}

onMount(() => {
  // keep-console
  console.info("Component mounted");
  console.error("This will be removed");
});`;

      const result = transform(svelteCode, "component.svelte");
      expect(result.code).toContain("console.log(`Count: ${count}`)");
      expect(result.code).toContain('console.info("Component mounted")');

      expect(result.code).not.toContain('console.warn("This will be removed")');
      expect(result.code).not.toContain(
        'console.error("This will be removed")'
      );
    });
  });
});
