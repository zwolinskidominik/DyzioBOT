import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import { ExternalLink, LegalList, LegalSection, Strong } from "./LegalLayout";

const linkClass = "text-foreground underline underline-offset-2";

export function TermsEn() {
  return (
    <>
      <p>The Polish version of these Terms is the binding one; this English version is a translation provided for convenience.</p>

      <LegalSection id="general" title="§1. General">
        <p>
          These Terms set out the rules for using the <Strong>DeezyBOT</Strong> Discord bot and the management panel at{" "}
          {LEGAL.siteUrl}, the conditions for entering into and terminating agreements, and the complaints procedure. They are
          terms of service within the meaning of Article 8 of the Polish Act of 18 July 2002 on Providing Services by
          Electronic Means.
        </p>
        <p>
          The service provider is <Strong>{LEGAL.operatorName}</Strong> (place of residence: {LEGAL.city}), correspondence
          address: {LEGAL.postalAddress}.
        </p>
        <p>
          Contact for any matter, including complaints and technical support: e-mail{" "}
          <a className={linkClass} href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> or the{" "}
          <ExternalLink href={LEGAL.supportServerUrl}>support server on Discord</ExternalLink>.
        </p>
        <p>
          The Services are provided free of charge. These Terms are available free of charge at {LEGAL.siteUrl}/terms in a
          form that allows them to be downloaded, saved and printed.
        </p>
      </LegalSection>

      <LegalSection id="definitions" title="§2. Definitions">
        <LegalList>
          <li>
            <Strong>Bot</Strong> — the Discord application &ldquo;Deezy&rdquo; with ID {LEGAL.botApplicationId}.
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
            <Strong>Configuration Data</Strong> — settings, rules and content entered in the Panel or with the Bot&apos;s
            commands for a given server, including uploaded files (e.g. images in the Welcome module).
          </li>
          <li>
            <Strong>Discord</Strong> — the communication platform operated by Discord Inc.
          </li>
          <li>
            <Strong>Consumer</Strong> — a person within the meaning of Article 22¹ of the Polish Civil Code. Consumer
            provisions also apply to a sole trader where the agreement is not of a professional nature for them (Article
            385⁵ of the Polish Civil Code).
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
        <p>
          The Bot and the Panel are updated centrally by the service provider, including security updates. Updates apply to
          all Users automatically and require no action on their part.
        </p>
        <p>
          The Services keep evolving: features may be added, changed or retired. We do our best to keep the Services stable
          and to fix problems as quickly as possible. This describes our standard of care, not a guarantee of error-free
          operation.
        </p>
      </LegalSection>

      <LegalSection id="requirements" title="§4. Technical requirements">
        <LegalList>
          <li>A Discord account and the Discord app or its browser version;</li>
          <li>
            To use the Panel: An up-to-date version of a common browser (Google Chrome, Mozilla Firefox, Apple Safari or
            Microsoft Edge) with JavaScript and cookies enabled;
          </li>
          <li>
            To configure a server in the Panel: Permission to manage that server in Discord (Manage Server or Administrator).
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="agreement" title="§5. Entering into and terminating the agreement">
        <p>
          The agreement for the Services is free of charge and concluded for an indefinite period when the Bot is added to a
          server, when one of its commands is used, or when you sign in to the Panel.
        </p>
        <p>
          You can stop using the Services at any time without giving a reason: sign out of the Panel, and a Server Admin can
          remove the Bot from the server. Removing the Bot terminates the agreement for that server. What happens to the data
          is described in the <Link className={linkClass} href="/privacy?lang=en">Privacy Policy</Link>.
        </p>
        <p>
          The service provider may block a User or a server from the Services if these Terms are breached. It may also stop
          providing the Services by announcing this at least 14 days in advance on the support server and in the Panel.
        </p>
      </LegalSection>

      <LegalSection id="rules" title="§6. Rules of use">
        <p>
          The Services must be used for their intended purpose and in line with the law, these Terms, the{" "}
          <ExternalLink href="https://discord.com/terms">Discord Terms of Service</ExternalLink> and the{" "}
          <ExternalLink href="https://discord.com/guidelines">Discord Community Guidelines</ExternalLink>.
        </p>
        <p>You must not:</p>
        <LegalList>
          <li>provide unlawful content through the Services;</li>
          <li>use the Bot for spam, harassment, impersonation or to circumvent Discord&apos;s rules;</li>
          <li>
            attempt to gain unauthorised access to the Panel, other servers or data, circumvent security measures or limits,
            or deliberately overload the Services (e.g. mass requests, DoS attacks);
          </li>
          <li>exploit bugs or vulnerabilities in any way other than reporting them to the service provider;</li>
          <li>decompile or reconstruct the code of the Bot or the Panel, or automatically scrape data from the Panel.</li>
        </LegalList>
        <p>
          If you find a security vulnerability, report it to {LEGAL.email} and do not disclose it publicly until we have fixed
          it. Security testing (e.g. vulnerability scanning, penetration or load testing) requires the service provider&apos;s
          prior consent by e-mail, stating the scope, timing and the IP addresses the tests will come from.
        </p>
        <p>
          A Server Admin is responsible for the Bot&apos;s configuration on their server and for content the Bot publishes on
          their instruction, such as welcome messages, embeds and messages sent with commands.
        </p>
      </LegalSection>

      <LegalSection id="content" title="§7. Intellectual property and Configuration Data">
        <p>
          All rights to the Bot and the Panel, including their code, design and name, belong to the service provider. Using
          the Services does not transfer any of these rights to the User.
        </p>
        <p>
          Configuration Data belongs to the User. To the extent it constitutes a copyrighted work, the User grants the
          service provider a free, non-exclusive licence to store it, copy it within IT systems and have the Bot publish it on
          the server — solely to provide the Services and for as long as they are provided.
        </p>
        <p>
          By uploading images or other files, the User declares that they hold the rights to them and that their use does
          not infringe anyone else&apos;s rights. The User who uploaded the file is responsible for any such infringement.
        </p>
        <p>
          The service provider has technical access to Configuration Data to the extent needed to maintain the Services, fix
          problems and prevent abuse. It does not share it with anyone other than infrastructure providers and authorities
          entitled to it by law.
        </p>
        <p>
          After the Bot is removed from a server, its Configuration Data is permanently deleted within the period stated in
          the Privacy Policy. If you want to keep your settings or content, save them beforehand.
        </p>
      </LegalSection>

      <LegalSection id="availability" title="§8. Availability">
        <p>
          We do our best to keep the Services running without interruption, but we do not guarantee any particular level of
          availability. Interruptions may occur due to updates and maintenance.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="§9. Liability">
        <p>The service provider is not liable for:</p>
        <LegalList>
          <li>interruptions, delays and errors caused by outages, limits (e.g. rate limits) or changes on Discord&apos;s side;</li>
          <li>short interruptions needed for updates and maintenance;</li>
          <li>force majeure;</li>
          <li>data loss caused by the User;</li>
          <li>
            the Bot not working because of a Server Admin&apos;s decision, for example removing the Bot or taking away the
            permissions it needs.
          </li>
        </LegalList>
        <p>
          The service provider is not liable for content transmitted by Users through the Services, provided it did not
          initiate the transmission or modify the content. For content stored in the Services, it becomes liable once it
          receives credible information that the content is unlawful and fails to disable access to it (§11).
        </p>
        <p>Nothing in these Terms excludes or limits liability towards consumers where mandatory law does not allow it.</p>
      </LegalSection>

      <LegalSection id="complaints" title="§10. Complaints and bug reports">
        <p>
          Complaints and bug reports can be sent by e-mail to {LEGAL.email} or raised on the{" "}
          <ExternalLink href={LEGAL.supportServerUrl}>support server</ExternalLink>. It helps if you include:
        </p>
        <LegalList>
          <li>a description of the problem and the circumstances in which it occurred;</li>
          <li>the ID of the server it concerns;</li>
          <li>the error message or a screenshot (with other people&apos;s details blurred);</li>
          <li>details that let us contact you.</li>
        </LegalList>
        <p>
          The Bot runs entirely on Discord&apos;s infrastructure, and most sudden problems are temporary outages on its side
          that resolve on their own. If something stops working, check Discord&apos;s status at{" "}
          <ExternalLink href="https://discordstatus.com">discordstatus.com</ExternalLink>.
        </p>
        <p>We respond within 14 days of receiving a complaint, in the same form in which it was submitted.</p>
      </LegalSection>

      <LegalSection id="dsa" title="§11. Reporting illegal content">
        <p>
          {LEGAL.email} is the point of contact for Users and for the authorities of Member States, the European Commission
          and the European Board for Digital Services within the meaning of Articles 11 and 12 of Regulation (EU) 2022/2065
          (Digital Services Act). We communicate in Polish and English.
        </p>
        <p>
          Anyone can report content stored in the Services (e.g. a welcome message text or an uploaded image) that they
          consider illegal or contrary to these Terms. A report should include:
        </p>
        <LegalList>
          <li>an explanation of why the content is illegal or breaches these Terms;</li>
          <li>the exact location of the content (e.g. server ID and module, a screenshot, a link);</li>
          <li>
            the reporter&apos;s name and e-mail address, except for reports concerning child sexual abuse;
          </li>
          <li>a statement that the reporter believes in good faith that the information in the report is accurate and complete.</li>
        </LegalList>
        <p>
          Reports are reviewed by a person, without automated decision-making, without undue delay and objectively. If the
          content proves unlawful, we disable access to it or remove it and inform the person concerned of our decision and
          the reasons for it, where we are able to contact them.
        </p>
        <p>
          Content posted directly on Discord, outside the Services, should be reported to that server&apos;s staff or to{" "}
          <ExternalLink href="https://dis.gd/report">Discord</ExternalLink>.
        </p>
      </LegalSection>

      <LegalSection id="data" title="§12. Personal data">
        <p>
          How we process personal data is described in the{" "}
          <Link className={linkClass} href="/privacy?lang=en">Privacy Policy</Link>. You can use the Services under the
          pseudonym you use on Discord — we do not ask for your name or e-mail address.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="§13. Changes to the Terms">
        <p>
          These Terms may be changed for important legal, technical or organisational reasons, in particular a change in the
          law or in the scope of the Services. We announce changes on the support server and in the Panel at least 7 days
          before they take effect. If you do not accept the changes, you can terminate the agreement as described in §5.
        </p>
      </LegalSection>

      <LegalSection id="final" title="§14. Final provisions">
        <p>
          Matters not covered by these Terms are governed by Polish law, in particular the Civil Code and the Consumer Rights
          Act. This choice of law does not deprive a consumer of the protection afforded by the mandatory provisions of the
          law of their country of habitual residence.
        </p>
        <p>
          Disputes are resolved by the court with jurisdiction under general rules. Consumers may also use out-of-court
          dispute resolution, for example consumer ombudsmen in their country.
        </p>
        <p>The Polish version of these Terms is binding. The English version is a translation provided for convenience.</p>
        <p>These Terms are effective from {LEGAL.effectiveDate}.</p>
      </LegalSection>
    </>
  );
}
