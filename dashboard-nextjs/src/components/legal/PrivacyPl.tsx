import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import { ExternalLink, LegalList, LegalSection, Strong } from "./LegalLayout";

export function PrivacyPl() {
  return (
    <>
      <p>
        Ta polityka wyjaśnia, jakie dane przetwarza bot <Strong>DeezyBOT</Strong> działający na platformie Discord oraz
        panel zarządzania dostępny pod adresem <Strong>{LEGAL.siteUrl.replace("https://", "")}</Strong>, w jakim celu, jak
        długo je przechowujemy i jakie prawa Ci przysługują.
      </p>

      <LegalSection id="pojecia" title="Pojęcia">
        <LegalList>
          <li>
            <Strong>Administrator</Strong> — usługodawca wskazany w punkcie 1.
          </li>
          <li>
            <Strong>Bot</Strong> — aplikacja Discord „Deezy" o identyfikatorze {LEGAL.botApplicationId}.
          </li>
          <li>
            <Strong>Panel</Strong> — serwis internetowy pod adresem {LEGAL.siteUrl}, w którym konfiguruje się Bota.
          </li>
          <li>
            <Strong>Discord</Strong> — platforma komunikacyjna prowadzona przez Discord Inc., dostępna pod adresem
            discord.com i w aplikacjach Discord.
          </li>
          <li>
            <Strong>Użytkownik</Strong> — osoba korzystająca z Bota lub Panelu, w tym członek serwera, na którym działa Bot.
          </li>
          <li>
            <Strong>RODO</Strong> — rozporządzenie Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r.
            (ogólne rozporządzenie o ochronie danych).
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="administrator" title="1. Administrator danych">
        <p>
          Administratorem danych jest <Strong>{LEGAL.operatorName}</Strong> (miejsce zamieszkania: {LEGAL.city}), adres do
          korespondencji: {LEGAL.postalAddress}.
        </p>
        <p>W sprawach dotyczących danych osobowych możesz się kontaktować:</p>
        <LegalList>
          <li>
            e-mailem: <a className="text-foreground underline underline-offset-2" href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>,
          </li>
          <li>
            na serwerze wsparcia DeezyBOT na Discordzie: <ExternalLink href={LEGAL.supportServerUrl} />.
          </li>
        </LegalList>
        <p>
          Discord jest odrębnym administratorem danych Twojego konta Discord. Zasady przetwarzania danych przez Discord
          opisuje <ExternalLink href="https://discord.com/privacy">polityka prywatności Discorda</ExternalLink>.
        </p>
      </LegalSection>

      <LegalSection id="dane" title="2. Jakie dane przetwarzamy">
        <h3 className="font-semibold text-foreground">2.1. Panel zarządzania</h3>
        <p>Do panelu logujesz się kontem Discord. Przetwarzamy wtedy:</p>
        <LegalList>
          <li>
            identyfikator, nazwę i awatar konta Discord. Nie prosimy Discorda o Twój adres e-mail;
          </li>
          <li>
            listę serwerów, na których jesteś, wraz z Twoimi uprawnieniami na nich, aby pokazać serwery, którymi możesz
            zarządzać, i sprawdzać to przy każdej zmianie;
          </li>
          <li>token dostępu do API Discorda, przechowywany w zaszyfrowanym ciasteczku sesji;</li>
          <li>
            dziennik zmian w panelu: kto, kiedy i w którym module zmienił ustawienia serwera. Jest widoczny dla
            administracji tego serwera;
          </li>
          <li>
            adres IP, do ochrony przed nadużyciami (limit liczby zapytań) i w technicznych logach serwera WWW.
          </li>
        </LegalList>

        <h3 className="pt-2 font-semibold text-foreground">2.2. Bot na serwerach Discord</h3>
        <p>
          Gdy administracja serwera doda bota i włączy jego moduły, przetwarzamy dane członków tego serwera potrzebne do
          działania tych modułów:
        </p>
        <LegalList>
          <li>identyfikator, nazwę i awatar konta Discord;</li>
          <li>
            aktywność: punkty doświadczenia i poziomy, liczbę wiadomości i czas spędzony na kanałach głosowych (także w
            statystykach miesięcznych i podsumowaniach), stan konta w module ekonomii wraz z historią operacji;
          </li>
          <li>moderację: ostrzeżenia z powodem, historię nałożonych kar, zdarzenia wykryte przez moduł anty-spam;</li>
          <li>zaproszenia: kto kogo zaprosił na serwer i jakim kodem zaproszenia;</li>
          <li>datę urodzin, jeśli ją podasz albo poda ją administracja serwera;</li>
          <li>
            udział w funkcjach serwera: sugestie i głosy, udział i wygrane w giveawayach, zgłoszenia (tickety), kanały
            tymczasowe, role czasowe, wyniki gier (np. Wordle, Wisielec);
          </li>
          <li>pliki (obrazy, GIF-y) wgrane przez administrację serwera w module Powitania.</li>
        </LegalList>
        <p>
          <Strong>Treść wiadomości.</Strong> Bot widzi treść wiadomości na kanałach, do których ma dostęp. Przetwarza ją na
          bieżąco: do naliczania aktywności, ochrony przed spamem i logów moderacyjnych. Treści wiadomości nie zapisujemy w
          bazie danych. Przechowywana jest tylko tymczasowo w pamięci działającego bota i znika przy jego restarcie.
        </p>
        <p>
          <Strong>Logi i transkrypty na serwerze.</Strong> Jeśli administracja serwera włączy logi, bot publikuje na
          wskazanym kanale informacje o zdarzeniach, na przykład treść usuniętej lub edytowanej wiadomości, wejścia i wyjścia
          członków czy zmiany ról. Tak samo po zamknięciu zgłoszenia bot może zapisać jego transkrypt na kanale serwera. Są
          to zwykłe wiadomości na Discordzie, na kanale zarządzanym przez administrację serwera, i to ona decyduje o ich
          usunięciu.
        </p>

        <h3 className="pt-2 font-semibold text-foreground">2.3. Dane techniczne serwerów</h3>
        <p>
          Do działania Bota i Panelu przetwarzamy też dane samych serwerów: nazwę i ikonę serwera, listy kanałów, ról i
          emoji oraz ustawienia modułów wprowadzone przez administrację. Nie są to dane osobowe w rozumieniu art. 4 pkt 1 i
          motywu 26 RODO, dlatego nie opisujemy ich szczegółowo. Jeśli jednak ustawienia zawierają identyfikator konkretnej
          osoby (na przykład użytkownika wyłączonego z modułu), traktujemy go jak dane osobowe. Dane techniczne serwera są
          usuwane razem z pozostałymi danymi serwera (punkt 4).
        </p>

        <h3 className="pt-2 font-semibold text-foreground">2.4. Kontakt z nami</h3>
        <p>
          Gdy piszesz do nas e-mailem lub na serwerze wsparcia, przetwarzamy treść wiadomości oraz dane, z których się
          kontaktujesz (adres e-mail albo konto Discord).
        </p>
      </LegalSection>

      <LegalSection id="cele" title="3. Cele i podstawy prawne">
        <LegalList>
          <li>
            <Strong>Świadczenie usług bota i panelu</Strong> zgodnie z <Link className="text-foreground underline underline-offset-2" href="/terms">regulaminem</Link>{" "}
            — art. 6 ust. 1 lit. b RODO wobec osób korzystających z panelu i komend bota, a wobec pozostałych członków
            serwerów art. 6 ust. 1 lit. f RODO. Naszym prawnie uzasadnionym interesem jest zapewnienie funkcji, które
            administracja serwera włączyła dla swojej społeczności.
          </li>
          <li>
            <Strong>Bezpieczeństwo i zapobieganie nadużyciom</Strong>, w tym limity zapytań i logi techniczne — art. 6 ust. 1
            lit. f RODO.
          </li>
          <li>
            <Strong>Odpowiadanie na wiadomości i zgłoszenia</Strong> — art. 6 ust. 1 lit. f RODO.
          </li>
          <li>
            <Strong>Ustalenie, dochodzenie lub obrona roszczeń</Strong> — art. 6 ust. 1 lit. f RODO.
          </li>
        </LegalList>
        <p>Nie sprzedajemy danych, nie wykorzystujemy ich do reklam ani do profilowania marketingowego.</p>
        <p>
          Moduł anty-spam może automatycznie nałożyć karę na serwerze (na przykład wyciszenie), zgodnie z regułami ustawionymi
          przez administrację tego serwera. Nie podejmujemy zautomatyzowanych decyzji wywołujących wobec Ciebie skutki
          prawne.
        </p>
      </LegalSection>

      <LegalSection id="okres" title="4. Jak długo przechowujemy dane">
        <LegalList>
          <li>
            <Strong>Dane serwera</Strong> (aktywność, statystyki, moderacja, konfiguracja, dziennik zmian, wgrane pliki)
            przechowujemy, dopóki bot jest na serwerze. <Strong>{LEGAL.guildDataRetentionDays} dni po usunięciu bota</Strong>{" "}
            wszystkie dane tego serwera są automatycznie usuwane. Jeśli bot wróci na serwer wcześniej, dane zostają.
          </li>
          <li>
            Ostrzeżenia wygasają po okresie ustawionym przez administrację serwera (domyślnie {LEGAL.defaultWarnExpiryDays}{" "}
            dni).
          </li>
          <li>
            Szczegółowa historia aktywności używana do statystyk jest usuwana po {LEGAL.activityBucketDays} dniach, a historia
            powiadomień o transmisjach na Twitchu po {LEGAL.streamLogDays} dniach.
          </li>
          <li>
            Wyjście z serwera nie usuwa automatycznie Twoich danych na tym serwerze. Usuniemy je na Twoje żądanie (punkt 7).
          </li>
          <li>
            Sesja w panelu trwa do wylogowania albo jej wygaśnięcia. Pobrane z Discorda dane o serwerach i użytkownikach
            trzymamy w pamięci podręcznej od kilku minut do 24 godzin.
          </li>
          <li>
            Adres IP w mechanizmie limitu zapytań przechowujemy przez kilka minut, a w logach serwera WWW do 14 dni. Logi
            aplikacji (zdarzenia i błędy, zawierające m.in. identyfikatory serwerów i użytkowników) mają ograniczoną
            objętość, a najstarsze wpisy są automatycznie nadpisywane.
          </li>
          <li>
            Korespondencję przechowujemy do {LEGAL.correspondenceRetentionYears} lat od zakończenia sprawy, chyba że
            wcześniej zażądasz jej usunięcia.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="odbiorcy" title="5. Komu przekazujemy dane">
        <p>Dane przetwarzają w naszym imieniu dostawcy infrastruktury:</p>
        <LegalList>
          <li>
            <Strong>OVH sp. z o.o.</Strong> — serwer, na którym działają bot i panel (Polska), oraz obsługa poczty e-mail;
          </li>
          <li>
            <Strong>MongoDB, Inc.</Strong> — baza danych (MongoDB Atlas) w centrum danych Amazon Web Services we Frankfurcie
            (Niemcy).
          </li>
        </LegalList>
        <p>Ponadto:</p>
        <LegalList>
          <li>
            <Strong>Discord Inc.</Strong> — bot i panel działają przez API Discorda. Discord przetwarza dane jako odrębny
            administrator.
          </li>
          <li>
            <Strong>Twitch</Strong> — nazwy kanałów streamerów ustawione przez administrację serwera w module powiadomień.
            Na stronie tego modułu w panelu przeglądarka wczytuje awatary i miniatury bezpośrednio z serwerów Twitcha, więc
            Twitch otrzymuje wtedy Twój adres IP.
          </li>
          <li>
            <Strong>Serwisy zewnętrzne przy wybranych komendach</Strong> — na przykład pogoda (nazwa miejscowości), statystyki
            FACEIT (nick gracza) czy losowe zdjęcia i ciekawostki. Przekazujemy wyłącznie treść zapytania, bez Twojego
            identyfikatora Discord.
          </li>
        </LegalList>
        <p>
          Część z tych podmiotów ma siedzibę w Stanach Zjednoczonych. Przekazanie danych poza Europejski Obszar Gospodarczy
          odbywa się z zastosowaniem zabezpieczeń przewidzianych w rozdziale V RODO, w szczególności decyzji Komisji
          Europejskiej stwierdzającej odpowiedni stopień ochrony (EU-US Data Privacy Framework) lub standardowych klauzul
          umownych.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="6. Pliki cookies i pamięć przeglądarki">
        <p>Panel używa wyłącznie mechanizmów niezbędnych do działania:</p>
        <LegalList>
          <li>ciasteczek sesji logowania, ochrony przed atakami CSRF i adresu powrotu po zalogowaniu;</li>
          <li>
            pamięci przeglądarki (localStorage) na ustawienia interfejsu, na przykład zwinięte sekcje menu, oraz podręczne
            dane przyspieszające wczytywanie.
          </li>
        </LegalList>
        <p>
          Przechowywanie informacji niezbędnych do świadczenia usługi, o którą prosisz, nie wymaga zgody (art. 5 ust. 3
          dyrektywy 2002/58/WE i przepisy Prawa komunikacji elektronicznej, które ją wdrażają). Nie używamy narzędzi
          analitycznych, reklamowych ani śledzących, dlatego panel nie wyświetla prośby o zgodę na cookies. Możesz usunąć
          ciasteczka w ustawieniach przeglądarki, ale wtedy zostaniesz wylogowany.
        </p>
      </LegalSection>

      <LegalSection id="prawa" title="7. Twoje prawa">
        <p>Masz prawo do:</p>
        <LegalList>
          <li>dostępu do swoich danych i otrzymania ich kopii (art. 15 RODO);</li>
          <li>sprostowania danych (art. 16 RODO);</li>
          <li>usunięcia danych (art. 17 RODO);</li>
          <li>ograniczenia przetwarzania (art. 18 RODO);</li>
          <li>przeniesienia danych (art. 20 RODO);</li>
          <li>sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie (art. 21 RODO);</li>
          <li>
            wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa).
          </li>
        </LegalList>
        <p>
          Nie przetwarzamy danych na podstawie zgody, więc nie ma zgody do cofnięcia. Aby skorzystać z tych praw, napisz na{" "}
          {LEGAL.email} albo na serwerze wsparcia. Musimy potwierdzić, że żądanie pochodzi od właściciela danych, dlatego
          możemy poprosić o potwierdzenie z Twojego konta Discord albo o identyfikator serwera, którego dotyczy żądanie
          (art. 11 i art. 12 ust. 6 RODO). Odpowiadamy bez zbędnej zwłoki, najpóźniej w ciągu miesiąca.
        </p>
        <p>
          Administracja serwera może też doprowadzić do usunięcia wszystkich danych swojego serwera, usuwając z niego bota
          (punkt 4).
        </p>
      </LegalSection>

      <LegalSection id="bezpieczenstwo" title="8. Bezpieczeństwo">
        <p>
          Połączenie z panelem jest szyfrowane (HTTPS). Każda zmiana ustawień serwera wymaga zalogowania i sprawdzenia, czy
          masz na tym serwerze uprawnienie do zarządzania. Dostęp do bazy danych i serwera mają wyłącznie osoby obsługujące
          usługę.
        </p>
      </LegalSection>

      <LegalSection id="wiek" title="9. Wiek użytkowników">
        <p>
          Z bota i panelu mogą korzystać osoby spełniające wymagania wiekowe Discorda. Discord ustala minimalny wiek
          korzystania z platformy, który w niektórych krajach jest wyższy niż 13 lat.
        </p>
      </LegalSection>

      <LegalSection id="zmiany" title="10. Zmiany polityki">
        <p>
          Polityka może się zmieniać, na przykład gdy dodamy nowe funkcje. Aktualna wersja jest zawsze dostępna pod adresem{" "}
          {LEGAL.siteUrl}/privacy, z numerem wersji i datą wejścia w życie. O istotnych zmianach informujemy na serwerze
          wsparcia.
        </p>
      </LegalSection>
    </>
  );
}
