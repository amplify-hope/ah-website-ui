import { jsonError } from '../api-response'
import { Deps, ProductsContext, ProductType } from '../types'

const PRODUCT_TYPES: readonly ProductType[] = ['one-time', 'recurring']

const isProductType = (value: string): value is ProductType =>
  (PRODUCT_TYPES as readonly string[]).includes(value)

// GET /api/products/[type]
// `type` goes into a Stripe Search query string, so only the known values are
// accepted. Anything else would let a caller rewrite the query.
export const handleProducts = async (
  _req: Request,
  { stripe }: Deps,
  { params }: ProductsContext
): Promise<Response> => {
  const { type } = await params

  if (!isProductType(type)) {
    return jsonError(
      400,
      `Invalid product type. Expected one of: ${PRODUCT_TYPES.join(', ')}`
    )
  }

  const productsFromStripe = await stripe.products.search({
    query: `active: 'true' AND metadata['type']: '${type}'`
  })

  const products = productsFromStripe.data.map(product => ({
    stripeId: product.id,
    productName: product.name,
    productType: product.metadata.type
  }))

  return Response.json({ products })
}
