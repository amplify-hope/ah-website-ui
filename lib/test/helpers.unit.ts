import { expect } from 'chai'
import { fakeStripe, firstArg, jsonRequest } from './helpers'

describe('#testHelpers', () => {
  describe('fakeStripe', () => {
    it('should call the provided method and record the call', async () => {
      const { stripe, calls } = fakeStripe({
        'products.search': async (params: { query: string }) => ({
          data: [{ id: 'prod_1', query: params.query }]
        })
      })

      const result = await stripe.products.search({ query: "active:'true'" })

      expect(result.data[0].id).to.eq('prod_1')
      expect(calls).to.deep.eq([
        { method: 'products.search', args: [{ query: "active:'true'" }] }
      ])
    })

    it('should throw on a Stripe call the test did not provide', () => {
      const { stripe } = fakeStripe({})

      expect(() => stripe.customers.list({ email: 'a@b.co' })).to.throw(
        'Unexpected Stripe call: customers.list'
      )
    })
  })

  describe('firstArg', () => {
    it('should return the first argument of the named call', () => {
      const calls = [
        { method: 'prices.list', args: [{ product: 'prod_1' }] },
        { method: 'prices.create', args: [{ unit_amount: 2500 }, 'extra'] }
      ]

      expect(firstArg(calls, 'prices.create')).to.deep.eq({ unit_amount: 2500 })
    })

    it('should return undefined when the method was never called', () => {
      expect(firstArg([], 'prices.create')).to.eq(undefined)
    })
  })

  describe('jsonRequest', () => {
    it('should build a JSON POST request', async () => {
      const request = jsonRequest('http://localhost/api/x', { a: 1 })

      expect(request.method).to.eq('POST')
      expect(request.headers.get('content-type')).to.eq('application/json')
      expect(await request.json()).to.deep.eq({ a: 1 })
    })
  })
})
