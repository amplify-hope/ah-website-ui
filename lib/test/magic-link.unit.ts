import { expect } from 'chai'
import jwt from 'jsonwebtoken'
import {
  buildMagicLink,
  sendMagicLink,
  signMagicLinkToken
} from '../magic-link'
import { fakeResend, testEnv } from './helpers'

describe('#magicLink', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('signMagicLinkToken', () => {
    const payload = { stripeCustomerId: 'cus_1', email: 'donor@example.com' }

    it('should sign an HS256 token carrying the customer id and email for 10 minutes', () => {
      const token = signMagicLinkToken(payload, 'secret')
      const { header, payload: claims } = jwt.decode(token, {
        complete: true
      }) as jwt.Jwt & { payload: jwt.JwtPayload }

      expect(header.alg).to.eq('HS256')
      expect(claims.stripeCustomerId).to.eq('cus_1')
      expect(claims.email).to.eq('donor@example.com')
      expect((claims.exp as number) - (claims.iat as number)).to.eq(600)
    })

    it('should produce a token that only verifies with the signing secret', () => {
      const token = signMagicLinkToken(payload, 'secret')

      expect(() => jwt.verify(token, 'secret')).to.not.throw()
      expect(() => jwt.verify(token, 'other-secret')).to.throw()
    })
  })

  describe('buildMagicLink', () => {
    it('should point at this app’s verify route', () => {
      expect(buildMagicLink(testEnv, 'abc.def.ghi')).to.eq(
        'https://example.com/api/verify?token=abc.def.ghi'
      )
    })

    it('should ignore a trailing slash on CLIENT_BASE_URL', () => {
      const env = { ...testEnv, CLIENT_BASE_URL: 'https://example.com/' }

      expect(buildMagicLink(env, 'abc')).to.eq(
        'https://example.com/api/verify?token=abc'
      )
    })

    it('should url-encode the token', () => {
      expect(buildMagicLink(testEnv, 'a b&c')).to.eq(
        'https://example.com/api/verify?token=a%20b%26c'
      )
    })
  })

  describe('sendMagicLink', () => {
    it('should send the Resend template with the link and tags, and return the Resend result', async () => {
      process.env.NEXT_PUBLIC_APP_ENV = 'staging'
      const { resend, sent } = fakeResend()

      const result = await sendMagicLink(
        resend,
        testEnv,
        'donor@example.com',
        'cus_1',
        'tok'
      )

      expect(result.error).to.eq(null)
      expect(sent).to.deep.eq([
        {
          from: 'no-reply@amplifyhope.cc',
          to: 'donor@example.com',
          template: {
            id: 'template-fake',
            variables: {
              MAGIC_LINK: 'https://example.com/api/verify?token=tok'
            }
          },
          tags: [
            { name: 'environment', value: 'staging' },
            { name: 'stripe_customer_id', value: 'cus_1' }
          ]
        }
      ])
    })

    it('should fall back to NODE_ENV for the environment tag', async () => {
      delete process.env.NEXT_PUBLIC_APP_ENV
      const { resend, sent } = fakeResend()

      await sendMagicLink(resend, testEnv, 'donor@example.com', 'cus_1', 'tok')

      expect(sent[0].tags?.[0]).to.deep.eq({
        name: 'environment',
        value: process.env.NODE_ENV
      })
    })
  })
})
