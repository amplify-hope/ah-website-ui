import { expect } from 'chai'
import { ApiError } from '../../utils/api-client'
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

    it('should throw an ApiError with the route message so SWR sets its error', async () => {
      stubFetch(
        Response.json({ errors: ['Invalid product type'] }, { status: 400 })
      )

      let thrown: Error | undefined
      try {
        await getProducts('one-time')
      } catch (err) {
        thrown = err as Error
      }

      expect(thrown).to.be.instanceOf(ApiError)
      expect(thrown?.message).to.eq('Invalid product type')
      expect((thrown as ApiError).status).to.eq(400)
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

      expect(thrown).to.be.instanceOf(ApiError)
      expect((thrown as ApiError).status).to.eq(500)
    })
  })
})
