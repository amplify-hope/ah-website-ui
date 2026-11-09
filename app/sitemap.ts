import type { MetadataRoute } from 'next'

const BASE_URL = 'https://amplifyhope.cc'

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/donate', '/who-we-are', '/privacy', '/terms'].map(path => ({
    url: `${BASE_URL}${path}`
  }))
}
