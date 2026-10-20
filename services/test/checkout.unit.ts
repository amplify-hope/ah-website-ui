import { expect } from 'chai'
import { DonationRequestBody } from '../../common/types'
import { ApiError } from '../../utils/api-client'
import { createCheckoutSession, getCheckoutSession } from '../checkout'
import { restoreFetch, stubFetch } from '../../utils/test/fetch-stub'

describe('#checkout service', () => {
  afterEach(restoreFetch)

  describe('getCheckoutSession', () => {
    const session = {
      id: 'cs_test_1',
      amount_total: 2500,
      mode: 'payment',
      metadata: { fund: 'General Fund' }
    }

    it('should fetch the session from the same-origin checkout-sessions route', async () => {
      const calls = stubFetch(Response.json(session))

      const result = await getCheckoutSession('cs_test_1')

      expect(result).to.deep.eq(session)
      expect(calls).to.have.length(1)
      expect(calls[0].url).to.eq('/api/checkout-sessions/cs_test_1')
      expect(calls[0].init?.method).to.eq('GET')
    })

    it('should throw an ApiError when the route rejects the id', async () => {
      stubFetch(
        Response.json(
          { errors: ['Invalid checkout session id'] },
          { status: 400 }
        )
      )

      let thrown: Error | undefined
      try {
        await getCheckoutSession('prod_123')
      } catch (err) {
        thrown = err as Error
      }

      expect(thrown).to.be.instanceOf(ApiError)
      expect(thrown?.message).to.eq('Invalid checkout session id')
      expect((thrown as ApiError).status).to.eq(400)
    })

    it('should throw an ApiError when Stripe has no such session', async () => {
      stubFetch(
        Response.json(
          { errors: ['Checkout session not found'] },
          { status: 404 }
        )
      )

      let thrown: Error | undefined
      try {
        await getCheckoutSession('cs_test_missing')
      } catch (err) {
        thrown = err as Error
      }

      expect((thrown as ApiError).status).to.eq(404)
    })

    it('should throw an ApiError when the route fails', async () => {
      stubFetch(
        Response.json({ errors: ['Internal server error'] }, { status: 500 })
      )

      let thrown: Error | undefined
      try {
        await getCheckoutSession('cs_test_1')
      } catch (err) {
        thrown = err as Error
      }

      expect((thrown as ApiError).status).to.eq(500)
    })
  })

  describe('createCheckoutSession', () => {
    const body: DonationRequestBody = {
      email: 'donor@example.com',
      amount: 25,
      interval: null,
      stripeProductId: 'prod_general',
      notes: 'In memory of Sam',
      isRecurring: false
    }

    it('should POST the donation to the same-origin checkout route and return the session', async () => {
      const calls = stubFetch(Response.json({ id: 'cs_test_1' }))

      const result = await createCheckoutSession(body)

      expect(result).to.deep.eq({ id: 'cs_test_1' })
      expect(calls).to.have.length(1)
      expect(calls[0].url).to.eq('/api/checkout')
      expect(calls[0].init?.method).to.eq('POST')
      expect(JSON.parse(String(calls[0].init?.body))).to.deep.eq(body)
    })

    it('should throw an ApiError with the validation message', async () => {
      stubFetch(Response.json({ errors: ['Invalid amount'] }, { status: 400 }))

      let thrown: Error | undefined
      try {
        await createCheckoutSession(body)
      } catch (err) {
        thrown = err as Error
      }

      expect(thrown).to.be.instanceOf(ApiError)
      expect(thrown?.message).to.eq('Invalid amount')
    })

    it('should throw an ApiError when the route fails', async () => {
      stubFetch(
        Response.json({ errors: ['Internal server error'] }, { status: 500 })
      )

      let thrown: Error | undefined
      try {
        await createCheckoutSession(body)
      } catch (err) {
        thrown = err as Error
      }

      expect((thrown as ApiError).status).to.eq(500)
    })
  })
})
