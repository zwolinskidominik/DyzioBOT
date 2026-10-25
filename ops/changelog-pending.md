# Changelog - zmiany czekające na zbiorczy wpis

Plik roboczy (patrz CLAUDE.md, „Changelog na serwer wsparcia”). Po każdym wdrożeniu dopisz tu zmiany
widoczne dla użytkowników. Na koniec dnia złóż z nich jeden wpis na `#changelog` i wyczyść listę.

## 25.10.2026

### Zmienione / Changed
- Logi usuniętych i edytowanych wiadomości pokazują autora i treść także po restarcie bota (kopia wiadomości maks. 30 dni, tylko na serwerach z tymi logami, nigdy z kanałów ignorowanych). / Deleted and edited message logs show the author and content even after a bot restart (copy kept up to 30 days, only on servers with these logs, never from ignored channels).
- Linki do panelu (deezy.cc) pokazują na Discordzie podgląd z logo Deezy. / Dashboard links show a preview with the Deezy logo.
- Polityka prywatności 1.2 (kopie wiadomości); Regulamin i Polityka nie są już oznaczone jako wersja robocza. / Privacy Policy 1.2 (message copies); Terms and Privacy Policy no longer marked as a draft.
- Po dodaniu na serwer bot ustawia sobie nick „Deezy” (własny nick serwera zostaje). / After joining a server the bot sets its nickname to "Deezy" (an existing server nickname is kept).
- Drobne poprawki w tekstach bota. / Small text fixes across the bot.

### Nowe / New
- `/help` ma przycisk „Serwer wsparcia”; Regulamin i Polityka linkują do serwera wsparcia. / `/help` has a support server button; Terms and Privacy Policy link to the support server.

### Poprawione / Fixed
- Logi ról: `@everyone` zamiast `@@everyone`. / Role logs show `@everyone` instead of `@@everyone`.
- Logi wiadomości sprzed aktualizacji mówią, że treść jest nieznana, zamiast „Brak treści”. / Logs of older messages say the content is unknown instead of "No content".
- `/say` nie pinguje `@everyone` ani ról z treści. / `/say` no longer pings `@everyone` or roles in the text.
