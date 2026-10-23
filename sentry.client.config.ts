import * as Sentry from '@sentry/nextjs'
import { sentryOptions } from './lib/sentry'

// No session replay: replay events never pass through `beforeSend`, so the
// scrubbing in lib/sentry.ts cannot reach them, and donor emails appear in the
// URL of /auth/verify.
Sentry.init(sentryOptions)
