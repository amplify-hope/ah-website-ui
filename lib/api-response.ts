// Errors use the `{ errors: [message] }` shape that utils/fetchJson reads to
// surface an alert.
export const jsonError = (status: number, message: string): Response =>
  Response.json({ errors: [message] }, { status })

// Turns anything a handler throws (including invalid server env) into a logged
// 500. The thrown message stays in the server log, never in the response.
export const withErrorHandling = async (
  handler: () => Promise<Response>
): Promise<Response> => {
  try {
    return await handler()
  } catch (err) {
    console.error(
      'Unhandled API error:',
      err instanceof Error ? err.message : err
    )
    return jsonError(500, 'Internal server error')
  }
}
