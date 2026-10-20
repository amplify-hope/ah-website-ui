import * as Sentry from '@sentry/nextjs'

// Errors use the `{ errors: [message] }` shape that utils/api-client reads for
// the message on an ApiError.
export const jsonError = (status: number, message: string): Response =>
  Response.json({ errors: [message] }, { status })

// Turns anything a handler throws (including invalid server env) into a logged
// 500 that is also reported to Sentry. The thrown message stays in the server
// log, never in the response. Next's `onRequestError` never sees these errors
// because they are caught here.
export const withErrorHandling = async (
  handler: () => Promise<Response>
): Promise<Response> => {
  try {
    return await handler()
  } catch (err) {
    Sentry.captureException(err)
    console.error(
      'Unhandled API error:',
      err instanceof Error ? err.message : err
    )
    return jsonError(500, 'Internal server error')
  }
}
