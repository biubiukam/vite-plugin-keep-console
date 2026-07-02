import type { ConsoleKeeperOptions } from "./types"
import { generateTransform } from "./transform"
import type { Plugin } from "vite"
import { normalizeOptions } from "./options"
import {
	countFailingConsoleEvents,
	createConsolePolicyReport,
	formatConsolePolicyReport,
	resetConsolePolicyReport
} from "./report"

export function ConsoleKeeper(options?: ConsoleKeeperOptions) {
	const normalizedOptions = normalizeOptions(options)
	const policyReport = createConsolePolicyReport()
	const transform = generateTransform(options, undefined, policyReport)

	return {
		name: "vite-plugin-keep-console",
		enforce: "pre",
		apply: "build",
		buildStart() {
			resetConsolePolicyReport(policyReport)
		},
		transform,
		buildEnd(this: { warn(message: string): void }) {
			if (normalizedOptions.report) {
				this.warn(
					formatConsolePolicyReport(policyReport, normalizedOptions.report === "detailed")
				)
			}

			const failures = countFailingConsoleEvents(policyReport)

			if (normalizedOptions.failOnConsole && failures > 0) {
				throw new Error(
					`vite-plugin-keep-console found ${failures} console call${failures === 1 ? "" : "s"} that violate the configured policy.`
				)
			}
		}
	}
}
export default ConsoleKeeper as (options?: ConsoleKeeperOptions) => Plugin
