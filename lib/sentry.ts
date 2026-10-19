import type { Event } from '@sentry/nextjs'
import type { SentryOptions } from './types'

const SENSITIVE_HEADERS = [
  'cookie',
  'authorization',
  'x-forwarded-for',
  'x-real-ip'
]

// Donor emails and the magic-link token travel in request bodies, query strings
// and cookies. @sentry/nextjs v8 leaves bodies and cookies off unless
// `sendDefaultPii` is on, but strip them anyway so an SDK upgrade or a new
// integration cannot start sending them.
export const scrubEvent = <T extends Event>(event: T): T => {
  const { request } = event

  if (request) {
    delete request.data
    delete request.cookies
    delete request.query_string

    if (request.url) {
      try {
        const { origin, pathname } = new URL(request.url)
        request.url = `${origin}${pathname}`
      } catch {
        delete request.url
      }
    }

    if (request.headers) {
      for (const name of Object.keys(request.headers)) {
        if (SENSITIVE_HEADERS.includes(name.toLowerCase())) {
          delete request.headers[name]
        }
      }
    }
  }

  delete event.user

  return event
}

export const sentryOptions: SentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent
}
