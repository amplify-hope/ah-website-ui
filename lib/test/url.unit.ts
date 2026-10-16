import { expect } from 'chai'
import { appUrl } from '../url'

describe('#appUrl', () => {
  it('should append the path to the base url', () => {
    expect(appUrl('https://example.com', '/result/abc')).to.eq(
      'https://example.com/result/abc'
    )
  })

  it('should ignore trailing slashes on the base url', () => {
    expect(appUrl('https://example.com//', '/result/abc')).to.eq(
      'https://example.com/result/abc'
    )
  })

  it('should return the bare base url without a path', () => {
    expect(appUrl('https://example.com/')).to.eq('https://example.com')
  })
})
