# Changelog - zmiany czekające na zbiorczy wpis

Plik roboczy (patrz CLAUDE.md, „Changelog na serwer wsparcia”). Po każdym wdrożeniu dopisz tu zmiany
widoczne dla użytkowników. Na koniec dnia złóż z nich jeden wpis na `#changelog` i wyczyść listę.

Ostatni wysłany wpis: 27.10.2026 (+ ogłoszenie o angielskim panelu na `#announcements`).

## Wdrożone 31.10.2026 (do zbiorczego wpisu)

Poprawki bezpieczeństwa: bez szczegółów technicznych (żadnych opisów, jak dało się to wykorzystać).

- Wiadomości ustawiane przez administratorów (urodziny, przypomnienia Disboard, Invite Tracker, turniej) i nazwa serwera w Server Wrapped nie pingują już `@everyone` ani ról wpisanych w treść. Pingowane są tylko osoby/role wstawiane przez zmienne. / Admin-configured messages no longer ping `@everyone` or roles typed into the text; only people/roles inserted by variables are pinged.
- Panel dokładniej sprawdza zapisywane ustawienia (poprawne ID kanałów i ról, limity długości); kanały muszą należeć do edytowanego serwera. / The dashboard validates saved settings more strictly; channels must belong to the server being edited.
- Poprawki bezpieczeństwa w panelu i bocie. / Security fixes in the dashboard and the bot.