import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import { ExternalLink, LegalList, LegalSection, Strong } from "./LegalLayout";

export function PrivacyEn() {
  return (
    <>
      <p>
        This policy explains what data the <Strong>DeezyBOT</Strong> Discord bot and the management panel at{" "}
        <Strong>{LEGAL.siteUrl.replace("https://", "")}</Strong> process, why, how long we keep it, and what rights you
        have. The Polish version is the binding one; this English version is a translation provided for convenience.
      </p>

      <LegalSection id="terms-used" title="Terms used">
        <LegalList>
          <li>
            <Strong>Controller</Strong> — the service provider named in section 1.
          </li>
          <li>
            <Strong>Bot</Strong> — the Discord application &ldquo;Deezy&rdquo; with ID {LEGAL.botApplicationId}.
          </li>
          <li>
            <Strong>Panel</Strong> — the website at {LEGAL.siteUrl} used to configure the Bot.
          </li>
          <li>
            <Strong>Discord</Strong> — the communication platform operated by Discord Inc., available at discord.com and in
            the Discord apps.
          </li>
          <li>
            <Strong>User</Strong> — anyone using the Bot or the Panel, including a member of a server where the Bot runs.
          </li>
          <li>
            <Strong>GDPR</Strong> — Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016
            (General Data Protection Regulation).
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="controller" title="1. Data controller">
        <p>
          The data controller is <Strong>{LEGAL.operatorName}</Strong> (place of residence: {LEGAL.city}), correspondence
          address: {LEGAL.postalAddress}.
        </p>
        <p>For anything related to personal data you can reach us:</p>
        <LegalList>
          <li>
            by e-mail: <a className="text-foreground underline underline-offset-2" href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>,
          </li>
          <li>
            on the DeezyBOT support server on Discord: <ExternalLink href={LEGAL.supportServerUrl} />.
          </li>
        </LegalList>
        <p>
          Discord is a separate controller of your Discord account data. How Discord processes data is described in the{" "}
          <ExternalLink href="https://discord.com/privacy">Discord Privacy Policy</ExternalLink>.
        </p>
      </LegalSection>

      <LegalSection id="data" title="2. What data we process">
        <h3 className="font-semibold text-foreground">2.1. Management panel</h3>
        <p>You sign in to the panel with your Discord account. We then process:</p>
        <LegalList>
          <li>your Discord account ID, name and avatar. We do not ask Discord for your e-mail address;</li>
          <li>
            the list of servers you are in, together with your permissions there, to show which servers you can manage and
            to check this on every change;
          </li>
          <li>a Discord API access token, stored in an encrypted session cookie;</li>
          <li>
            a log of panel changes: who changed which module's settings and when. It is visible to that server's staff;
          </li>
          <li>your IP address, for abuse protection (request rate limits) and in the web server's technical logs.</li>
        </LegalList>

        <h3 className="pt-2 font-semibold text-foreground">2.2. The bot on Discord servers</h3>
        <p>
          When a server's staff add the bot and enable its modules, we process the data of that server's members that those
          modules need:
        </p>
        <LegalList>
          <li>Discord account ID, name and avatar;</li>
          <li>
            activity: experience points and levels, message count and time spent in voice channels (including monthly
            statistics and recaps), economy balance and transaction history;
          </li>
          <li>moderation: warnings with reasons, history of punishments, events detected by the anti-spam module;</li>
          <li>invites: who invited whom and with which invite code;</li>
          <li>your birthday, if you or the server's staff provide it;</li>
          <li>
            participation in server features: suggestions and votes, giveaway entries and wins, support tickets, temporary
            channels, temporary roles, game results (e.g. Wordle, Hangman);
          </li>
          <li>files (images, GIFs) uploaded by the server's staff in the Welcome module.</li>
        </LegalList>
        <p>
          <Strong>Message content.</Strong> The bot can see the content of messages in channels it has access to. It
          processes it on the fly: to count activity, to protect against spam and for moderation logs. We do not store
          message content in our database. It is kept only temporarily in the running bot's memory and disappears when the
          bot restarts.
        </p>
        <p>
          <Strong>Logs and transcripts on the server.</Strong> If a server's staff enable logs, the bot posts information
          about events to the chosen channel, for example the content of a deleted or edited message, members joining and
          leaving, or role changes. Likewise, when a ticket is closed the bot may post its transcript to a server channel.
          These are regular Discord messages in a channel managed by the server's staff, who decide when to delete them.
        </p>

        <h3 className="pt-2 font-semibold text-foreground">2.3. Technical server data</h3>
        <p>
          To run the Bot and the Panel we also process data about the servers themselves: the server name and icon, lists of
          channels, roles and emoji, and module settings entered by the server&apos;s staff. This is not personal data
          within the meaning of Art. 4(1) and Recital 26 GDPR, so we do not describe it in detail. If the settings contain
          the ID of a specific person (for example a user excluded from a module), we treat it as personal data. Technical
          server data is deleted together with the rest of the server&apos;s data (section 4).
        </p>

        <h3 className="pt-2 font-semibold text-foreground">2.4. Contacting us</h3>
        <p>
          When you write to us by e-mail or on the support server, we process the content of your message and the details
          you contact us from (e-mail address or Discord account).
        </p>
      </LegalSection>

      <LegalSection id="purposes" title="3. Purposes and legal bases">
        <LegalList>
          <li>
            <Strong>Providing the bot and the panel</Strong> under the{" "}
            <Link className="text-foreground underline underline-offset-2" href="/terms?lang=en">Terms of Service</Link> —
            Art. 6(1)(b) GDPR for people who use the panel and the bot's commands, and Art. 6(1)(f) GDPR for other server
            members. Our legitimate interest is providing the features that the server's staff enabled for their community.
          </li>
          <li>
            <Strong>Security and abuse prevention</Strong>, including rate limits and technical logs — Art. 6(1)(f) GDPR.
          </li>
          <li>
            <Strong>Replying to messages and requests</Strong> — Art. 6(1)(f) GDPR.
          </li>
          <li>
            <Strong>Establishing, exercising or defending legal claims</Strong> — Art. 6(1)(f) GDPR.
          </li>
        </LegalList>
        <p>We do not sell data and do not use it for advertising or marketing profiling.</p>
        <p>
          The anti-spam module may automatically apply a penalty on a server (for example a timeout) according to rules set
          by that server's staff. We do not make automated decisions that produce legal effects for you.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="4. How long we keep data">
        <LegalList>
          <li>
            <Strong>Server data</Strong> (activity, statistics, moderation, configuration, change log, uploaded files) is
            kept while the bot is on the server. <Strong>{LEGAL.guildDataRetentionDays} days after the bot is removed</Strong>,
            all of that server's data is deleted automatically. If the bot is added back earlier, the data stays.
          </li>
          <li>
            Warnings expire after the period set by the server's staff (by default {LEGAL.defaultWarnExpiryDays} days).
          </li>
          <li>
            Detailed activity history used for statistics is deleted after {LEGAL.activityBucketDays} days, and the history of
            Twitch stream notifications after {LEGAL.streamLogDays} days.
          </li>
          <li>
            Leaving a server does not automatically delete your data on that server. We will delete it on request (section
            7).
          </li>
          <li>
            A panel session lasts until you sign out or it expires. Server and user data fetched from Discord is cached for
            a few minutes up to 24 hours.
          </li>
          <li>
            Your IP address is kept for a few minutes in the rate limiter and for up to 14 days in the web server logs.
            Application logs (events and errors, including server and user IDs) have a limited size and the oldest entries
            are overwritten automatically.
          </li>
          <li>
            Correspondence is kept for up to {LEGAL.correspondenceRetentionYears} years after the matter is closed, unless you
            ask us to delete it earlier.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="recipients" title="5. Who we share data with">
        <p>Infrastructure providers process data on our behalf:</p>
        <LegalList>
          <li>
            <Strong>OVH sp. z o.o.</Strong> — the server running the bot and the panel (Poland), and e-mail hosting;
          </li>
          <li>
            <Strong>MongoDB, Inc.</Strong> — the database (MongoDB Atlas) in an Amazon Web Services data centre in Frankfurt
            (Germany).
          </li>
        </LegalList>
        <p>In addition:</p>
        <LegalList>
          <li>
            <Strong>Discord Inc.</Strong> — the bot and the panel work through the Discord API. Discord processes data as a
            separate controller.
          </li>
          <li>
            <Strong>Twitch</Strong> — streamer channel names set by a server's staff in the notifications module.
          </li>
          <li>
            <Strong>External services for selected commands</Strong> — for example weather (a town name), FACEIT statistics
            (a player nickname), or random pictures and facts. We only send the query itself, never your Discord ID.
          </li>
        </LegalList>
        <p>
          Some of these entities are based in the United States. Transfers outside the European Economic Area rely on the
          safeguards set out in Chapter V GDPR, in particular the European Commission&apos;s adequacy decision (EU-US Data
          Privacy Framework) or standard contractual clauses.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="6. Cookies and browser storage">
        <p>The panel only uses what it needs to work:</p>
        <LegalList>
          <li>cookies for the sign-in session, protection against CSRF attacks and the return address after signing in;</li>
          <li>
            browser storage (localStorage) for interface settings, such as collapsed menu sections, and cached data that
            speeds up loading.
          </li>
        </LegalList>
        <p>
          Storing information that is strictly necessary to provide the service you request does not require consent
          (Art. 5(3) of Directive 2002/58/EC and the Polish Electronic Communications Law implementing it). We do not use
          analytics, advertising or tracking tools, which is why the panel does not ask for cookie consent. You can delete
          cookies in your browser settings, but you will be signed out.
        </p>
      </LegalSection>

      <LegalSection id="rights" title="7. Your rights">
        <p>You have the right to:</p>
        <LegalList>
          <li>access your data and receive a copy of it (Art. 15 GDPR);</li>
          <li>rectification (Art. 16 GDPR);</li>
          <li>erasure (Art. 17 GDPR);</li>
          <li>restriction of processing (Art. 18 GDPR);</li>
          <li>data portability (Art. 20 GDPR);</li>
          <li>object to processing based on legitimate interest (Art. 21 GDPR);</li>
          <li>
            lodge a complaint with the Polish supervisory authority, the President of the Personal Data Protection Office
            (UODO, ul. Stawki 2, 00-193 Warsaw), or the authority in your country of residence.
          </li>
        </LegalList>
        <p>
          We do not process data on the basis of consent, so there is no consent to withdraw. To exercise these rights,
          write to {LEGAL.email} or on the support server. We need to confirm that the request comes from the data subject,
          so we may ask you to confirm it from your Discord account or to give the ID of the server the request concerns
          (Art. 11 and Art. 12(6) GDPR). We reply without undue delay and within one month at the latest.
        </p>
        <p>
          A server&apos;s staff can also have all of their server&apos;s data deleted by removing the bot from it (section
          4).
        </p>
      </LegalSection>

      <LegalSection id="security" title="8. Security">
        <p>
          Connections to the panel are encrypted (HTTPS). Every change to a server&apos;s settings requires signing in and a
          check that you have permission to manage that server. Only the people running the service have access to the
          database and the server.
        </p>
      </LegalSection>

      <LegalSection id="age" title="9. Age">
        <p>
          The bot and the panel may be used by people who meet Discord&apos;s age requirements. Discord sets the minimum age for
          using the platform, which in some countries is higher than 13.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="10. Changes to this policy">
        <p>
          This policy may change, for example when we add new features. The current version is always available at{" "}
          {LEGAL.siteUrl}/privacy, with its version number and effective date. We announce significant changes on the
          support server.
        </p>
      </LegalSection>
    </>
  );
}
