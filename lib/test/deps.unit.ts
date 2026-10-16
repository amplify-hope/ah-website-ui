import { expect } from 'chai'
import { serve } from '../deps'
import { resetServerEnvCache } from '../env'
import { ServerEnv } from '../types'
import { testEnv } from './helpers'

describe('#serve', () => {
  const originalEnv = { ...process.env }
  const originalConsoleError = console.error

  beforeEach(() => {
    resetServerEnvCache()
    console.error = () => undefined
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    console.error = originalConsoleError
    resetServerEnvCache()
  })

  it('should call the handler with the request, default deps and context', async () => {
    process.env = { ...originalEnv, ...testEnv }
    const request = new Request('http://localhost/api/x')
    let received: { req?: Request; env?: ServerEnv; ctx?: { id: string } } = {}

    const route = serve<{ id: string }>(async (req, deps, ctx) => {
      received = { req, env: deps.env, ctx }
      return new Response(null, { status: 204 })
    })
    const response = await route(request, { id: 'cs_1' })

    expect(response.status).to.eq(204)
    expect(received.req).to.eq(request)
    expect(received.env).to.deep.eq(testEnv)
    expect(received.ctx).to.deep.eq({ id: 'cs_1' })
  })

  it('should return a 500 and skip the handler when the server env is invalid', async () => {
    process.env = { ...originalEnv, ...testEnv }
    delete process.env.STRIPE_SECRET_KEY
    let called = false

    const route = serve(async () => {
      called = true
      return new Response(null, { status: 204 })
    })
    const response = await route(new Request('http://localhost/api/x'), {
      params: Promise.resolve({})
    })

    expect(response.status).to.eq(500)
    expect(called).to.eq(false)
  })
})
