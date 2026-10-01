import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import { ExternalLink, LegalList, LegalSection, Strong } from "./LegalLayout";

export function TermsEn() {
  return (
    <>
      <p>The Polish version of these Terms is the binding one; this English version is a translation provided for convenience.</p>

      <LegalSection id="general" title="§1. General">
        <p>
          These Terms set out the rules for using the <Strong>DeezyBOT</Strong> Discord bot and the management panel at{" "}
          {LEGAL.siteUrl}. They are terms of service within the meaning of Article 8 of the Polish Act of 18 July 2002 on
          Providing Services by Electronic Means.
        </p>
        <p>
          The service provider is <Strong>{LEGAL.operatorName}</Strong> (place of residence: {LEGAL.city}), correspondence
          address: {LEGAL.postalAddress}, e-mail: {LEGAL.email}.
        </p>
        <p>The Services are provided free of charge.</p>
        <p>
          These Terms are available free of charge at {LEGAL.siteUrl}/terms in a form that allows them to be downloaded,
          saved and printed.
        </p>
      </LegalSection>

      <LegalSection id="definitions" title="§2. Definitions">
        <LegalList>
          <li>
            <Strong>Bot</Strong> — the DeezyBOT application running on Discord servers.
          </li>
          <li>
            <Strong>Panel</Strong> — the website at {LEGAL.siteUrl} used to configure the Bot.
          </li>
          <li>
            <Strong>Services</Strong> — the features of the Bot and the Panel provided under these Terms.
          </li>
          <li>
            <Strong>User</Strong> — anyone using the Services, including a member of a server where the Bot runs.
          </li>
          <li>
            <Strong>Server Admin</Strong> — a User with permission to manage a Discord server who adds the Bot to the server
            and configures it in the Panel.
          </li>
          <li>
            <Strong>Discord</Strong> — the communication platform operated by Discord Inc.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="services" title="§3. Types and scope of the Services">
        <p>The Services include:</p>
        <LegalList>
          <li>
            the Bot, which offers on a Discord server among other things moderation, event logs, spam protection, levels and
            activity statistics, welcome messages, reaction roles, support tickets, giveaways, stream notifications and games;
          </li>
          <li>the Panel, where a Server Admin configures the Bot for their server.</li>
        </LegalList>
        <p>The range of available features may change as the Services evolve.</p>
      </LegalSection>

      <LegalSection id="requirements" title="§4. Technical requirements">
        <LegalList>
          <li>a Discord account and Internet access;</li>
          <li>to use the Panel: an up-to-date web browser with JavaScript and cookies enabled;</li>
          <li>
            to configure a server in the Panel: permission to manage that server in Discord (Manage Server or Administrator).
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="agreement" title="§5. Entering into and terminating the agreement">
        <p>
          The agreement for the Services is concluded when the Bot is added to a server, when one of its commands is used,
          or when you sign in to the Panel.
        </p>
        <p>
          You can stop using the Services at any time: sign out of the Panel, and a Server Admin can remove the Bot from
          the server. Removing the Bot terminates the agreement for that server. What happens to the data is described in
          the <Link className="text-foreground underline underline-offset-2" href="/privacy?lang=en">Privacy Policy</Link>.
        </p>
        <p>
          The service provider may block a User or a server from the Services if these Terms are breached. It may also stop
          providing the Services by announcing this at least 14 days in advance on the support server and in the Panel.
        </p>
      </LegalSection>

      <LegalSection id="rules" title="§6. Rules of use">
        <p>You must not:</p>
        <LegalList>
          <li>provide unlawful content through the Services;</li>
          <li>use the Bot for spam, harassment, impersonation or to circumvent Discord&apos;s rules;</li>
          <li>
            attempt to gain unauthorised access to the Panel, other servers or data, circumvent security measures or limits,
            or deliberately overload the Services;
          </li>
          <li>automatically scrape data from the Panel without our permission.</li>
        </LegalList>
        <p>
          When using the Services you must follow the{" "}
          <ExternalLink href="https://discord.com/terms">Discord Terms of Service</ExternalLink> and the{" "}
          <ExternalLink href="https://discord.com/guidelines">Discord Community Guidelines</ExternalLink>.
        </p>
        <p>
          A Server Admin is responsible for the Bot&apos;s configuration on their server and for content the Bot publishes on
          their instruction, such as welcome messages, embeds and messages sent with commands.
        </p>
      </LegalSection>

      <LegalSection id="availability" title="§7. Availability">
        <p>
          We do our best to keep the Services running reliably, but we do not guarantee uninterrupted availability.
          Interruptions may occur due to updates, maintenance, or outages of Discord or infrastructure providers.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="§8. Liability">
        <p>
          The service provider is not liable for how the Discord platform operates or for content published by Users and
          Server Admins. Otherwise, liability is governed by general rules.
        </p>
        <p>
          Nothing in these Terms excludes or limits liability towards consumers where mandatory law does not allow it.
        </p>
      </LegalSection>

      <LegalSection id="complaints" title="§9. Complaints">
        <p>
          Complaints about the Services can be sent by e-mail to {LEGAL.email} or raised on the{" "}
          <ExternalLink href={LEGAL.supportServerUrl}>support server</ExternalLink>. Please describe the problem and include
          details that let us contact you and identify the case, such as the server ID.
        </p>
        <p>We respond within 14 days of receiving the complaint, in the same form in which it was submitted.</p>
      </LegalSection>

      <LegalSection id="data" title="§10. Personal data">
        <p>
          How we process personal data is described in the{" "}
          <Link className="text-foreground underline underline-offset-2" href="/privacy?lang=en">Privacy Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="§11. Changes to the Terms">
        <p>
          These Terms may be changed for important reasons, in particular a change in the law or in the scope of the
          Services. We announce changes on the support server and in the Panel at least 7 days before they take effect. If
          you do not accept the changes, you can terminate the agreement as described in §5.
        </p>
      </LegalSection>

      <LegalSection id="final" title="§12. Final provisions">
        <p>
          These Terms are governed by Polish law. This choice of law does not deprive a consumer of the protection afforded
          by the mandatory provisions of the law of their country of habitual residence.
        </p>
        <p>
          Disputes are resolved by the court with jurisdiction under general rules. Consumers may also use out-of-court
          dispute resolution, for example consumer ombudsmen in their country.
        </p>
        <p>These Terms are effective from {LEGAL.effectiveDate}.</p>
      </LegalSection>
    </>
  );
}
