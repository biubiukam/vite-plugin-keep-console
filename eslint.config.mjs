import js from "@eslint/js"
import tseslint from "typescript-eslint"

export default tseslint.config(
	{
		ignores: [
			"**/dist/",
			"**/node_modules/",
			"**/coverage/",
			"package-lock.json",
			"*.tsbuildinfo"
		]
	},

	js.configs.recommended,
	...tseslint.configs.recommended,

	{
		files: ["**/*.{ts,tsx}"],
		rules: {
			"no-undef": "off",
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
			]
		}
	},

	{
		files: ["**/*.d.ts"],
		rules: {
			"no-var": "off"
		}
	}
)
