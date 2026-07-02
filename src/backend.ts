import { createBabelBackend } from "./babel-backend"
import { createOxcBackend } from "./oxc-backend"
import type { ConsoleKeeperOptions } from "./types"
import type {
	BackendResolverHooks,
	LoadOxcParser,
	OxcParserModule,
	TransformBackend
} from "./backend-types"

declare const process:
	| {
			versions?: {
				node?: string
			}
	  }
	| undefined

const OXC_NODE_RANGE = "^20.19.0 || >=22.12.0"

const dynamicImport = new Function("specifier", "return import(specifier)") as (
	specifier: string
) => Promise<unknown>

async function defaultLoadOxcParser(): Promise<OxcParserModule> {
	return (await dynamicImport("oxc-parser")) as OxcParserModule
}

export function supportsOxcRuntime(nodeVersion = process?.versions?.node || "") {
	const [major = 0, minor = 0, patch = 0] = nodeVersion.split(".").map((part) => Number(part))

	if (major === 20) return minor > 19 || (minor === 19 && patch >= 0)
	if (major === 22) return minor > 12 || (minor === 12 && patch >= 0)
	return major > 22
}

export async function resolveTransformBackend(
	options: Pick<ConsoleKeeperOptions, "backend"> = {},
	hooks: BackendResolverHooks = {}
): Promise<TransformBackend> {
	const backend = options.backend || "auto"
	const nodeVersion = hooks.nodeVersion || process?.versions?.node
	const loadOxcParser: LoadOxcParser = hooks.loadOxcParser || defaultLoadOxcParser

	if (backend === "babel") return createBabelBackend()

	if (!supportsOxcRuntime(nodeVersion)) {
		if (backend === "auto") return createBabelBackend()

		throw createOxcLoadError(
			`Current Node version ${nodeVersion || "unknown"} does not satisfy ${OXC_NODE_RANGE}.`
		)
	}

	try {
		const oxcParser = await loadOxcParser()
		return createOxcBackend(oxcParser)
	} catch (error) {
		if (backend === "auto") return createBabelBackend()
		throw createOxcLoadError(getErrorMessage(error))
	}
}

function createOxcLoadError(cause: string) {
	return new Error(
		`Failed to load backend "oxc". Please install oxc-parser and run Node ${OXC_NODE_RANGE}, or use backend "babel". Cause: ${cause}`
	)
}

function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error)
}
