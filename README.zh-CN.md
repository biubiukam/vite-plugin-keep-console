# vite-plugin-keep-console

<div align="left">
  <a href="./README.md"><img alt="README in English" src="https://img.shields.io/badge/English-f9f9f9"></a>
  <a href="./README.zh-CN.md"><img alt="简体中文版自述文件" src="https://img.shields.io/badge/简体中文-f9f9f9"></a>
</div>

[![license][license-badge]][license-link]
![NPM Version](https://img.shields.io/npm/v/vite-plugin-keep-console)
[![codecov][codecov-badge]][codecov-link]

[license-badge]: https://img.shields.io/badge/license-MIT-blue.svg
[license-link]: LICENSE
[codecov-badge]: https://codecov.io/gh/biubiukam/vite-plugin-keep-console/graph/badge.svg?token=UEKBR30J97
[codecov-link]: https://codecov.io/gh/biubiukam/vite-plugin-keep-console

一个 Vite 插件，用于在生产构建中选择性地移除 console 语句。可以通过注释标记或指定要处理的 console 方法来保留特定的 console 语句。

## 安装

```bash
# npm
npm install vite-plugin-keep-console --save-dev

# yarn
yarn add vite-plugin-keep-console -D

# pnpm
pnpm add vite-plugin-keep-console -D
```

## 使用方法

在你的 `vite.config.js` 或 `vite.config.ts` 中添加插件：

```js
import { defineConfig } from "vite";
import ConsoleKeeper from "vite-plugin-keep-console";

export default defineConfig({
  plugins: [
    ConsoleKeeper({
      // 配置选项
    }),
  ],
});
```

## 配置选项

| 选项           | 类型                    | 默认值             | 描述                                                         |
| -------------- | ----------------------- | ------------------ | ------------------------------------------------------------ |
| `includes`     | `string[]`              | `[]`               | 要处理的 console 方法数组。如果为空，则处理所有 console 方法 |
| `external`     | `Array<string\|RegExp>` | `[]`               | 要包含进行处理的文件数组（字符串或正则表达式）               |
| `keepComments` | `string[]`              | `["keep-console"]` | 防止 console 语句被移除的注释标记数组                        |

### 支持的 Console 方法

插件支持处理所有标准的 console 方法：

- 基础方法: `debug`, `error`, `info`, `log`, `warn`
- 高级方法: `dir`, `dirxml`, `table`, `trace`, `group`, `groupCollapsed`, `groupEnd`, `clear`
- 性能方法: `count`, `countReset`, `time`, `timeLog`, `timeEnd`, `timeStamp`, `profile`, `profileEnd`
- 其他方法: `assert`, `context`, `createTask`, `memory`

## 使用示例

### 默认使用（处理所有 Console 方法）

```js
import { defineConfig } from "vite";
import ConsoleKeeper from "vite-plugin-keep-console";

export default defineConfig({
  plugins: [
    ConsoleKeeper(), // 将移除所有 console 语句，除了标记有 "keep-console" 注释的语句
  ],
});
```

### 只处理特定的 Console 方法

```js
import { defineConfig } from "vite";
import ConsoleKeeper from "vite-plugin-keep-console";

export default defineConfig({
  plugins: [
    ConsoleKeeper({
      includes: ["log", "error", "warn"], // 只处理 console.log、console.error 和 console.warn
    }),
  ],
});
```

### 包含特定文件进行处理

```js
import { defineConfig } from "vite";
import ConsoleKeeper from "vite-plugin-keep-console";

export default defineConfig({
  plugins: [
    ConsoleKeeper({
      external: ["src/**", /\.tsx?$/], // 只处理 src 文件夹中的文件和 TypeScript 文件
    }),
  ],
});
```

### 自定义注释标记

```js
import { defineConfig } from "vite";
import ConsoleKeeper from "vite-plugin-keep-console";

export default defineConfig({
  plugins: [
    ConsoleKeeper({
      keepComments: ["KEEP", "IMPORTANT", "DEBUG"],
    }),
  ],
});
```

## 使用注释标记

你可以通过添加注释标记来防止特定的 console 语句被移除：

```js
// keep-console
console.log("这条语句将在生产环境中保留");

/* keep-console */
console.error("这个错误信息也会被保留");

console.log("这条语句将在生产环境中被移除");

// 使用自定义标记（如果已配置）
// KEEP
console.log("使用自定义标记保留");

// IMPORTANT
console.warn("重要警告在生产环境中保留");
```

### 注释标记放置位置

注释标记可以放置在：

- console 语句之前（前导注释）
- console 语句之后（尾随注释）
- console 方法调用内部
- 参数之前

```js
// keep-console - 在语句之前
console.log("保留");

console.log("保留"); // keep-console - 在语句之后

console.log(/* keep-console */ "保留"); // 在调用内部

console.log(
  // keep-console - 在参数之前
  "保留"
);
```

## 工作原理

1. **文件处理**: 插件在构建阶段处理 `.ts`、`.tsx`、`.js`、`.jsx`、`.vue` 和 `.svelte` 文件
2. **Console 检测**: 识别代码中所有的 `console.*` 方法调用
3. **注释检查**: 对于每个 console 语句，检查各个位置的注释标记
4. **选择性移除**: 移除没有保留标记的 console 语句，保留标记的语句则被保留
5. **智能替换**: 当 console 语句用于表达式中时，用 `undefined` 替换以保持类型兼容性

## 许可证

MIT © [biubiukam](https://github.com/biubiukam)
