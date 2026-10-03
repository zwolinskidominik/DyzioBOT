import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import { ExternalLink, LegalList, LegalSection, Strong } from "./LegalLayout";

const linkClass = "text-foreground underline underline-offset-2";

export function TermsPl() {
  return (
    <>
      <LegalSection id="ogolne" title="§1. Postanowienia ogólne">
        <p>
          Regulamin określa zasady korzystania z bota <Strong>DeezyBOT</Strong> na platformie Discord oraz z panelu
          zarządzania dostępnego pod adresem {LEGAL.siteUrl}, warunki zawierania i rozwiązywania umów oraz tryb
          postępowania reklamacyjnego. Jest regulaminem w rozumieniu art. 8 ustawy z dnia 18 lipca 2002 r. o świadczeniu
          usług drogą elektroniczną.
        </p>
        <p>
          Usługodawcą jest <Strong>{LEGAL.operatorName}</Strong> (miejsce zamieszkania: {LEGAL.city}), adres do
          korespondencji: {LEGAL.postalAddress}.
        </p>
        <p>
          Kontakt w każdej sprawie, w tym reklamacje i pomoc techniczna: e-mail{" "}
          <a className={linkClass} href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> lub{" "}
          <ExternalLink href={LEGAL.supportServerUrl}>serwer wsparcia na Discordzie</ExternalLink>.
        </p>
        <p>
          Usługi są świadczone nieodpłatnie. Regulamin jest dostępny bezpłatnie pod adresem {LEGAL.siteUrl}/terms w formie,
          która umożliwia jego pobranie, zapisanie i wydrukowanie.
        </p>
      </LegalSection>

      <LegalSection id="definicje" title="§2. Definicje">
        <LegalList>
          <li>
            <Strong>Bot</Strong> — aplikacja Discord „Deezy" o identyfikatorze {LEGAL.botApplicationId}.
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
            <Strong>Dane konfiguracyjne</Strong> — ustawienia, reguły i treści wprowadzone w Panelu lub za pomocą komend Bota dla
            danego serwera, w tym wgrane pliki (np. obrazy w module Powitania).
          </li>
          <li>
            <Strong>Discord</Strong> — platforma komunikacyjna prowadzona przez Discord Inc.
          </li>
          <li>
            <Strong>Konsument</Strong> — osoba w rozumieniu art. 22¹ Kodeksu cywilnego. Przepisy o konsumentach stosuje się
            też do przedsiębiorcy prowadzącego jednoosobową działalność, gdy umowa nie ma dla niego charakteru zawodowego
            (art. 385⁵ Kodeksu cywilnego).
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
        <p>
          Bot i Panel są aktualizowane centralnie przez Usługodawcę, także w zakresie bezpieczeństwa. Aktualizacje obejmują
          wszystkich Użytkowników automatycznie i nie wymagają od nich żadnych działań.
        </p>
        <p>
          Usługi są rozwijane: funkcje mogą być dodawane, zmieniane lub wycofywane. Dokładamy starań, aby Usługi działały
          stabilnie, a usterki były usuwane możliwie szybko. Określa to standard naszej staranności, a nie gwarancję
          bezbłędnego działania.
        </p>
      </LegalSection>

      <LegalSection id="wymagania" title="§4. Wymagania techniczne">
        <LegalList>
          <li>Konto Discord oraz aplikacja Discord lub jej wersja w przeglądarce;</li>
          <li>
            Do korzystania z Panelu: aktualna wersja popularnej przeglądarki (Google Chrome, Mozilla Firefox, Apple Safari
            lub Microsoft Edge) z włączoną obsługą JavaScript i plików cookies;
          </li>
          <li>
            Do konfiguracji serwera w Panelu: uprawnienie do zarządzania tym serwerem w Discordzie (Zarządzanie serwerem lub
            Administrator).
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="umowa" title="§5. Zawarcie i rozwiązanie umowy">
        <p>
          Umowa o świadczenie Usług jest nieodpłatna i zawierana na czas nieokreślony z chwilą dodania Bota do serwera,
          użycia jego komendy albo zalogowania się do Panelu.
        </p>
        <p>
          Użytkownik może w każdej chwili, bez podawania przyczyny, przestać korzystać z Usług: wylogować się z Panelu, a
          Administrator serwera usunąć Bota z serwera. Usunięcie Bota rozwiązuje umowę w zakresie tego serwera. Skutki dla
          danych opisuje <Link className={linkClass} href="/privacy">polityka prywatności</Link>.
        </p>
        <p>
          Usługodawca może zablokować Użytkownikowi lub serwerowi dostęp do Usług w razie naruszenia Regulaminu. Może też
          zakończyć świadczenie Usług, ogłaszając to co najmniej 14 dni wcześniej na serwerze wsparcia i w Panelu.
        </p>
      </LegalSection>

      <LegalSection id="zasady" title="§6. Zasady korzystania">
        <p>
          Z Usług należy korzystać zgodnie z ich przeznaczeniem, przepisami prawa, Regulaminem oraz{" "}
          <ExternalLink href="https://discord.com/terms">Warunkami korzystania z usług Discorda</ExternalLink> i{" "}
          <ExternalLink href="https://discord.com/guidelines">Wytycznymi społeczności Discorda</ExternalLink>.
        </p>
        <p>Zabronione jest:</p>
        <LegalList>
          <li>dostarczanie za pośrednictwem Usług treści o charakterze bezprawnym;</li>
          <li>
            wykorzystywanie Bota do spamu, nękania innych osób, podszywania się pod inne osoby lub obchodzenia zasad Discorda;
          </li>
          <li>
            próby uzyskania nieuprawnionego dostępu do Panelu, cudzych serwerów lub danych, obchodzenia zabezpieczeń i limitów,
            a także celowe przeciążanie Usług (np. masowe zapytania, ataki DoS);
          </li>
          <li>wykorzystywanie znalezionych błędów i luk w inny sposób niż ich zgłoszenie Usługodawcy;</li>
          <li>dekompilacja i odtwarzanie kodu Bota lub Panelu oraz automatyczne pobieranie danych z Panelu (scraping).</li>
        </LegalList>
        <p>
          Jeśli znajdziesz lukę w zabezpieczeniach, zgłoś ją na {LEGAL.email} i nie ujawniaj jej publicznie, dopóki jej nie
          naprawimy. Testy bezpieczeństwa (np. skanowanie podatności, testy penetracyjne, testy obciążeniowe) wymagają
          wcześniejszej zgody Usługodawcy wyrażonej e-mailem, z podaniem zakresu, terminu i adresów IP, z których będą
          prowadzone.
        </p>
        <p>
          Administrator serwera odpowiada za konfigurację Bota na swoim serwerze i za treści, które Bot publikuje na jego
          polecenie, na przykład wiadomości powitalne, embedy i wiadomości wysyłane komendami.
        </p>
      </LegalSection>

      <LegalSection id="tresci" title="§7. Prawa autorskie i Dane konfiguracyjne">
        <p>
          Prawa do Bota i Panelu, w tym do ich kodu, wyglądu i nazwy, przysługują Usługodawcy. Korzystanie z Usług nie
          przenosi na Użytkownika żadnych z tych praw.
        </p>
        <p>
          Dane konfiguracyjne należą do Użytkownika. W zakresie, w jakim stanowią utwór, Użytkownik udziela Usługodawcy
          nieodpłatnej, niewyłącznej licencji na ich przechowywanie, kopiowanie w systemach informatycznych i publikowanie
          przez Bota na serwerze — wyłącznie w celu świadczenia Usług i na czas ich świadczenia.
        </p>
        <p>
          Wgrywając obrazy lub inne pliki, Użytkownik oświadcza, że ma do nich prawa i że ich użycie nie narusza praw osób
          trzecich. Odpowiedzialność za takie naruszenia ponosi Użytkownik, który plik wgrał.
        </p>
        <p>
          Usługodawca ma techniczny dostęp do Danych konfiguracyjnych w zakresie potrzebnym do utrzymania Usług, usuwania
          usterek i przeciwdziałania nadużyciom. Nie udostępnia ich innym podmiotom poza dostawcami infrastruktury oraz
          organami uprawnionymi na podstawie przepisów prawa.
        </p>
        <p>
          Po usunięciu Bota z serwera Dane konfiguracyjne są trwale usuwane w terminie wskazanym w polityce prywatności.
          Jeśli chcesz zachować swoje ustawienia lub treści, zapisz je wcześniej.
        </p>
      </LegalSection>

      <LegalSection id="dostepnosc" title="§8. Dostępność Usług">
        <p>
          Dokładamy starań, aby Usługi działały nieprzerwanie, ale nie gwarantujemy określonego poziomu dostępności. Możliwe są
          przerwy związane z aktualizacjami i pracami technicznymi.
        </p>
      </LegalSection>

      <LegalSection id="odpowiedzialnosc" title="§9. Odpowiedzialność">
        <p>Usługodawca nie odpowiada za:</p>
        <LegalList>
          <li>
            przerwy, opóźnienia i błędy wynikające z awarii, ograniczeń (np. limitów zapytań) lub zmian po stronie Discorda;
          </li>
          <li>krótkie przerwy potrzebne do aktualizacji i prac technicznych;</li>
          <li>skutki siły wyższej;</li>
          <li>utratę danych z winy Użytkownika;</li>
          <li>
            niedziałanie Bota wynikające z decyzji Administratora serwera, na przykład usunięcia Bota lub odebrania mu
            potrzebnych uprawnień.
          </li>
        </LegalList>
        <p>
          Usługodawca nie odpowiada za treści przesyłane przez Użytkowników za pośrednictwem Usług, o ile nie zainicjował ich
          przekazu ani ich nie modyfikował. Za treści przechowywane w Usługach odpowiada od chwili, gdy otrzyma wiarygodną
          informację o ich bezprawnym charakterze i nie zablokuje do nich dostępu (§11).
        </p>
        <p>
          Postanowienia Regulaminu nie wyłączają ani nie ograniczają odpowiedzialności wobec konsumentów w zakresie, w jakim
          zabraniają tego bezwzględnie obowiązujące przepisy prawa.
        </p>
      </LegalSection>

      <LegalSection id="reklamacje" title="§10. Reklamacje i zgłaszanie błędów">
        <p>
          Reklamacje i zgłoszenia błędów można składać e-mailem na {LEGAL.email} lub na{" "}
          <ExternalLink href={LEGAL.supportServerUrl}>serwerze wsparcia</ExternalLink>. Pomoże nam, jeśli podasz:
        </p>
        <LegalList>
          <li>opis problemu i okoliczności, w jakich wystąpił;</li>
          <li>identyfikator serwera, którego dotyczy;</li>
          <li>treść komunikatu o błędzie lub zrzut ekranu (z zamazanymi danymi innych osób);</li>
          <li>dane pozwalające nam się z Tobą skontaktować.</li>
        </LegalList>
        <p>
          Bot w całości działa przez infrastrukturę Discorda, a większość nagłych problemów to przejściowe awarie po jego
          stronie, które mijają same. Jeśli coś przestało działać, sprawdź status Discorda na{" "}
          <ExternalLink href="https://discordstatus.com">discordstatus.com</ExternalLink>.
        </p>
        <p>Odpowiadamy na reklamację w ciągu 14 dni od jej otrzymania, w tej samej formie, w jakiej została złożona.</p>
      </LegalSection>

      <LegalSection id="dsa" title="§11. Zgłaszanie nielegalnych treści">
        <p>
          Adres {LEGAL.email} jest punktem kontaktowym dla Użytkowników oraz organów państw członkowskich, Komisji
          Europejskiej i Europejskiej Rady ds. Usług Cyfrowych w rozumieniu art. 11 i 12 rozporządzenia (UE) 2022/2065 (akt o
          usługach cyfrowych). Kontaktujemy się po polsku i angielsku.
        </p>
        <p>
          Każdy może zgłosić treść przechowywaną w Usługach (np. treść wiadomości powitalnej albo wgrany obraz), którą uważa
          za nielegalną lub sprzeczną z Regulaminem. Zgłoszenie powinno zawierać:
        </p>
        <LegalList>
          <li>wyjaśnienie, dlaczego treść jest nielegalna lub narusza Regulamin;</li>
          <li>dokładne wskazanie treści (np. identyfikator serwera i moduł, zrzut ekranu, link);</li>
          <li>
            imię i nazwisko (lub nazwę) oraz adres e-mail zgłaszającego, z wyjątkiem zgłoszeń dotyczących wykorzystywania
            seksualnego dzieci;
          </li>
          <li>oświadczenie, że zgłaszający w dobrej wierze uważa informacje w zgłoszeniu za prawdziwe i kompletne.</li>
        </LegalList>
        <p>
          Zgłoszenia rozpatruje człowiek, bez zautomatyzowanego podejmowania decyzji, bez zbędnej zwłoki i obiektywnie. Jeśli
          treść okaże się bezprawna, blokujemy do niej dostęp lub ją usuwamy i informujemy o tej decyzji wraz z uzasadnieniem
          osobę, której treść dotyczy, o ile możemy się z nią skontaktować.
        </p>
        <p>
          Treści publikowane bezpośrednio na Discordzie, poza Usługami, zgłaszaj administracji danego serwera lub{" "}
          <ExternalLink href="https://dis.gd/report">Discordowi</ExternalLink>.
        </p>
      </LegalSection>

      <LegalSection id="dane" title="§12. Dane osobowe">
        <p>
          Zasady przetwarzania danych osobowych opisuje{" "}
          <Link className={linkClass} href="/privacy">polityka prywatności</Link>. Z Usług można korzystać pod pseudonimem
          używanym na Discordzie — nie wymagamy podawania imienia, nazwiska ani adresu e-mail.
        </p>
      </LegalSection>

      <LegalSection id="zmiany" title="§13. Zmiany Regulaminu">
        <p>
          Regulamin może zostać zmieniony z ważnych przyczyn prawnych, technicznych lub organizacyjnych, w szczególności przy
          zmianie przepisów lub zakresu Usług. O zmianach informujemy na serwerze wsparcia i w Panelu co najmniej 7 dni przed
          ich wejściem w życie. Jeśli nie akceptujesz zmian, możesz rozwiązać umowę w sposób opisany w §5.
        </p>
      </LegalSection>

      <LegalSection id="koncowe" title="§14. Postanowienia końcowe">
        <p>
          W sprawach nieuregulowanych w Regulaminie stosuje się prawo polskie, w szczególności Kodeks cywilny i ustawę o
          prawach konsumenta. Wybór prawa nie pozbawia konsumenta ochrony, jaką zapewniają mu bezwzględnie obowiązujące
          przepisy państwa jego zwykłego pobytu.
        </p>
        <p>
          Spory z konsumentami rozstrzyga sąd właściwy według przepisów ogólnych — konsument z innego państwa Unii
          Europejskiej może pozwać Usługodawcę także przed sądem swojego miejsca zamieszkania. Spory z Użytkownikami
          niebędącymi konsumentami rozstrzyga sąd właściwy dla miejsca zamieszkania Usługodawcy.
        </p>
        <p>
          Konsument może skorzystać także z pozasądowych sposobów rozwiązywania sporów: w Polsce na przykład z pomocy
          miejskiego lub powiatowego rzecznika konsumentów, a konsument z innego państwa Unii Europejskiej, Islandii lub
          Norwegii — z pomocy Europejskiego Centrum Konsumenckiego w swoim kraju.
        </p>
        <p>
          Wiążąca jest polska wersja Regulaminu. Wersja angielska jest tłumaczeniem udostępnionym dla wygody Użytkowników.
        </p>
        <p>Regulamin obowiązuje od {LEGAL.effectiveDate}.</p>
      </LegalSection>
    </>
  );
}
