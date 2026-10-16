import { LoginWithEmailRequestBody } from 'common/types'
import { IconSend } from '@tabler/icons-react'
import { ErrorMessage, Field, Form, Formik, FormikHelpers } from 'formik'
import { useState } from 'react'
import fetchJson from 'utils/fetchJson'
import { LoginWithEmailSchema } from 'utils/validation-schema'
import { useRouter } from 'next/navigation'

type FormValues = {
  email: string
}

export const LoginWithEmailForm = () => {
  const [loading, setLoading] = useState<boolean>(false)
  const router = useRouter()

  return (
    <div className='w-full p-6 mt-2 bg-white rounded shadow-md'>
      <Formik
        enableReinitialize={true}
        initialValues={{
          email: ''
        }}
        validationSchema={LoginWithEmailSchema}
        onSubmit={async (
          formValues: FormValues,
          { setSubmitting }: FormikHelpers<FormValues>
        ) => {
          setLoading(true)
          const requestBody: LoginWithEmailRequestBody = {
            email: formValues.email
          }

          await fetchJson('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          })

          setLoading(false)
          setSubmitting(false)

          router.push(`/auth/verify?email=${formValues.email}`)
        }}
      >
        {props => {
          return (
            <Form className='flex flex-col items-center justify-between w-full h-full'>
              <div className='w-full'>
                <div className='mb-4'>
                  <label>Email</label>
                  <Field
                    id='email'
                    value={props.values.email}
                    onChange={props.handleChange}
                    type='email'
                    name='email'
                    placeholder='user@example.com'
                    className='w-full px-3 py-2 bg-white border rounded-md shadow-sm border-slate-300 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-sky-500 sm:text-sm focus:ring-1'
                  />
                  <ErrorMessage
                    name='email'
                    className='text-sm text-red-500'
                    component='a'
                  />
                </div>
              </div>
              <button
                type='submit'
                disabled={loading}
                className='flex justify-center w-full py-2 mt-10 border border-solid rounded border-primary bg-primary-500 hover:bg-primary-600 text-white font-semibold'
              >
                <IconSend className='mr-2' /> Send Magic Link
              </button>
            </Form>
          )
        }}
      </Formik>
    </div>
  )
}
