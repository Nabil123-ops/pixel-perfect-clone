import { createFileRoute } from "@tanstack/react-router";

import { LegalLayout, Section } from "./terms";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — n9n automation cloud" },
      {
        name: "description",
        content:
          "How n9n handles your account data, encrypted third-party credentials, workflow payloads and execution logs, including retention and deletion.",
      },
      { property: "og:title", content: "Privacy Policy — n9n" },
      {
        property: "og:description",
        content: "Data we store, how credentials are encrypted, and our execution-log retention policy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="13 August 2026">
      <Section title="Who we are">
        n9n is operated from eweblb.com. This policy explains what we store when you use the
        automation platform and for how long.
      </Section>
      <Section title="Account data">
        We store your email address and an authentication record managed by our database provider.
        Passwords are never stored in clear text.
      </Section>
      <Section title="Workflows and credentials">
        Workflows, nodes and connections you create are stored against your user id and are only
        readable by your account — enforced in the database with row level security. Third-party API
        keys and tokens are encrypted with AES-GCM before being written, and are only decrypted
        inside the execution engine at run time. They are never returned to the browser in clear
        text; the interface shows masked values only.
      </Section>
      <Section title="Execution logs">
        Each run stores per-node input, output and log entries so you can debug workflows. These
        payloads can contain data flowing through your automations — emails, customer records,
        message contents. Execution records are automatically purged after 30 days. You can delete
        any execution earlier from the Executions page.
      </Section>
      <Section title="Third parties">
        Outbound calls made by your workflow nodes go directly to the providers you configure. Those
        providers receive whatever your workflow sends them and act as independent controllers of
        that data. Our infrastructure providers process data on our behalf: a managed Postgres
        database and a global edge hosting network.
      </Section>
      <Section title="Cookies">
        We use a single first-party storage entry to keep you signed in. We do not use advertising
        or cross-site tracking cookies. If analytics are enabled in future, a consent notice will be
        shown before any non-essential storage is written.
      </Section>
      <Section title="Your rights">
        You can export, correct or delete your data at any time. Deleting your account removes your
        workflows, credentials, schedules and execution history. Requests:{" "}
        <span className="text-foreground">privacy@eweblb.com</span>.
      </Section>
    </LegalLayout>
  );
}
