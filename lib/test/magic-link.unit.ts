import { expect } from 'chai'
import jwt from 'jsonwebtoken'
import {
  buildMagicLink,
  sendMagicLink,
  signMagicLinkToken,
  verifyMagicLinkToken
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

  describe('verifyMagicLinkToken', () => {
    const payload = { stripeCustomerId: 'cus_1', email: 'donor@example.com' }
    const secret = 'secret'

    it('should return the payload of a token it signed', () => {
      const token = signMagicLinkToken(payload, secret)

      expect(verifyMagicLinkToken(token, secret)).to.deep.eq(payload)
    })

    it('should reject an expired token', () => {
      const token = jwt.sign(payload, secret, { expiresIn: -10 })

      expect(() => verifyMagicLinkToken(token, secret)).to.throw('jwt expired')
    })

    it('should reject a token signed with a different secret', () => {
      const token = signMagicLinkToken(payload, 'other-secret')

      expect(() => verifyMagicLinkToken(token, secret)).to.throw()
    })

    it('should reject a tampered token', () => {
      const token = signMagicLinkToken(payload, secret)
      const tampered = `${token.slice(0, -2)}${token.endsWith('aa') ? 'bb' : 'aa'}`

      expect(() => verifyMagicLinkToken(tampered, secret)).to.throw()
    })

    it('should reject an unsigned token and a token signed with another algorithm', () => {
      const unsigned = jwt.sign(payload, '', { algorithm: 'none' })
      const hs512 = jwt.sign(payload, secret, { algorithm: 'HS512' })

      expect(() => verifyMagicLinkToken(unsigned, secret)).to.throw()
      expect(() => verifyMagicLinkToken(hs512, secret)).to.throw()
    })

    it('should reject a validly signed token that lacks the expected claims', () => {
      for (const claims of [
        { email: 'donor@example.com' },
        { stripeCustomerId: 'cus_1' },
        { stripeCustomerId: 1, email: 'donor@example.com' }
      ]) {
        const token = jwt.sign(claims, secret)

        expect(() => verifyMagicLinkToken(token, secret)).to.throw(
          'Invalid magic link token'
        )
      }
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
