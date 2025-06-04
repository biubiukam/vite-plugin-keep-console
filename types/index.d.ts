declare module "@babel/traverse" {
  import * as t from "@babel/types";

  export interface NodePath<T = t.Node> {
    node: T;
    parentPath: NodePath;
    remove(): void;
    replaceWith(node: t.Node): void;
    isExpressionStatement(): boolean;
  }

  const traverse: (ast: any, visitors: any) => void;
  export default { default: traverse };
}

declare module "@babel/generator" {
  interface GenerateResult {
    code: string;
    map: any;
  }

  export function generate(ast: any, options?: any): GenerateResult;
}
