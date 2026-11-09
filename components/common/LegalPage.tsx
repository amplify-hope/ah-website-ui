import { ReactNode } from 'react'
import { Footer } from 'components'

export const LegalPage = ({
  title,
  updated,
  children
}: {
  title: string
  updated: string
  children: ReactNode
}) => (
  <div>
    <main className='w-full px-8 pt-28 pb-16 mx-auto max-w-3xl font-body text-gray-800'>
      <h1 className='mb-2 text-4xl font-bold font-heading text-ahBlue'>
        {title}
      </h1>
      <p className='mb-8 text-sm text-ahGray'>Last updated: {updated}</p>
      <div className='space-y-4 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:font-subheading [&_h2]:text-ahBlue [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_a]:underline'>
        {children}
      </div>
    </main>
    <Footer />
  </div>
)
