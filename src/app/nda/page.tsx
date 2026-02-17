export default function NDAPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12 text-zinc-800 dark:text-zinc-200">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        Non-Disclosure Agreement
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Effective upon acceptance
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            1. Confidential Information
          </h2>
          <p className="mt-2">
            By participating in this survey you will be exposed to confidential
            information including, but not limited to, product designs, concepts,
            prototypes, images, names, features, technical specifications, and
            business strategies (&quot;Confidential Information&quot;). This
            information is proprietary and owned by the survey organiser
            (&quot;Disclosing Party&quot;).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            2. Non-Disclosure Obligation
          </h2>
          <p className="mt-2">
            You agree to keep all Confidential Information strictly confidential.
            You shall not disclose, publish, share, or otherwise make available
            any Confidential Information to any third party without the prior
            written consent of the Disclosing Party. This includes, but is not
            limited to, sharing on social media, messaging apps, forums, or in
            conversation.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            3. No Photographs or Recordings
          </h2>
          <p className="mt-2">
            You shall not photograph, screenshot, screen-record, or otherwise
            capture any Confidential Information shown during the survey, unless
            explicitly authorised by the Disclosing Party.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            4. Intellectual Property
          </h2>
          <p className="mt-2">
            All Confidential Information, including any inventions, designs, and
            concepts disclosed during the survey, remains the exclusive
            intellectual property of the Disclosing Party. Nothing in this
            agreement grants you any rights, licences, or interest in the
            Confidential Information. You acknowledge that the Disclosing Party
            may seek patent, trademark, design, or other intellectual property
            protection for the products and concepts shown, and you agree not to
            take any action that would impair or jeopardise such rights.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            5. Duration
          </h2>
          <p className="mt-2">
            This non-disclosure obligation shall remain in effect for a period of
            three (3) years from the date of acceptance, or until the
            Confidential Information becomes publicly available through no fault
            of yours, whichever occurs first.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            6. Remedies
          </h2>
          <p className="mt-2">
            You acknowledge that any breach of this agreement may cause
            irreparable harm to the Disclosing Party, and that the Disclosing
            Party shall be entitled to seek injunctive relief in addition to any
            other remedies available at law or in equity.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            7. Acceptance
          </h2>
          <p className="mt-2">
            By pressing &quot;Start&quot; on the survey introduction page, you
            acknowledge that you have read, understood, and agree to be bound by
            the terms of this Non-Disclosure Agreement. Your participation in the
            survey constitutes your acceptance.
          </p>
        </section>
      </div>

      <div className="mt-10 border-t border-zinc-200 pt-6 text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
        <p>
          If you have any questions about this agreement, please contact the
          survey organiser before proceeding.
        </p>
      </div>
    </div>
  );
}
