import type { RequestJsonOptions } from '../lib/types'

export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// The handlers answer failures with `{ errors: [message] }`.
const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = await response.json()
    const message = body?.errors?.[0]
    if (typeof message === 'string' && message) return message
  } catch {
    // Not JSON: fall through to the status text.
  }
  return response.statusText || `Request failed with status ${response.status}`
}

// Same-origin JSON request. Resolves to the parsed body (undefined for a 204)
// and throws ApiError on any non-2xx. Network failures propagate unchanged.
export const requestJson = async <T = void>(
  path: string,
  { method = 'GET', body }: RequestJsonOptions = {}
): Promise<T> => {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined && { body: JSON.stringify(body) })
  })

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status)
  }

  if (response.status === 204) return undefined as T

  return response.json()
}

// A 4xx message comes from a handler and is written for donors. Anything else
// (a 500, a dropped connection) gets fixed copy.
export const errorMessage = (err: Error): string =>
  err instanceof ApiError && err.status >= 400 && err.status < 500
    ? err.message
    : GENERIC_ERROR_MESSAGE
