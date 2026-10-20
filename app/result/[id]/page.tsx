'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getCheckoutSession } from 'services/checkout'
import { formatAmountForDisplayFromStripe } from 'utils/stripe-helpers'
import { CURRENCY } from 'config'
import Stripe from 'stripe'

const Result = () => {
  const params = useParams<{ id: string }>()
  const { id } = params!
  const [session, setSession] = useState<Stripe.Checkout.Session>()
  const [loading, setLoading] = useState<boolean>(true)
  const [failed, setFailed] = useState<boolean>(false)

  const fetchCheckout = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      setSession(await getCheckoutSession(id))
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchCheckout()
  }, [fetchCheckout])

  if (loading) {
    return (
      <div className='w-full h-screen pt-24 pl-4 text-white bg-ahBlue'>
        Loading...
      </div>
    )
  }

  return (
    <div className='w-full h-screen pt-32 bg-ahBlue'>
      <div className='flex flex-col items-center w-11/12 p-6 mx-auto my-0 bg-white rounded shadow-md lg:w-1/2 lg:h-96 justify-evenly'>
        <div className='mb-6 text-base lg:text-xl'>
          {failed || !session ? (
            <>
              Thank you for your donation. We couldn&apos;t load the details of
              this one.
            </>
          ) : (
            <>
              Thank you for your{' '}
              {formatAmountForDisplayFromStripe(
                session.amount_total!,
                CURRENCY
              )}{' '}
              {session.mode === 'subscription' ? 'recurring' : null} donation to
              Amplify Hope: {session.metadata?.fund}.
            </>
          )}
        </div>
        <div>
          <Link href='/'>
            <button className='px-4 py-2 border border-solid rounded border-primary hover:bg-black/10 text-primary'>
              {'<-- Back Home'}
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Result
