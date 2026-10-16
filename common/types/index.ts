export type DonationRequestBody = {
  email: string
  amount: number
  interval: IntervalOptions | null
  stripeProductId: string
  notes?: string
  isRecurring: boolean
}

export type LoginWithEmailRequestBody = {
  email: string
}

export enum IntervalOptions {
  month = 'month',
  quarter = 'quarter',
  year = 'year'
}

export type ContactProps = {
  name: string
  title: string
}
