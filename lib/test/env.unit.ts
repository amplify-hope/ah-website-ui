import { expect } from 'chai'
import { getServerEnv, resetServerEnvCache } from '../env'

const validEnv = {
  STRIPE_SECRET_KEY: 'sk_test_123',
  JWT_SECRET: 'jwt-secret',
  RESEND_API_KEY: 're_123',
  RESEND_TEMPLATE_ID: 'template-id',
  CLIENT_BASE_URL: 'https://example.com'
}

describe('#serverEnv', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    resetServerEnvCache()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    resetServerEnvCache()
  })

  it('should return the parsed server env when all variables are valid', () => {
    process.env = { ...originalEnv, ...validEnv }
    expect(getServerEnv()).to.deep.eq(validEnv)
  })

  it('should name every missing variable without exposing values', () => {
    process.env = { ...originalEnv, ...validEnv }
    delete process.env.JWT_SECRET
    delete process.env.RESEND_API_KEY

    let message = ''
    try {
      getServerEnv()
    } catch (err) {
      message = (err as Error).message
    }

    expect(message).to.contain('JWT_SECRET')
    expect(message).to.contain('RESEND_API_KEY')
    expect(message).to.not.contain(validEnv.STRIPE_SECRET_KEY)
  })

  it('should accept a localhost CLIENT_BASE_URL', () => {
    process.env = {
      ...originalEnv,
      ...validEnv,
      CLIENT_BASE_URL: 'http://localhost:3000'
    }
    expect(getServerEnv().CLIENT_BASE_URL).to.equal('http://localhost:3000')
  })

  it('should reject a CLIENT_BASE_URL that is not an http(s) url', () => {
    process.env = {
      ...originalEnv,
      ...validEnv,
      CLIENT_BASE_URL: 'ftp://example.com'
    }
    expect(() => getServerEnv()).to.throw(/CLIENT_BASE_URL/)
  })

  it('should reject a CLIENT_BASE_URL that is not a url', () => {
    process.env = { ...originalEnv, ...validEnv, CLIENT_BASE_URL: 'not-a-url' }
    expect(() => getServerEnv()).to.throw(/CLIENT_BASE_URL/)
  })
})
