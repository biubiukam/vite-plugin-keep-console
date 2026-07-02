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

一个用于生产构建 console 策略治理的 Vite 插件。可以按方法、文件路径、注释标记和策略模式来移除、保留、报告 console 语句，或让构建失败。

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
import { defineConfig } from "vite"
import ConsoleKeeper from "vite-plugin-keep-console"

export default defineConfig({
	plugins: [
		ConsoleKeeper({
			// 配置选项
			backend: "auto"
		})
	]
})
```

## 配置选项

| 选项                | 类型                             | 默认值             | 描述                                                         |
| ------------------- | -------------------------------- | ------------------ | ------------------------------------------------------------ |
| `backend`           | `"auto"\|"oxc"\|"babel"`         | `"auto"`           | AST 后端。默认优先使用 OXC，也可强制使用 OXC 或 Babel        |
| `methods`           | `string[]`                       | `[]`               | 要处理的 console 方法数组。如果为空，则处理所有 console 方法 |
| `include`           | `Array<string\|RegExp>`          | `[]`               | 要包含进行处理的文件数组。字符串按路径子串匹配               |
| `exclude`           | `Array<string\|RegExp>`          | `[]`               | 要排除处理的文件数组                                         |
| `keepComments`      | `string[]`                       | `["keep-console"]` | 防止 console 语句被移除的注释标记数组                        |
| `mode`              | `"remove"\|"report"\|"keep"`     | `"remove"`         | 未标记 console 命中规则后的处理模式                          |
| `report`            | `boolean\|"summary"\|"detailed"` | `false`            | 在构建结束时输出 removed、kept、skipped 汇总报告             |
| `failOnConsole`     | `boolean`                        | `false`            | 发现未标记且命中规则的 console 时让构建失败                  |
| `preserveArguments` | `boolean`                        | `false`            | 移除 console 时保留参数求值                                  |

`includes` 会继续作为 `methods` 的兼容别名保留。`external` 会继续作为 `include` 的兼容别名保留。

### 后端策略

插件支持两个转换后端：

- `backend: "auto"`：当当前 Node 运行时满足 OXC 要求，并且可以动态加载 `oxc-parser` 时使用 OXC；否则自动回退到 Babel 后端。
- `backend: "oxc"`：强制使用 OXC。如果 `oxc-parser` 加载失败，会抛出明确错误，提示安装 OXC 或升级 Node。
- `backend: "babel"`：使用旧版 Babel 实现，适用于旧 Node/Vite 环境。

OXC 通过 dynamic import 加载，不会在主入口静态引入，因此旧环境仍可使用 Babel 后端。

### 支持的 Console 方法

插件支持处理所有标准的 console 方法：

- 基础方法: `debug`, `error`, `info`, `log`, `warn`
- 高级方法: `dir`, `dirxml`, `table`, `trace`, `group`, `groupCollapsed`, `groupEnd`, `clear`
- 性能方法: `count`, `countReset`, `time`, `timeLog`, `timeEnd`, `timeStamp`, `profile`, `profileEnd`
- 其他方法: `assert`, `context`, `createTask`, `memory`

## 使用示例

### 默认使用（处理所有 Console 方法）

```js
import { defineConfig } from "vite"
import ConsoleKeeper from "vite-plugin-keep-console"

export default defineConfig({
	plugins: [
		ConsoleKeeper() // 将移除所有 console 语句，除了标记有 "keep-console" 注释的语句
	]
})
```

### 只处理特定的 Console 方法

```js
import { defineConfig } from "vite"
import ConsoleKeeper from "vite-plugin-keep-console"

export default defineConfig({
	plugins: [
		ConsoleKeeper({
			backend: "babel", // 强制使用旧版 Babel 后端
			methods: ["log", "error", "warn"] // 只处理 console.log、console.error 和 console.warn
		})
	]
})
```

### 包含特定文件进行处理

```js
import { defineConfig } from "vite"
import ConsoleKeeper from "vite-plugin-keep-console"

export default defineConfig({
	plugins: [
		ConsoleKeeper({
			include: ["src", /\.tsx?$/],
			exclude: ["src/vendor"] // 处理 src 文件，但排除 vendor 代码
		})
	]
})
```

### 只报告并作为 CI 门禁

```js
import { defineConfig } from "vite"
import ConsoleKeeper from "vite-plugin-keep-console"

export default defineConfig({
	plugins: [
		ConsoleKeeper({
			mode: "report",
			report: "detailed",
			failOnConsole: true
		})
	]
})
```

`mode: "report"` 不会改写源码，只记录命中的 console 调用；`report` 会在构建结束时输出汇总；`failOnConsole` 可以把这些命中结果变成 CI 失败。

### 保留参数求值

```js
ConsoleKeeper({
	preserveArguments: true
})
```

启用 `preserveArguments: true` 后，移除 `console.log(expensive(), value)` 时会保留参数求值，等价替换为 `expensive(), value, undefined`，避免 console 参数里的副作用被一起删掉。

### 自定义注释标记

```js
import { defineConfig } from "vite"
import ConsoleKeeper from "vite-plugin-keep-console"

export default defineConfig({
	plugins: [
		ConsoleKeeper({
			keepComments: ["KEEP", "IMPORTANT", "DEBUG"]
		})
	]
})
```

## 使用注释标记

你可以通过添加注释标记来防止特定的 console 语句被移除：

```js
// keep-console
console.log("这条语句将在生产环境中保留")

/* keep-console */
console.error("这个错误信息也会被保留")

console.log("这条语句将在生产环境中被移除")

// 使用自定义标记（如果已配置）
// KEEP
console.log("使用自定义标记保留")

// IMPORTANT
console.warn("重要警告在生产环境中保留")
```

### 注释标记放置位置

注释标记可以放置在：

- console 语句之前（前导注释）
- console 语句之后（尾随注释）
- console 方法调用内部
- 参数之前

```js
// keep-console - 在语句之前
console.log("保留")

console.log("保留") // keep-console - 在语句之后

console.log(/* keep-console */ "保留") // 在调用内部

console.log(
	// keep-console - 在参数之前
	"保留"
)
```

## 工作原理

1. **文件处理**: 插件在构建阶段处理 `.ts`、`.tsx`、`.js`、`.jsx`、`.vue` 和 `.svelte` 文件。原始 Vue 和 Svelte 文件会只转换 `<script>` 块，模板/markup 保持不变
2. **Console 检测**: 识别代码中所有的 `console.*` 方法调用
3. **注释检查**: 对于每个 console 语句，检查各个位置的注释标记
4. **策略处理**: 命中规则且没有保留标记的 console 会根据 `mode` 和 `failOnConsole` 被移除、报告、保留或触发构建失败
5. **智能替换**: 当 console 语句用于表达式中时，会用 `undefined` 替换；`preserveArguments` 可以在替换前保留参数求值

## 许可证

MIT © [biubiukam](https://github.com/biubiukam)
