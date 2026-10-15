import * as yup from 'yup'
import { DonationRequestBody, IntervalOptions } from '../common/types'
import { MAX_AMOUNT, MIN_AMOUNT } from '../config'
import { JsonValue } from './types'

const INVALID_AMOUNT = 'Invalid amount'

const donationSchema = yup
  .object({
    email: yup
      .string()
      .email('Please enter a valid email address.')
      .required('Email is required'),
    amount: yup
      .number()
      .typeError(INVALID_AMOUNT)
      .min(MIN_AMOUNT, INVALID_AMOUNT)
      .max(MAX_AMOUNT, INVALID_AMOUNT)
      .required(INVALID_AMOUNT),
    interval: yup
      .string()
      .nullable()
      .oneOf(
        [...Object.values(IntervalOptions), null],
        'Invalid donation interval'
      ),
    stripeProductId: yup
      .string()
      .matches(/^prod_/, 'Invalid product')
      .required('Invalid product'),
    notes: yup.string().optional(),
    isRecurring: yup.boolean().required()
  })
  .required()

// Throws a yup ValidationError (with a client-safe message) on bad input.
export const parseDonationBody = (body: JsonValue): DonationRequestBody =>
  donationSchema.validateSync(body, {
    stripUnknown: true
  }) as DonationRequestBody

// Matches the lookup keys ah-website-api already created, so existing Stripe
// prices keep being reused: `<product>|<interval|>?<cents>`.
export const buildLookupKey = (
  stripeProductId: string,
  interval: IntervalOptions | null | undefined,
  cents: number
): string => `${stripeProductId}|${interval ? `${interval}|` : ''}${cents}`

// Stripe has no quarterly interval, so a quarter is three months.
export const stripeRecurrence = (
  interval: IntervalOptions | null | undefined
) => ({
  interval:
    interval === IntervalOptions.year ? ('year' as const) : ('month' as const),
  intervalCount: interval === IntervalOptions.quarter ? 3 : 1
})

// Product names look like "General Fund|one-time"; the fund is the part before
// the pipe, which is also what the donate form shows in its dropdown.
export const fundFromProductName = (productName: string): string =>
  productName.split('|')[0]
