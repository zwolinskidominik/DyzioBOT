import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import { ExternalLink, LegalList, LegalSection, Strong } from "./LegalLayout";

export function TermsPl() {
  return (
    <>
      <LegalSection id="ogolne" title="§1. Postanowienia ogólne">
        <p>
          Regulamin określa zasady korzystania z bota <Strong>DeezyBOT</Strong> na platformie Discord oraz z panelu
          zarządzania dostępnego pod adresem {LEGAL.siteUrl}. Jest regulaminem w rozumieniu art. 8 ustawy z dnia 18 lipca
          2002 r. o świadczeniu usług drogą elektroniczną.
        </p>
        <p>
          Usługodawcą jest <Strong>{LEGAL.operatorName}</Strong> (miejsce zamieszkania: {LEGAL.city}), adres do
          korespondencji: {LEGAL.postalAddress}, e-mail: {LEGAL.email}.
        </p>
        <p>Usługi są świadczone nieodpłatnie.</p>
        <p>
          Regulamin jest dostępny bezpłatnie pod adresem {LEGAL.siteUrl}/terms w formie, która umożliwia jego pobranie,
          zapisanie i wydrukowanie.
        </p>
      </LegalSection>

      <LegalSection id="definicje" title="§2. Definicje">
        <LegalList>
          <li>
            <Strong>Bot</Strong> — aplikacja DeezyBOT działająca na serwerach Discord.
          </li>
          <li>
            <Strong>Panel</Strong> — serwis internetowy pod adresem {LEGAL.siteUrl} służący do konfiguracji Bota.
          </li>
          <li>
            <Strong>Usługi</Strong> — funkcje Bota i Panelu udostępniane na podstawie Regulaminu.
          </li>
          <li>
            <Strong>Użytkownik</Strong> — osoba korzystająca z Usług, w tym członek serwera, na którym działa Bot.
          </li>
          <li>
            <Strong>Administrator serwera</Strong> — Użytkownik z uprawnieniem do zarządzania serwerem Discord, który dodaje
            Bota do serwera i konfiguruje go w Panelu.
          </li>
          <li>
            <Strong>Discord</Strong> — platforma komunikacyjna prowadzona przez Discord Inc.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="uslugi" title="§3. Rodzaje i zakres Usług">
        <p>W ramach Usług udostępniamy:</p>
        <LegalList>
          <li>
            Bota, który na serwerze Discord oferuje między innymi moderację, logi zdarzeń, ochronę przed spamem, system
            poziomów i statystyki aktywności, powitania, role za reakcje, zgłoszenia (tickety), giveawaye, powiadomienia o
            transmisjach i gry;
          </li>
          <li>Panel, w którym Administrator serwera konfiguruje Bota dla swojego serwera.</li>
        </LegalList>
        <p>Zakres dostępnych funkcji może się zmieniać wraz z rozwojem Usług.</p>
      </LegalSection>

      <LegalSection id="wymagania" title="§4. Wymagania techniczne">
        <LegalList>
          <li>konto Discord i dostęp do Internetu;</li>
          <li>
            do korzystania z Panelu: aktualna przeglądarka internetowa z włączoną obsługą JavaScript i plików cookies;
          </li>
          <li>
            do konfiguracji serwera w Panelu: uprawnienie do zarządzania tym serwerem w Discordzie (Zarządzanie serwerem lub
            Administrator).
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="umowa" title="§5. Zawarcie i rozwiązanie umowy">
        <p>
          Umowa o świadczenie Usług zostaje zawarta z chwilą dodania Bota do serwera, użycia jego komendy albo zalogowania
          się do Panelu.
        </p>
        <p>
          Użytkownik może w każdej chwili przestać korzystać z Usług: wylogować się z Panelu, a Administrator serwera usunąć
          Bota z serwera. Usunięcie Bota rozwiązuje umowę w zakresie tego serwera. Skutki dla danych opisuje{" "}
          <Link className="text-foreground underline underline-offset-2" href="/privacy">polityka prywatności</Link>.
        </p>
        <p>
          Usługodawca może zablokować Użytkownikowi lub serwerowi dostęp do Usług w razie naruszenia Regulaminu. Może też
          zakończyć świadczenie Usług, ogłaszając to co najmniej 14 dni wcześniej na serwerze wsparcia i w Panelu.
        </p>
      </LegalSection>

      <LegalSection id="zasady" title="§6. Zasady korzystania">
        <p>Zabronione jest:</p>
        <LegalList>
          <li>dostarczanie za pośrednictwem Usług treści o charakterze bezprawnym;</li>
          <li>
            wykorzystywanie Bota do spamu, nękania innych osób, podszywania się pod inne osoby lub obchodzenia zasad Discorda;
          </li>
          <li>
            próby uzyskania nieuprawnionego dostępu do Panelu, cudzych serwerów lub danych, obchodzenia zabezpieczeń i limitów,
            a także celowe przeciążanie Usług;
          </li>
          <li>automatyczne pobieranie danych z Panelu (scraping) bez naszej zgody.</li>
        </LegalList>
        <p>
          Korzystając z Usług, należy przestrzegać{" "}
          <ExternalLink href="https://discord.com/terms">Warunków korzystania z usług Discorda</ExternalLink> i{" "}
          <ExternalLink href="https://discord.com/guidelines">Wytycznych społeczności Discorda</ExternalLink>.
        </p>
        <p>
          Administrator serwera odpowiada za konfigurację Bota na swoim serwerze i za treści, które Bot publikuje na jego
          polecenie, na przykład wiadomości powitalne, embedy i wiadomości wysyłane komendami.
        </p>
      </LegalSection>

      <LegalSection id="dostepnosc" title="§7. Dostępność Usług">
        <p>
          Dokładamy starań, aby Usługi działały stabilnie, ale nie gwarantujemy ich nieprzerwanej dostępności. Możliwe są
          przerwy związane z aktualizacjami, pracami technicznymi albo awariami Discorda lub dostawców infrastruktury.
        </p>
      </LegalSection>

      <LegalSection id="odpowiedzialnosc" title="§8. Odpowiedzialność">
        <p>
          Usługodawca nie odpowiada za działanie platformy Discord ani za treści publikowane przez Użytkowników i
          Administratorów serwerów. W pozostałym zakresie odpowiada na zasadach ogólnych.
        </p>
        <p>
          Postanowienia Regulaminu nie wyłączają ani nie ograniczają odpowiedzialności wobec konsumentów w zakresie, w jakim
          zabraniają tego bezwzględnie obowiązujące przepisy prawa.
        </p>
      </LegalSection>

      <LegalSection id="reklamacje" title="§9. Reklamacje">
        <p>
          Reklamacje dotyczące Usług można składać e-mailem na {LEGAL.email} lub na{" "}
          <ExternalLink href={LEGAL.supportServerUrl}>serwerze wsparcia</ExternalLink>. Reklamacja powinna zawierać opis
          problemu oraz dane pozwalające nam się z Tobą skontaktować i zidentyfikować sprawę, na przykład ID serwera.
        </p>
        <p>Odpowiadamy na reklamację w ciągu 14 dni od jej otrzymania, w tej samej formie, w jakiej została złożona.</p>
      </LegalSection>

      <LegalSection id="dane" title="§10. Dane osobowe">
        <p>
          Zasady przetwarzania danych osobowych opisuje{" "}
          <Link className="text-foreground underline underline-offset-2" href="/privacy">polityka prywatności</Link>.
        </p>
      </LegalSection>

      <LegalSection id="zmiany" title="§11. Zmiany Regulaminu">
        <p>
          Regulamin może zostać zmieniony z ważnych przyczyn, w szczególności przy zmianie przepisów lub zakresu Usług. O
          zmianach informujemy na serwerze wsparcia i w Panelu co najmniej 7 dni przed ich wejściem w życie. Jeśli nie
          akceptujesz zmian, możesz rozwiązać umowę w sposób opisany w §5.
        </p>
      </LegalSection>

      <LegalSection id="koncowe" title="§12. Postanowienia końcowe">
        <p>
          Regulamin podlega prawu polskiemu. Wybór prawa nie pozbawia konsumenta ochrony, jaką zapewniają mu bezwzględnie
          obowiązujące przepisy państwa jego zwykłego pobytu.
        </p>
        <p>
          Spory rozstrzyga sąd właściwy według przepisów ogólnych. Konsument może skorzystać także z pozasądowych sposobów
          rozwiązywania sporów, na przykład z pomocy miejskiego lub powiatowego rzecznika konsumentów.
        </p>
        <p>Regulamin obowiązuje od {LEGAL.effectiveDate}.</p>
      </LegalSection>
    </>
  );
}
