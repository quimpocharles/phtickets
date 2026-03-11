import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Legal — Terms & Privacy',
  description: 'Terms and Conditions and Privacy Policy for the Global Hoops International Showcase official pass system.',
  robots: { index: false, follow: false },
};

export default function LegalPage() {
  const updated = 'March 6, 2026';

  return (
    <div className="max-w-3xl mx-auto px-6 py-16 text-offblack">

      {/* Breadcrumb */}
      <nav className="text-xs text-offblack/40 mb-10">
        <Link href="/" className="hover:text-primary transition-colors">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-offblack/70 font-medium">Legal</span>
      </nav>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Legal</h1>
      <p className="text-sm text-offblack/40 mb-12">Last updated: {updated}</p>

      {/* ── Terms & Conditions ── */}
      <section className="mb-16">
        <h2 className="text-xl font-black uppercase tracking-wide mb-6 pb-3 border-b border-black/10">
          Terms &amp; Conditions
        </h2>

        <div className="flex flex-col gap-8 text-sm leading-relaxed text-offblack/80">

          <div>
            <h3 className="font-bold text-offblack mb-2">1. General</h3>
            <p>
              These Terms &amp; Conditions govern the purchase of passes through the Global Hoops International Showcase official pass
              website (<strong>phtickets.vercel.app</strong> or any associated domain). By completing a purchase
              you agree to these terms in full. Global Hoops International (&ldquo;Global Hoops&rdquo;)
              reserves the right to update these terms at any time without prior notice.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-offblack mb-2">2. Pass Purchase</h3>
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li>All pass sales are processed through Maya Payment, a licensed payment service provider.</li>
              <li>Prices are quoted and charged in Philippine Peso (PHP).</li>
              <li>A pass is issued only after payment is confirmed by Maya.</li>
              <li>QR codes will be sent to the email address provided at checkout. Keep them safe — they are your entry passes.</li>
              <li>Global Hoops is not liable for passes lost, forwarded, or shared with unauthorized third parties.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-offblack mb-2">3. No Refund Policy</h3>
            <p>
              All pass sales are <strong>final and non-refundable</strong>. No exchanges or cancellations
              are accepted after payment is processed, except in the event that Global Hoops cancels or
              postpones the event (see Section 5).
            </p>
          </div>

          <div>
            <h3 className="font-bold text-offblack mb-2">4. Prohibited Resale</h3>
            <p>
              Passes may not be resold, transferred for profit, or listed on any secondary ticketing
              marketplace. Global Hoops reserves the right to void passes obtained through unauthorized channels
              without compensation.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-offblack mb-2">5. Event Cancellation or Postponement</h3>
            <p>
              If an event is cancelled by Global Hoops, pass holders will be notified via email and a refund
              or credit will be issued at Global Hoops&rsquo;s discretion. Global Hoops is not responsible for any
              incidental costs (travel, accommodation, etc.) incurred by pass holders.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-offblack mb-2">6. Venue Entry Rules</h3>
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li>A valid government-issued ID matching the buyer name (if provided) may be required at entry.</li>
              <li>Each QR code is valid for a single scan. Duplicated or screenshot QR codes may be denied entry.</li>
              <li>Global Hoops and venue management reserve the right to refuse entry to anyone who violates venue policies.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-offblack mb-2">7. Limitation of Liability</h3>
            <p>
              Global Hoops&rsquo;s total liability arising from pass purchases shall not exceed the face value of
              the pass(es) purchased. Global Hoops is not liable for any indirect or consequential damages.
            </p>
          </div>

        </div>
      </section>

      {/* ── Privacy Policy ── */}
      <section>
        <h2 className="text-xl font-black uppercase tracking-wide mb-6 pb-3 border-b border-black/10">
          Privacy Policy
        </h2>

        <div className="flex flex-col gap-8 text-sm leading-relaxed text-offblack/80">

          <div>
            <h3 className="font-bold text-offblack mb-2">1. Data We Collect</h3>
            <p>When you purchase a pass we collect:</p>
            <ul className="list-disc pl-5 mt-2 flex flex-col gap-1.5">
              <li><strong>Name</strong> — optional, used to personalise your pass.</li>
              <li><strong>Email address</strong> — required to deliver your QR-coded pass(es).</li>
              <li><strong>Mobile number</strong> — required for SMS pass delivery.</li>
              <li><strong>Payment information</strong> — handled entirely by Maya; Global Hoops does not store card details.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-offblack mb-2">2. How We Use Your Data</h3>
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li>To generate and deliver your passes via email and SMS.</li>
              <li>To verify identity at the venue gate if required.</li>
              <li>To contact you about event changes or cancellations.</li>
              <li>To generate anonymised attendance reports for Global Hoops operations.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-offblack mb-2">3. Third-Party Services</h3>
            <p>We use the following third-party services to operate the pass system:</p>
            <ul className="list-disc pl-5 mt-2 flex flex-col gap-1.5">
              <li><strong>Maya Payment</strong> — payment processing (PCI-DSS compliant).</li>
              <li><strong>Semaphore</strong> — SMS delivery of passes.</li>
              <li><strong>Cloudinary</strong> — storage of generated QR code images.</li>
              <li><strong>MongoDB Atlas</strong> — secure cloud database hosted in the Asia-Pacific region.</li>
            </ul>
            <p className="mt-2">
              Each provider has its own privacy policy and data processing terms. Global Hoops does not sell
              your personal data to any third party.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-offblack mb-2">4. Data Retention</h3>
            <p>
              Order and pass records are retained for a minimum of one (1) year after the event date
              for audit and reconciliation purposes, after which they may be anonymised or deleted.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-offblack mb-2">5. Your Rights</h3>
            <p>
              You may request access to, correction of, or deletion of your personal data by contacting
              us at the email below. We will respond within fifteen (15) business days.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-offblack mb-2">6. Contact</h3>
            <p>
              For any questions about these policies, email us at{' '}
              <a href="mailto:nbtcph@codeatcoffee.com" className="text-primary underline underline-offset-2">
                nbtcph@codeatcoffee.com
              </a>.
            </p>
          </div>

        </div>
      </section>

    </div>
  );
}
