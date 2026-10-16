import { expect } from 'chai'
import * as yup from 'yup'
import { IntervalOptions } from '../../common/types'
import {
  buildLookupKey,
  fundFromProductName,
  parseDonationBody,
  stripeRecurrence
} from '../donation'

const validBody = {
  email: 'donor@example.com',
  amount: 25,
  interval: null,
  stripeProductId: 'prod_general',
  notes: ' ',
  isRecurring: false
}

describe('#donation', () => {
  describe('buildLookupKey', () => {
    it('should join product and cents for a one-time donation', () => {
      expect(buildLookupKey('prod_1', null, 2500)).to.eq('prod_1|2500')
    })

    it('should include the interval for a recurring donation', () => {
      expect(buildLookupKey('prod_1', IntervalOptions.quarter, 2500)).to.eq(
        'prod_1|quarter|2500'
      )
    })
  })

  describe('stripeRecurrence', () => {
    it('should map month, quarter and year to Stripe intervals', () => {
      expect(stripeRecurrence(IntervalOptions.month)).to.deep.eq({
        interval: 'month',
        intervalCount: 1
      })
      expect(stripeRecurrence(IntervalOptions.quarter)).to.deep.eq({
        interval: 'month',
        intervalCount: 3
      })
      expect(stripeRecurrence(IntervalOptions.year)).to.deep.eq({
        interval: 'year',
        intervalCount: 1
      })
    })

    it('should default to monthly when there is no interval', () => {
      expect(stripeRecurrence(null)).to.deep.eq({
        interval: 'month',
        intervalCount: 1
      })
    })
  })

  describe('fundFromProductName', () => {
    it('should return the part before the pipe', () => {
      expect(fundFromProductName('General Fund|one-time')).to.eq('General Fund')
    })

    it('should return the whole name when there is no pipe', () => {
      expect(fundFromProductName('Scholarship Fund')).to.eq('Scholarship Fund')
    })
  })

  describe('parseDonationBody', () => {
    it('should return a valid body and strip unknown fields', () => {
      expect(parseDonationBody({ ...validBody, extra: 'x' })).to.deep.eq(
        validBody
      )
    })

    it('should coerce a numeric string amount', () => {
      expect(parseDonationBody({ ...validBody, amount: '25.5' }).amount).to.eq(
        25.5
      )
    })

    it('should throw a client-safe yup error for bad input', () => {
      expect(() => parseDonationBody({ ...validBody, amount: 0 }))
        .to.throw(yup.ValidationError)
        .with.property('message', 'Invalid amount')
    })
  })
})
