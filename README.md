# vite-plugin-keep-console

<div align="left">
  <a href="./README.md"><img alt="README in English" src="https://img.shields.io/badge/English-f9f9f9"></a>
  <a href="./README.zh-CN.md"><img alt="简体中文版自述文件" src="https://img.shields.io/badge/简体中文-f9f9f9"></a>
</div>

[![npm version][npm-version-badge]][npm-link]
[![npm downloads][npm-downloads-badge]][npm-link]
[![license][license-badge]][license-link]
[![CI][ci-badge]][ci-link]
[![coverage][coverage-badge]][coverage-link]
[![Node.js][node-badge]][npm-link]
[![Vite][vite-badge]][vite-link]
[![TypeScript][typescript-badge]][typescript-link]

[npm-version-badge]: https://img.shields.io/npm/v/vite-plugin-keep-console.svg
[npm-downloads-badge]: https://img.shields.io/npm/dm/vite-plugin-keep-console.svg
[npm-link]: https://www.npmjs.com/package/vite-plugin-keep-console
[license-badge]: https://img.shields.io/badge/license-MIT-blue.svg
[license-link]: LICENSE
[ci-badge]: https://github.com/biubiukam/vite-plugin-keep-console/actions/workflows/ci.yml/badge.svg
[ci-link]: https://github.com/biubiukam/vite-plugin-keep-console/actions/workflows/ci.yml
[coverage-badge]: https://codecov.io/gh/biubiukam/vite-plugin-keep-console/graph/badge.svg?token=UEKBR30J97
[coverage-link]: https://codecov.io/gh/biubiukam/vite-plugin-keep-console
[node-badge]: https://img.shields.io/node/v/vite-plugin-keep-console.svg
[vite-badge]: https://img.shields.io/badge/vite-%5E3%20%7C%20%5E4%20%7C%20%5E5%20%7C%20%5E6%20%7C%20%5E7%20%7C%20%5E8-646cff
[vite-link]: https://vite.dev/
[typescript-badge]: https://img.shields.io/badge/TypeScript-ready-3178c6
[typescript-link]: https://www.typescriptlang.org/

A Vite plugin for production console policy. Remove, keep, report, or fail builds on console statements by method, file path, comments, and transform mode.

## Installation

```bash
# npm
npm install vite-plugin-keep-console --save-dev

# yarn
yarn add vite-plugin-keep-console -D

# pnpm
pnpm add vite-plugin-keep-console -D
```

## Usage

Add the plugin to your `vite.config.js` or `vite.config.ts`:

```js
import { defineConfig } from "vite"
import ConsoleKeeper from "vite-plugin-keep-console"

export default defineConfig({
	plugins: [
		ConsoleKeeper({
			// options
			backend: "auto"
		})
	]
})
```

## Options

| Option              | Type                             | Default            | Description                                                             |
| ------------------- | -------------------------------- | ------------------ | ----------------------------------------------------------------------- |
| `backend`           | `"auto"\|"oxc"\|"babel"`         | `"auto"`           | AST backend. Prefer OXC when available, or force OXC/Babel              |
| `methods`           | `string[]`                       | `[]`               | Console methods to process. If empty, all console methods are processed |
| `include`           | `Array<string\|RegExp>`          | `[]`               | Files to include for processing. Strings are matched as path substrings |
| `exclude`           | `Array<string\|RegExp>`          | `[]`               | Files to exclude from processing                                        |
| `keepComments`      | `string[]`                       | `["keep-console"]` | Comment markers that prevent console statement removal                  |
| `mode`              | `"remove"\|"report"\|"keep"`     | `"remove"`         | Policy mode for unmarked matching console calls                         |
| `report`            | `boolean\|"summary"\|"detailed"` | `false`            | Print a build-end report with removed, kept, and skipped call counts    |
| `failOnConsole`     | `boolean`                        | `false`            | Fail the build when unmarked matching console calls are found           |
| `preserveArguments` | `boolean`                        | `false`            | Preserve console argument evaluation when removing calls                |

`includes` is kept as a legacy alias for `methods`. `external` is kept as a legacy alias for `include`.

### Backend Strategy

The plugin supports two transform backends:

- `backend: "auto"`: Uses OXC when the current Node runtime supports it and `oxc-parser` can be loaded dynamically. Otherwise, it falls back to the Babel backend.
- `backend: "oxc"`: Requires OXC. If `oxc-parser` cannot be loaded, the plugin throws an actionable error telling you to install OXC or upgrade Node.
- `backend: "babel"`: Uses the legacy Babel implementation for older Node/Vite environments.

OXC is loaded with dynamic import and is not required by the main entry. This keeps older environments compatible with the Babel backend.

### Available Console Methods

The plugin supports processing all standard console methods:

- Basic: `debug`, `error`, `info`, `log`, `warn`
- Advanced: `dir`, `dirxml`, `table`, `trace`, `group`, `groupCollapsed`, `groupEnd`, `clear`
- Performance: `count`, `countReset`, `time`, `timeLog`, `timeEnd`, `timeStamp`, `profile`, `profileEnd`
- Other: `assert`, `context`, `createTask`, `memory`

## Examples

### Default Usage (Process All Console Methods)

```js
import { defineConfig } from "vite"
import ConsoleKeeper from "vite-plugin-keep-console"

export default defineConfig({
	plugins: [
		ConsoleKeeper() // Will remove all console statements except those marked with "keep-console" comment
	]
})
```

### Process Only Specific Console Methods

```js
import { defineConfig } from "vite"
import ConsoleKeeper from "vite-plugin-keep-console"

export default defineConfig({
	plugins: [
		ConsoleKeeper({
			backend: "babel", // Force the legacy Babel backend
			methods: ["log", "error", "warn"] // Only process console.log, console.error, and console.warn
		})
	]
})
```

### Include Specific Files for Processing

```js
import { defineConfig } from "vite"
import ConsoleKeeper from "vite-plugin-keep-console"

export default defineConfig({
	plugins: [
		ConsoleKeeper({
			include: ["src", /\.tsx?$/],
			exclude: ["src/vendor"] // Process src files except vendor code
		})
	]
})
```

### Report Only and CI Gate

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

`mode: "report"` keeps the source code unchanged, records matching console calls, prints the aggregated build report, and lets `failOnConsole` turn those findings into a CI failure.

### Preserve Argument Evaluation

```js
ConsoleKeeper({
	preserveArguments: true
})
```

With `preserveArguments: true`, removing `console.log(expensive(), value)` keeps the argument evaluation as `expensive(), value, undefined`. This avoids changing side effects hidden inside console arguments.

### Custom Comment Markers

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

## Using Comment Markers

You can prevent specific console statements from being removed by adding comment markers:

```js
// keep-console
console.log("This will be kept in production")

/* keep-console */
console.error("This error will also be kept")

console.log("This will be removed in production")

// Using custom markers (if configured)
// KEEP
console.log("Kept with custom marker")

// IMPORTANT
console.warn("Important warning kept in production")
```

### Comment Marker Placement

Comment markers can be placed:

- Before the console statement (leading comments)
- After the console statement (trailing comments)
- Inside the console method call
- Before parameters

```js
// keep-console - before statement
console.log("kept")

console.log("kept") // keep-console - after statement

console.log(/* keep-console */ "kept") // inside call

console.log(
	// keep-console - before parameter
	"kept"
)
```

## How It Works

1. **File Processing**: The plugin processes `.ts`, `.tsx`, `.js`, `.jsx`, `.vue`, and `.svelte` files during the build phase. Raw Vue and Svelte files are handled by transforming their `<script>` blocks and leaving templates/markup unchanged
2. **Console Detection**: It identifies all `console.*` method calls in your code
3. **Comment Checking**: For each console statement, it checks for comment markers in various positions
4. **Policy Action**: Matching console statements without keep markers are removed, reported, kept, or used to fail the build depending on `mode` and `failOnConsole`
5. **Smart Replacement**: When console statements are used in expressions, they are replaced with `undefined`; `preserveArguments` can keep argument evaluation before that replacement

## License

MIT © [biubiukam](https://github.com/biubiukam)
