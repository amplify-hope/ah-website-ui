/* eslint-disable @typescript-eslint/no-require-imports */

/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs')

const nextConfig = {
  output: process.env.AWS_APP_ID ? undefined : 'standalone',
  eslint: {
    ignoreDuringBuilds: true
  }
}

const sentryWebpackPluginOptions = {
  org: 'amplifyhope',
  project: 'web-ui',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: { name: process.env.SENTRY_RELEASE },
  // Sentry keeps the maps it needs for readable stack traces; the copies in
  // .next/static would otherwise be deployed and downloadable from the CDN.
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  unstable_sentryWebpackPluginOptions: {
    errorHandler: err =>
      console.warn(`Sentry upload failed, continuing: ${err.message}`)
  }
}

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions)
