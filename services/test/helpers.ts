export type FetchCall = { url: string; init?: RequestInit }

const originalFetch = globalThis.fetch

// Replaces the global fetch with one that records its calls and resolves to
// the given response. Pair with restoreFetch() in afterEach.
export const stubFetch = (response: Response): FetchCall[] => {
  const calls: FetchCall[] = []
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init })
    return response
  }
  return calls
}

export const restoreFetch = () => {
  globalThis.fetch = originalFetch
}
