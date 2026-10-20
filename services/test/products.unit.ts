import { expect } from 'chai'
import { getProducts } from '../products'
import { restoreFetch, stubFetch } from '../../utils/test/fetch-stub'

describe('#products service', () => {
  afterEach(restoreFetch)

  describe('getProducts', () => {
    const products = [
      {
        stripeId: 'prod_general',
        productName: 'General Fund|one-time',
        productType: 'one-time'
      }
    ]

    for (const type of ['one-time', 'recurring'] as const) {
      it(`should fetch ${type} products from the same-origin products route`, async () => {
        const calls = stubFetch(Response.json({ products }))

        const result = await getProducts(type)

        expect(result).to.deep.eq({ products })
        expect(calls).to.have.length(1)
        expect(calls[0].url).to.eq(`/api/products/${type}`)
        expect(calls[0].init?.method).to.eq('GET')
      })
    }

    it('should throw when the route rejects the request, so SWR sets its error', async () => {
      stubFetch(
        Response.json({ errors: ['Invalid product type'] }, { status: 400 })
      )

      let thrown: Error | undefined
      try {
        await getProducts('one-time')
      } catch (err) {
        thrown = err as Error
      }

      expect(thrown?.message).to.eq('Unable to load funds')
    })

    it('should throw when the route fails', async () => {
      stubFetch(
        Response.json({ errors: ['Internal server error'] }, { status: 500 })
      )

      let thrown: Error | undefined
      try {
        await getProducts('recurring')
      } catch (err) {
        thrown = err as Error
      }

      expect(thrown?.message).to.eq('Unable to load funds')
    })
  })
})
