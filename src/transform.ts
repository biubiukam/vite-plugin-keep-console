import { parse } from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import { generate } from "@babel/generator";
import * as t from "@babel/types";
import type { Comment, CallExpression, Node } from "@babel/types";
import type { ConsoleKeeperOptions } from "./types";

const traverseFun = typeof traverse !== "function" ? traverse.default : traverse

export function generateTransform(options?: ConsoleKeeperOptions) {
  const includes = options?.includes || [];
  const external = options?.external || [];
  const keepComments = options?.keepComments || ["keep-console"];

  return (code: string, id: string) => {
    if (!/\.(ts|tsx|js|jsx|vue|svelte)$/.test(id)) return { code };

    // Check if it's within the includes scope
    if (external.length > 0) {
      const isExternal = external.some((pattern) => {
        if (typeof pattern === "string") {
          // Normalize path separators for cross-platform compatibility
          const normalizedId = id.replace(/\\/g, "/");
          const normalizedPattern = pattern.replace(/\\/g, "/");
          return normalizedId.includes(normalizedPattern);
        } else if (pattern instanceof RegExp) {
          return pattern.test(id);
        }
        return false;
      });

      if (!isExternal) return { code };
    }

    // Parser options
    const ast = parse(code, {
      sourceType: "module",
      plugins: ["typescript", "jsx", "decorators-legacy", "classProperties"],
    });
	  
	traverseFun(ast, {
      CallExpression(path: NodePath<CallExpression>) {
        const node = path.node;
        // Check if it's any console.xxx method

        const isConsole =
          t.isMemberExpression(path.node.callee) &&
          t.isIdentifier(path.node.callee.object) &&
          path.node.callee.object.name === "console";

        const isIdentifier =
          !includes.length ||
          (t.isMemberExpression(path.node.callee) &&
            t.isIdentifier(path.node.callee.property) &&
            includes.includes(path.node.callee.property.name as any));

        if (isConsole && isIdentifier) {
          // Check all possible comment positions
          const leadingComments: Comment[] =
            node.leadingComments ||
            (path.parentPath.node as Node).leadingComments ||
            [];
          const trailingComments: Comment[] =
            node.trailingComments ||
            (path.parentPath.node as Node).trailingComments ||
            [];
          const innerComments: Comment[] =
            node.innerComments ||
            (path.parentPath.node as Node).innerComments ||
            [];

          // Check comments in parameters
          const argumentComments = node.arguments.flatMap((arg: Node) => {
            return [
              ...(arg.leadingComments || []),
              ...(arg.innerComments || []),
              ...(arg.trailingComments || []),
            ];
          });

          // Merge all comments
          const allComments: Comment[] = [
            ...leadingComments,
            ...trailingComments,
            ...innerComments,
            ...argumentComments,
          ];

          // Check if there's a keep marker
          const hasKeep = allComments.some((comment: Comment) =>
            keepComments.some((i) => comment.value.includes(i))
          );

          if (!hasKeep) {
            if (path.parentPath.isExpressionStatement()) {
              // If it's an expression statement, remove the entire statement
              path.parentPath.remove();
            } else {
              // If used in other contexts, replace with an empty object or undefined
              // Replace with undefined to maintain type compatibility
              path.replaceWith(t.identifier("undefined"));
            }
          }
        }
      },
    });

    const output = generate(ast, {
      sourceMaps: true,
      sourceFileName: id,
    });

    return {
      code: output.code,
      map: output.map,
    };
  };
}
