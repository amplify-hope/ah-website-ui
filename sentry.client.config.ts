import * as Sentry from '@sentry/nextjs'
import { sentryOptions } from './lib/sentry'

Sentry.init({
  ...sentryOptions,
  integrations: [Sentry.replayIntegration()],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0
})
