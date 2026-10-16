import { ProductsResponse, ProductType } from '../lib/types'
import fetchJson from '../utils/fetchJson'

// fetchJson never throws: it resolves to false on any failure. SWR only fills
// its `error` when the fetcher throws, so a failure is turned back into one.
export const getProducts = async (
  type: ProductType
): Promise<ProductsResponse> => {
  const products = await fetchJson(`/api/products/${type}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })

  if (!products) throw new Error('Unable to load funds')

  return products
}
