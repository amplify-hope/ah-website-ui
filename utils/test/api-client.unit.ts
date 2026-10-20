import { expect } from 'chai'
import {
  ApiError,
  errorMessage,
  GENERIC_ERROR_MESSAGE,
  requestJson
} from '../api-client'
import { restoreFetch, stubFetch, stubFetchFailure } from './fetch-stub'

const rejection = async (promise: Promise<unknown>): Promise<Error> => {
  try {
    await promise
  } catch (err) {
    return err as Error
  }
  throw new Error('expected the promise to reject')
}

describe('#apiClient', () => {
  afterEach(restoreFetch)

  describe('requestJson', () => {
    it('should GET by default and return the parsed body', async () => {
      const calls = stubFetch(Response.json({ ok: true }))

      const result = await requestJson<{ ok: boolean }>('/api/thing')

      expect(result).to.deep.eq({ ok: true })
      expect(calls[0].url).to.eq('/api/thing')
      expect(calls[0].init?.method).to.eq('GET')
      expect(calls[0].init?.body).to.eq(undefined)
    })

    it('should send a JSON body with the JSON header', async () => {
      const calls = stubFetch(Response.json({ id: 'cs_1' }))

      await requestJson('/api/thing', { method: 'POST', body: { a: 1 } })

      expect(calls[0].init?.method).to.eq('POST')
      expect(calls[0].init?.body).to.eq('{"a":1}')
      expect(calls[0].init?.headers).to.deep.eq({
        'Content-Type': 'application/json'
      })
    })

    it('should resolve to undefined for a 204', async () => {
      stubFetch(new Response(null, { status: 204 }))

      expect(await requestJson('/api/login', { method: 'POST' })).to.eq(
        undefined
      )
    })

    it('should throw an ApiError with the first server message and the status', async () => {
      stubFetch(Response.json({ errors: ['Invalid amount'] }, { status: 400 }))

      const err = await rejection(requestJson('/api/thing'))

      expect(err).to.be.instanceOf(ApiError)
      expect(err.message).to.eq('Invalid amount')
      expect((err as ApiError).status).to.eq(400)
    })

    it('should keep the message from a 500 body', async () => {
      stubFetch(
        Response.json({ errors: ['Internal server error'] }, { status: 500 })
      )

      const err = await rejection(requestJson('/api/thing'))

      expect(err.message).to.eq('Internal server error')
      expect((err as ApiError).status).to.eq(500)
    })

    it('should fall back to the status text when the body is not JSON', async () => {
      stubFetch(
        new Response('<html>bad gateway</html>', {
          status: 502,
          statusText: 'Bad Gateway'
        })
      )

      const err = await rejection(requestJson('/api/thing'))

      expect(err.message).to.eq('Bad Gateway')
      expect((err as ApiError).status).to.eq(502)
    })

    it('should fall back to a status message when there is no text or body message', async () => {
      stubFetch(Response.json({ errors: [] }, { status: 503 }))

      const err = await rejection(requestJson('/api/thing'))

      expect(err.message).to.eq('Request failed with status 503')
    })

    it('should let a network failure propagate unchanged', async () => {
      const failure = new TypeError('Failed to fetch')
      stubFetchFailure(failure)

      expect(await rejection(requestJson('/api/thing'))).to.eq(failure)
    })
  })

  describe('errorMessage', () => {
    it('should show the server message for a 4xx', () => {
      expect(errorMessage(new ApiError('Invalid amount', 400))).to.eq(
        'Invalid amount'
      )
      expect(errorMessage(new ApiError('Not found', 404))).to.eq('Not found')
    })

    it('should show fixed copy for a 5xx', () => {
      expect(errorMessage(new ApiError('Internal server error', 500))).to.eq(
        GENERIC_ERROR_MESSAGE
      )
    })

    it('should show fixed copy for a network failure', () => {
      expect(errorMessage(new TypeError('Failed to fetch'))).to.eq(
        GENERIC_ERROR_MESSAGE
      )
    })
  })
})
