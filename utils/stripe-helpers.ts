import { STRIPE_FEE_PERCENT_MODIFIER, STRIPE_FEE_FIXED } from '../config'

export const formatAmountForDisplay = (
  amount: number,
  currency: string
): string => {
  const numberFormat = new Intl.NumberFormat(['en-US'], {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol'
  })
  return numberFormat.format(amount)
}

export const formatAmountForDisplayFromStripe = (
  amount: number,
  currency: string
): string => {
  const numberFormat = new Intl.NumberFormat(['en-US'], {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol'
  })
  return numberFormat.format(amount / 100)
}

export const formatAmountForStripe = (
  amount: number,
  currency: string
): number => {
  const numberFormat = new Intl.NumberFormat(['en-US'], {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol'
  })
  const parts = numberFormat.formatToParts(amount)
  let zeroDecimalCurrency: boolean = true
  for (const part of parts) {
    if (part.type === 'decimal') {
      zeroDecimalCurrency = false
    }
  }
  return zeroDecimalCurrency ? amount : Math.round(amount * 100)
}

export const calculateStripeFees = (amount: number): string => {
  return (amount * STRIPE_FEE_PERCENT_MODIFIER + STRIPE_FEE_FIXED).toFixed(2)
}
