import type { Metadata } from 'next'
import { LegalPage } from 'components'

export const metadata: Metadata = {
  title: 'Privacy Policy | Amplify Hope',
  description: 'How Amplify Hope handles personal information'
}

export default function Privacy() {
  return (
    <LegalPage title='Privacy Policy' updated='November 9, 2026'>
      <p>
        Amplify Hope is a US 501(c)(3) non-profit (EIN 87-2385986) at 7635 W
        148th St #308, Apple Valley, MN 55124. This policy covers the website at
        amplifyhope.cc and the internal finance dashboard we use to run the
        organization.
      </p>

      <h2>Donating through this website</h2>
      <ul>
        <li>
          Donations are processed by Stripe. You enter your payment details on
          Stripe&apos;s checkout page; Amplify Hope does not receive or store
          your card number.
        </li>
        <li>
          Stripe gives us your name, email address, gift amount and frequency so
          we can record and acknowledge your gift.
        </li>
        <li>
          If you sign in to manage a recurring gift, we email a sign-in link to
          the address you enter, using Resend. The link expires after 10 minutes
          and leads to your Stripe billing portal.
        </li>
      </ul>

      <h2>Our internal finance dashboard</h2>
      <p>
        Amplify Hope runs a private dashboard for finance staff only. It is not
        open to the public and has no customer accounts. Access is through SSO
        and limited to one finance group.
      </p>
      <ul>
        <li>
          It connects to our QuickBooks Online company, read-only, and to
          Stripe, to show cash balances, spending and donations.
        </li>
        <li>
          The information it handles is the organization&apos;s own books and
          the donor names and gift amounts that appear in QuickBooks and Stripe
          records. Donor names appear only on a separate, access-controlled
          page.
        </li>
        <li>It does not move money.</li>
      </ul>

      <h2>Who we share information with</h2>
      <p>
        We do not sell personal information, use it for advertising, or share it
        with anyone beyond the service providers that help us operate:
      </p>
      <ul>
        <li>Stripe (payments and donor records)</li>
        <li>Intuit QuickBooks (accounting records)</li>
        <li>Okta (staff sign-in to the finance dashboard)</li>
        <li>Amazon Web Services (hosting, in Oregon, United States)</li>
        <li>Neon (database for the finance dashboard, United States)</li>
        <li>Resend (sign-in emails)</li>
        <li>Sentry (error reports)</li>
      </ul>
      <p>
        Error reports sent to Sentry have request bodies, cookies, query strings
        and user details removed before they leave our servers.
      </p>

      <h2>Your choices</h2>
      <p>
        To ask what we hold about you, or to ask us to correct or delete it,
        contact us using the details below. We may need to keep some records,
        such as donation receipts, to meet legal and accounting obligations.
      </p>

      <h2>Contact</h2>
      <p>
        Email <a href='mailto:info@amplifyhope.cc'>info@amplifyhope.cc</a> or
        write to Amplify Hope, 7635 W 148th St #308, Apple Valley, MN 55124.
      </p>
    </LegalPage>
  )
}
