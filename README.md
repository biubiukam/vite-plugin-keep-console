# vite-plugin-keep-console

[![license][license-badge]][license-link]
![NPM Version](https://img.shields.io/npm/v/vite-plugin-keep-console)
[![codecov][codecov-badge]][codecov-link]

[license-badge]: https://img.shields.io/badge/license-MIT-blue.svg
[license-link]: LICENSE
[codecov-badge]: https://codecov.io/gh/biubiukam/vite-plugin-keep-console/graph/badge.svg?token=UEKBR30J97
[codecov-link]: https://codecov.io/gh/biubiukam/vite-plugin-keep-console

A Vite plugin that selectively removes console statements in production builds. Console statements can be kept using comment markers or by specifying which console methods to process.

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
import { defineConfig } from "vite";
import ConsoleKeeper from "vite-plugin-keep-console";

export default defineConfig({
  plugins: [
    ConsoleKeeper({
      // options
    }),
  ],
});
```

## Options

| Option         | Type                    | Default            | Description                                                                      |
| -------------- | ----------------------- | ------------------ | -------------------------------------------------------------------------------- |
| `includes`     | `string[]`              | `[]`               | Array of console methods to process. If empty, all console methods are processed |
| `external`     | `Array<string\|RegExp>` | `[]`               | Array of files to include for processing (string or RegExp)                      |
| `keepComments` | `string[]`              | `["keep-console"]` | Array of comment markers that prevent console statement removal                  |

### Available Console Methods

The plugin supports processing all standard console methods:

- Basic: `debug`, `error`, `info`, `log`, `warn`
- Advanced: `dir`, `dirxml`, `table`, `trace`, `group`, `groupCollapsed`, `groupEnd`, `clear`
- Performance: `count`, `countReset`, `time`, `timeLog`, `timeEnd`, `timeStamp`, `profile`, `profileEnd`
- Other: `assert`, `context`, `createTask`, `memory`

## Examples

### Default Usage (Process All Console Methods)

```js
import { defineConfig } from "vite";
import ConsoleKeeper from "vite-plugin-keep-console";

export default defineConfig({
  plugins: [
    ConsoleKeeper(), // Will remove all console statements except those marked with "keep-console" comment
  ],
});
```

### Process Only Specific Console Methods

```js
import { defineConfig } from "vite";
import ConsoleKeeper from "vite-plugin-keep-console";

export default defineConfig({
  plugins: [
    ConsoleKeeper({
      includes: ["log", "error", "warn"], // Only process console.log, console.error, and console.warn
    }),
  ],
});
```

### Include Specific Files for Processing

```js
import { defineConfig } from "vite";
import ConsoleKeeper from "vite-plugin-keep-console";

export default defineConfig({
  plugins: [
    ConsoleKeeper({
      external: ["src/**", /\.tsx?$/], // Only process files in src folder and TypeScript files
    }),
  ],
});
```

### Custom Comment Markers

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

## Using Comment Markers

You can prevent specific console statements from being removed by adding comment markers:

```js
// keep-console
console.log("This will be kept in production");

/* keep-console */
console.error("This error will also be kept");

console.log("This will be removed in production");

// Using custom markers (if configured)
// KEEP
console.log("Kept with custom marker");

// IMPORTANT
console.warn("Important warning kept in production");
```

### Comment Marker Placement

Comment markers can be placed:

- Before the console statement (leading comments)
- After the console statement (trailing comments)
- Inside the console method call
- Before parameters

```js
// keep-console - before statement
console.log("kept");

console.log("kept"); // keep-console - after statement

console.log(/* keep-console */ "kept"); // inside call

console.log(
  // keep-console - before parameter
  "kept"
);
```

## How It Works

1. **File Processing**: The plugin processes `.ts`, `.tsx`, `.js`, `.jsx`, `.vue`, and `.svelte` files during the build phase
2. **Console Detection**: It identifies all `console.*` method calls in your code
3. **Comment Checking**: For each console statement, it checks for comment markers in various positions
4. **Selective Removal**: Console statements without keep markers are removed, while marked ones are preserved
5. **Smart Replacement**: When console statements are used in expressions, they are replaced with `undefined` to maintain type compatibility

## License

MIT © [biubiukam](https://github.com/biubiukam)
