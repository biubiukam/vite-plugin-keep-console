import { afterEach, describe, expect, it, vi } from "vitest"

describe("babel backend module interop", () => {
	afterEach(() => {
		vi.doUnmock("@babel/traverse")
		vi.resetModules()
	})

	it("uses the nested default export when Babel traverse is wrapped by module interop", async () => {
		const fakeTraverse = vi.fn()

		vi.resetModules()
		vi.doMock("@babel/traverse", () => ({
			default: {
				default: fakeTraverse
			}
		}))

		const { createBabelBackend } = await import("../src/babel-backend")

		expect(createBabelBackend().name).toBe("babel")
	})
})
