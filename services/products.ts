import { ProductsResponse, ProductType } from '../lib/types'
import { requestJson } from '../utils/api-client'

export const getProducts = (type: ProductType): Promise<ProductsResponse> =>
  requestJson<ProductsResponse>(`/api/products/${type}`)
