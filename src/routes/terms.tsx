import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — n9n automation cloud" },
      {
        name: "description",
        content:
          "The terms governing your use of n9n: acceptable use, third-party credentials, workflow execution limits, liability and account termination.",
      },
      { property: "og:title", content: "Terms of Service — n9n" },
      {
        property: "og:description",
        content: "Acceptable use, credentials handling and service limits for the n9n automation cloud.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="13 August 2026">
      <Section title="1. The service">
        n9n is a hosted workflow automation platform. You build workflows from nodes, connect
        third-party services with your own credentials, and the platform executes those workflows on
        our servers via manual runs, schedules and webhooks.
      </Section>
      <Section title="2. Your account">
        You must provide a valid email address and keep your password confidential. You are
        responsible for everything that happens under your account, including workflow executions
        and any charges they cause at third-party providers.
      </Section>
      <Section title="3. Acceptable use">
        You may not use n9n to send unsolicited messages, scrape services in breach of their terms,
        attack or overload third-party systems, mine cryptocurrency, host malware, or process data
        you have no legal right to process. Automated abuse detection, per-account rate limits and
        execution concurrency caps apply and may be tightened without notice.
      </Section>
      <Section title="4. Third-party credentials">
        API keys and tokens you store are encrypted at rest with AES-GCM and are only decrypted
        inside the execution engine. You remain bound by each provider's own terms. We are not
        responsible for costs incurred at providers through your workflows.
      </Section>
      <Section title="5. Limits and availability">
        Executions are subject to a per-workflow timeout, request size limits on webhook bodies, and
        per-account concurrency caps. The service is provided on an "as is" and "as available"
        basis, without warranties of any kind.
      </Section>
      <Section title="6. Liability">
        To the maximum extent permitted by law, our aggregate liability for any claim relating to
        the service is limited to the amount you paid for the service in the twelve months before
        the claim.
      </Section>
      <Section title="7. Termination">
        You may delete your account at any time; doing so deletes your workflows, credentials and
        execution logs. We may suspend accounts that breach these terms or endanger the platform.
      </Section>
      <Section title="8. Contact">
        Questions about these terms: <span className="text-foreground">legal@eweblb.com</span>.
      </Section>
    </LegalLayout>
  );
}

export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link
          to="/"
          className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        >
          ← n9n
        </Link>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
        <div className="mt-10 space-y-8">{children}</div>
      </div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </section>
  );
}
