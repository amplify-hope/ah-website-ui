import { expect } from 'chai'
import { ApiError } from '../../utils/api-client'
import {
  restoreFetch,
  stubFetch,
  stubFetchFailure
} from '../../utils/test/fetch-stub'
import { requestMagicLink } from '../auth'

const rejection = async (promise: Promise<unknown>): Promise<Error> => {
  try {
    await promise
  } catch (err) {
    return err as Error
  }
  throw new Error('expected the promise to reject')
}

describe('#auth service', () => {
  afterEach(restoreFetch)

  describe('requestMagicLink', () => {
    it('should POST the email to the same-origin login route', async () => {
      const calls = stubFetch(new Response(null, { status: 204 }))

      await requestMagicLink('donor@example.com')

      expect(calls).to.have.length(1)
      expect(calls[0].url).to.eq('/api/login')
      expect(calls[0].init?.method).to.eq('POST')
      expect(JSON.parse(String(calls[0].init?.body))).to.deep.eq({
        email: 'donor@example.com'
      })
    })

    it('should resolve for an unknown email so the page does not reveal donors', async () => {
      stubFetch(
        Response.json(
          { errors: ['No account found for that email'] },
          { status: 404 }
        )
      )

      expect(await requestMagicLink('nobody@example.com')).to.eq(undefined)
    })

    it('should throw the validation message for a 400', async () => {
      stubFetch(
        Response.json(
          { errors: ['email must be a valid email'] },
          { status: 400 }
        )
      )

      const err = await rejection(requestMagicLink('nope'))

      expect(err).to.be.instanceOf(ApiError)
      expect(err.message).to.eq('email must be a valid email')
    })

    it('should throw when the email cannot be sent', async () => {
      stubFetch(
        Response.json(
          { errors: ['Unable to send the sign-in link'] },
          { status: 500 }
        )
      )

      const err = await rejection(requestMagicLink('donor@example.com'))

      expect((err as ApiError).status).to.eq(500)
    })

    it('should let a network failure propagate', async () => {
      const failure = new TypeError('Failed to fetch')
      stubFetchFailure(failure)

      expect(await rejection(requestMagicLink('donor@example.com'))).to.eq(
        failure
      )
    })
  })
})
