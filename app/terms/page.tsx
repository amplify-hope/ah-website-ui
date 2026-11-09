import type { Metadata } from 'next'
import { LegalPage } from 'components'

export const metadata: Metadata = {
  title: 'Terms of Use | Amplify Hope',
  description: 'Terms for using the Amplify Hope website and tools'
}

export default function Terms() {
  return (
    <LegalPage title='Terms of Use' updated='November 9, 2026'>
      <p>
        These terms apply to the Amplify Hope website at amplifyhope.cc and to
        the internal finance dashboard operated by Amplify Hope, a US 501(c)(3)
        non-profit (EIN 87-2385986). By using either, you agree to them.
      </p>

      <h2>The website</h2>
      <p>
        You may browse the site and donate through it. Donations are processed
        by Stripe and are subject to Stripe&apos;s terms. Please do not misuse
        the site, attempt to disrupt it, or probe it for weaknesses.
      </p>

      <h2>The finance dashboard</h2>
      <ul>
        <li>
          The dashboard is an internal tool for authorized Amplify Hope finance
          staff. It is not offered to the public.
        </li>
        <li>
          Amplify Hope grants authorized staff a limited, non-transferable right
          to use it for the organization&apos;s own finance work.
        </li>
        <li>
          Access is through SSO. Staff must not share access or use the
          dashboard for any other purpose.
        </li>
        <li>
          The dashboard reads from QuickBooks Online and Stripe and does not
          move money.
        </li>
      </ul>

      <h2>No warranty</h2>
      <p>
        The site and dashboard are provided as is. Amplify Hope does not
        guarantee they will be uninterrupted or error-free.
      </p>

      <h2>Privacy</h2>
      <p>
        How we handle personal information is described in our{' '}
        <a href='/privacy'>Privacy Policy</a>.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We may update these terms and will change the date above when we do.
        Questions can be sent to Amplify Hope, 7635 W 148th St #308, Apple
        Valley, MN 55124.
        {/* TODO(owner): add a contact email, governing law and any
            liability limits before approval */}
      </p>
    </LegalPage>
  )
}
