import { DonationRequestBody, IntervalOptions } from 'common/types'
import { ErrorMessage, Field, Form, Formik, FormikHelpers } from 'formik'
import { ProductType } from 'lib/types'
import { useState } from 'react'
import { getProducts } from 'services/products'
import useSWR from 'swr'
import fetchJson from 'utils/fetchJson'
import getStripe from 'utils/get-stripejs'
import {
  calculateStripeFees,
  formatAmountForDisplay
} from 'utils/stripe-helpers'
import {
  OneTimeDonationSchema,
  RecurringDonationSchema
} from 'utils/validation-schema'
import * as config from '../../config'

type CheckoutFormProps = {
  isRecurring: boolean
}

type FormValues = {
  email: string
  amount: string
  fees: string
  coverFees: boolean
  interval: IntervalOptions
  fund: string
  notes: string
  isRecurring: boolean
}

const intervalOptions: IntervalOptions[] = [
  IntervalOptions.month,
  IntervalOptions.quarter,
  IntervalOptions.year
]

export const CheckoutForm = (props: CheckoutFormProps) => {
  const { isRecurring } = props
  const [loading, setLoading] = useState<boolean>(false)
  const productType: ProductType = isRecurring ? 'recurring' : 'one-time'
  const {
    data: fundOptions,
    error,
    isLoading
  } = useSWR(['products', productType] as const, ([, type]) =>
    getProducts(type)
  )

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div className='w-full p-6 mt-2 bg-white rounded shadow-md'>
      <Formik
        enableReinitialize={true}
        initialValues={{
          email: '',
          amount: '',
          fees: '0',
          coverFees: false,
          interval: '',
          fund: '',
          notes: ' ',
          isRecurring
        }}
        validationSchema={
          isRecurring ? RecurringDonationSchema : OneTimeDonationSchema
        }
        onSubmit={async (
          formValues: FormValues,
          { setSubmitting }: FormikHelpers<FormValues>
        ) => {
          setLoading(true)

          const amount = !formValues.coverFees
            ? Number(formValues.amount)
            : Number(Number(formValues.amount) + Number(formValues.fees))

          const requestBody: DonationRequestBody = {
            email: formValues.email,
            amount,
            interval: isRecurring ? formValues.interval : null,
            stripeProductId: formValues.fund,
            notes: formValues.notes,
            isRecurring
          }

          const response = await fetchJson('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          })

          if (!response) {
            setLoading(false)
            setSubmitting(false)
            return
          }

          const stripe = await getStripe()
          const { error } = await stripe!.redirectToCheckout({
            sessionId: response.id
          })
          if (error) console.warn(error.message)
          setLoading(false)
          setSubmitting(false)
        }}
      >
        {props => {
          return (
            <Form className='flex flex-col items-center justify-between w-full h-full'>
              <div className='w-full'>
                <div className='mb-4'>
                  <div className='flex items-center justify-between'>
                    <label>Email</label>
                    <ErrorMessage
                      name='email'
                      className='text-sm text-red-500'
                      component='div'
                    />
                  </div>
                  <Field
                    id='email'
                    value={props.values.email}
                    onChange={props.handleChange}
                    type='email'
                    name='email'
                    placeholder='user@example.com'
                    className='w-full px-3 py-2 bg-white border rounded-md shadow-sm border-slate-300 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-sky-500 sm:text-sm focus:ring-1'
                  />
                </div>
                <div className='flex items-center justify-start w-full mb-4 lg:flex-row lg:items-center'>
                  <div className='w-2/3'>
                    <div className='flex items-center justify-between'>
                      <label>Amount</label>
                      <ErrorMessage
                        name='amount'
                        className='text-sm text-red-500'
                        component='div'
                      />
                    </div>
                    <Field
                      id='donation'
                      value={props.values.amount}
                      name='amount'
                      placeholder='Donation Amount'
                      min={config.MIN_AMOUNT}
                      max={config.MAX_AMOUNT}
                      onChange={e => {
                        props.handleChange(e)
                        props.setFieldValue(
                          'fees',
                          calculateStripeFees(+e.target.value)
                        )
                      }}
                      className='w-full px-3 py-2 bg-white border rounded-md shadow-sm border-slate-300 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-sky-500 sm:text-sm focus:ring-1'
                    />
                  </div>
                  <div className={`ml-4 mt-6`}>
                    <label className='flex items-center justify-center cursor-pointer'>
                      <Field
                        type='checkbox'
                        name='coverFees'
                        className='sr-only peer'
                      />
                      <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-ahBlue"></div>
                      <span className='ms-2 text-sm'>
                        Cover Fees{' '}
                        {props.values.amount
                          ? `$${props.values.fees.toString()}`
                          : ''}
                      </span>
                    </label>
                  </div>
                </div>
                <div className='flex flex-col items-start justify-between w-full mb-4 lg:flex-row lg:items-center'>
                  <div
                    className={`${
                      isRecurring
                        ? 'relative w-full lg:w-1/2 lg:mr-2'
                        : 'relative w-full'
                    }`}
                  >
                    <div className='flex items-center justify-between'>
                      <label>Fund</label>
                      <ErrorMessage
                        name='fund'
                        className='text-sm text-red-500'
                        component='div'
                      />
                    </div>
                    <Field
                      as='select'
                      id='fund'
                      onChange={props.handleChange}
                      name='fund'
                      className='w-full px-3 py-2 leading-tight text-gray-700 border rounded-md shadow-sm appearance-none border-slate-300 focus:outline-none focus:border-sky-500 focus:ring-sky-500 sm:text-sm focus:ring-1'
                    >
                      <option
                        value=''
                        disabled
                        selected
                        hidden
                        className='text-slate-400'
                      >
                        Choose a Fund
                      </option>
                      {fundOptions?.products?.map((fund, index) => (
                        <option key={index} value={fund.stripeId}>
                          {fund.productName.split('|')[0]}
                        </option>
                      ))}
                    </Field>
                    <div className='absolute inset-y-0 right-0 flex items-center px-2 mt-5 text-slate-700 pointer-events-none'>
                      <svg
                        className='w-4 h-4 fill-current'
                        xmlns='http://www.w3.org/2000/svg'
                        viewBox='0 0 20 20'
                      >
                        <path d='M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z' />
                      </svg>
                    </div>
                  </div>
                  {isRecurring && (
                    <div className='relative w-full mt-4 lg:w-1/2 lg:ml-2 lg:mt-0'>
                      <div className='flex items-center justify-between'>
                        <label>Interval</label>
                        <ErrorMessage
                          name='interval'
                          className='text-sm text-red-500'
                          component='div'
                        />
                      </div>
                      <Field
                        as='select'
                        id='interval'
                        name='interval'
                        onChange={props.handleChange}
                        className='w-full px-3 py-2 leading-tight text-gray-700 border rounded-md shadow-sm appearance-none border-slate-300 focus:outline-none focus:border-sky-500 focus:ring-sky-500 sm:text-sm focus:ring-1'
                      >
                        <option
                          value=''
                          disabled
                          selected
                          hidden
                          className='text-slate-400'
                        >
                          Choose an interval
                        </option>
                        {intervalOptions.map((option, index) => (
                          <option key={index} value={option}>
                            {option}
                          </option>
                        ))}
                      </Field>

                      <div className='absolute inset-y-0 right-0 flex items-center px-2 mt-5 text-gray-700 pointer-events-none'>
                        <svg
                          className='w-4 h-4 fill-current'
                          xmlns='http://www.w3.org/2000/svg'
                          viewBox='0 0 20 20'
                        >
                          <path d='M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z' />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
                <div className='mb-4'>
                  <div className='flex items-center justify-between'>
                    <label>Notes</label>
                    <ErrorMessage
                      name='notes'
                      className='text-sm text-red-500'
                      component='div'
                    />
                  </div>
                  <Field
                    id='notes'
                    value={props.values.notes}
                    onChange={props.handleChange}
                    name='notes'
                    className='w-full px-3 py-2 bg-white border rounded-md shadow-sm border-slate-300 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-sky-500 sm:text-sm focus:ring-1'
                  />
                </div>
              </div>
              <button
                type='submit'
                disabled={loading}
                className='w-full py-2 mt-4 border border-solid rounded border-primary hover:bg-black/10 text-primary'
              >
                Donate{' '}
                {formatAmountForDisplay(
                  !props.values.coverFees
                    ? Number(props.values.amount)
                    : Number(
                        Number(props.values.amount) + Number(props.values.fees)
                      ),
                  config.CURRENCY
                )}{' '}
              </button>
            </Form>
          )
        }}
      </Formik>
    </div>
  )
}
