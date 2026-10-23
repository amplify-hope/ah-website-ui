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

  const rejection = async (promise: Promise<unknown>): Promise<string> => {
    try {
      await promise
    } catch (err) {
      return (err as Error).message
    }
    return ''
  }

  it('should return the parsed server env when all variables are valid', async () => {
    process.env = { ...originalEnv, ...validEnv }
    expect(await getServerEnv()).to.deep.eq(validEnv)
  })

  it('should name every missing variable without exposing values', async () => {
    process.env = { ...originalEnv, ...validEnv }
    delete process.env.JWT_SECRET
    delete process.env.RESEND_API_KEY

    const message = await rejection(getServerEnv())

    expect(message).to.contain('JWT_SECRET')
    expect(message).to.contain('RESEND_API_KEY')
    expect(message).to.not.contain(validEnv.STRIPE_SECRET_KEY)
  })

  it('should accept a localhost CLIENT_BASE_URL', async () => {
    process.env = {
      ...originalEnv,
      ...validEnv,
      CLIENT_BASE_URL: 'http://localhost:3000'
    }
    expect((await getServerEnv()).CLIENT_BASE_URL).to.equal(
      'http://localhost:3000'
    )
  })

  it('should reject a CLIENT_BASE_URL that is not an http(s) url', async () => {
    process.env = {
      ...originalEnv,
      ...validEnv,
      CLIENT_BASE_URL: 'ftp://example.com'
    }
    expect(await rejection(getServerEnv())).to.match(/CLIENT_BASE_URL/)
  })

  it('should reject a CLIENT_BASE_URL that is not a url', async () => {
    process.env = { ...originalEnv, ...validEnv, CLIENT_BASE_URL: 'not-a-url' }
    expect(await rejection(getServerEnv())).to.match(/CLIENT_BASE_URL/)
  })

  describe('with AH_SECRET_ID set', () => {
    beforeEach(() => {
      process.env = {
        ...originalEnv,
        AH_SECRET_ID: 'ah-website-ui/staging',
        AH_AWS_REGION: 'us-west-2'
      }
    })

    it('should read the secret instead of process.env', async () => {
      const calls: string[][] = []
      const fetchSecret = async (id: string, region: string) => {
        calls.push([id, region])
        return validEnv
      }

      expect(await getServerEnv(fetchSecret)).to.deep.eq(validEnv)
      expect(calls).to.deep.eq([['ah-website-ui/staging', 'us-west-2']])
    })

    it('should validate the secret like process.env', async () => {
      const { JWT_SECRET, ...incomplete } = validEnv
      expect(JWT_SECRET).to.be.a('string')

      const message = await rejection(getServerEnv(async () => incomplete))

      expect(message).to.contain('JWT_SECRET')
    })

    it('should require AH_AWS_REGION', async () => {
      delete process.env.AH_AWS_REGION
      let called = false

      const message = await rejection(
        getServerEnv(async () => {
          called = true
          return validEnv
        })
      )

      expect(message).to.contain('AH_AWS_REGION')
      expect(called).to.eq(false)
    })

    it('should share one fetch between concurrent first requests', async () => {
      let calls = 0
      const fetchSecret = async () => {
        calls++
        return validEnv
      }

      await Promise.all([
        getServerEnv(fetchSecret),
        getServerEnv(fetchSecret),
        getServerEnv(fetchSecret)
      ])

      expect(calls).to.eq(1)
    })

    it('should not cache a failed fetch', async () => {
      let calls = 0
      const fetchSecret = async () => {
        calls++
        if (calls === 1) throw new Error('throttled')
        return validEnv
      }

      expect(await rejection(getServerEnv(fetchSecret))).to.eq('throttled')
      expect(await getServerEnv(fetchSecret)).to.deep.eq(validEnv)
      expect(calls).to.eq(2)
    })

    describe('when a refresh fails after a good fetch', () => {
      const realNow = Date.now
      const realConsoleError = console.error
      const MINUTE = 60 * 1000
      let offset = 0

      beforeEach(() => {
        offset = 0
        Date.now = () => realNow() + offset
        console.error = () => undefined
      })

      afterEach(() => {
        Date.now = realNow
        console.error = realConsoleError
      })

      it('should keep serving the previous env instead of failing', async () => {
        let calls = 0
        const fetchSecret = async () => {
          calls++
          if (calls > 1) throw new Error('throttled')
          return validEnv
        }

        await getServerEnv(fetchSecret)
        offset = 6 * MINUTE

        expect(await getServerEnv(fetchSecret)).to.deep.eq(validEnv)
        expect(calls).to.eq(2)
      })

      it('should try again after a short wait, not a full TTL', async () => {
        const rotated = { ...validEnv, JWT_SECRET: 'rotated' }
        let calls = 0
        const fetchSecret = async () => {
          calls++
          if (calls === 2) throw new Error('throttled')
          return calls === 1 ? validEnv : rotated
        }

        await getServerEnv(fetchSecret)
        offset = 6 * MINUTE
        await getServerEnv(fetchSecret)
        expect(calls).to.eq(2)

        offset = 6 * MINUTE + 10 * 1000
        expect(await getServerEnv(fetchSecret)).to.deep.eq(validEnv)
        expect(calls).to.eq(2)

        offset = 6 * MINUTE + 31 * 1000
        expect(await getServerEnv(fetchSecret)).to.deep.eq(rotated)
        expect(calls).to.eq(3)
      })

      it('should log the failure without exposing secret values', async () => {
        const logged: string[] = []
        console.error = (...args: Parameters<typeof console.error>) => {
          logged.push(args.map(String).join(' '))
        }
        let calls = 0
        const fetchSecret = async () => {
          calls++
          if (calls > 1) throw new Error('throttled')
          return validEnv
        }

        await getServerEnv(fetchSecret)
        offset = 6 * MINUTE
        await getServerEnv(fetchSecret)

        expect(logged.join('\n')).to.contain('throttled')
        expect(logged.join('\n')).to.not.contain(validEnv.STRIPE_SECRET_KEY)
      })
    })
  })
})
