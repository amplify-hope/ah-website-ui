import { withErrorHandling } from './api-response'
import { getServerEnv } from './env'
import { Deps, NoParamsContext } from './types'
import { getStripe } from '../utils/stripe-server'

export const defaultDeps = (): Deps => ({
  stripe: getStripe(),
  env: getServerEnv()
})

// Adapter for Route Handlers. Next route files may only export HTTP verbs, so
// the logic lives in `handleX(req, deps, ctx)` functions that tests call with
// fake deps, and each route.ts is `export const GET = serve(handleX)`.
export const serve =
  <Ctx extends object = NoParamsContext>(
    handler: (req: Request, deps: Deps, ctx: Ctx) => Promise<Response>
  ) =>
  (req: Request, ctx: Ctx): Promise<Response> =>
    withErrorHandling(() => handler(req, defaultDeps(), ctx))
