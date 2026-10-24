import type { Event } from '@sentry/nextjs'
import type { SentryOptions } from './types'

const SENSITIVE_HEADERS = [
  'cookie',
  'authorization',
  'x-forwarded-for',
  'x-real-ip'
]

type AttributeData = NonNullable<NonNullable<Event['spans']>[number]['data']>

// Attributes that hold nothing but a query string (or fragment), so there is
// no `?` for stripQueries to find.
const QUERY_ATTRIBUTES = ['url.query', 'http.query', 'url.fragment']

// "GET https://api.stripe.com/v1/customers?email=a%40b.c" -> "GET https://api.stripe.com/v1/customers"
const stripQueries = (value: string): string => value.replace(/\?\S*/g, '')

// Used for span attributes and breadcrumb data: both carry URLs under keys that
// differ by instrumentation (url, http.url, url.full, from, to, ...), so every
// string is stripped instead of guessing at key names.
const scrubData = (data: AttributeData): void => {
  for (const key of Object.keys(data)) {
    const value = data[key]
    if (QUERY_ATTRIBUTES.includes(key)) {
      delete data[key]
    } else if (typeof value === 'string') {
      data[key] = stripQueries(value)
    }
  }
}

// Donor emails and the magic-link token travel in request bodies, query strings
// and cookies, and in the URLs of requests the server makes: looking up a
// donor sends their email to Stripe as a query string, and Sentry records that
// request as a span. The /auth/verify page URL also carries the email, which
// breadcrumbs and page-load spans record. @sentry/nextjs v8 leaves bodies and
// cookies off unless `sendDefaultPii` is on, but strip them anyway so an SDK
// upgrade or a new integration cannot start sending them.
export const scrubEvent = <T extends Event>(event: T): T => {
  const { request } = event

  // Breadcrumbs stay: they are the trail leading up to an error.
  for (const breadcrumb of event.breadcrumbs ?? []) {
    if (breadcrumb.message)
      breadcrumb.message = stripQueries(breadcrumb.message)
    if (breadcrumb.data) scrubData(breadcrumb.data)
  }

  for (const span of event.spans ?? []) {
    if (span.description) span.description = stripQueries(span.description)
    if (span.data) scrubData(span.data)
  }

  const trace = event.contexts?.trace
  if (typeof trace?.description === 'string') {
    trace.description = stripQueries(trace.description)
  }
  if (trace?.data) scrubData(trace.data)

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
