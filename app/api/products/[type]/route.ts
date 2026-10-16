import { serve } from 'lib/deps'
import { handleProducts } from 'lib/handlers/products'
import { ProductsContext } from 'lib/types'

export const GET = serve<ProductsContext>(handleProducts)
