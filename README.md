# DyzioBOT

Easy-to-use Discord BOT with many features.

## Spis treści

- [Opis](#opis)
- [Wymagania](#wymagania)
- [Instalacja](#instalacja)
- [Konfiguracja](#konfiguracja)
- [Uruchomienie](#uruchomienie)
- [Struktura projektu](#struktura-projektu)
- [Licencja](#licencja)

## Opis

DyzioBOT to zaawansowany bot Discord, oferujący wiele funkcji, w tym integrację z bazą danych MongoDB, obsługę komend, eventów, system powiadomień, integracje z zewnętrznymi API i wiele innych.

## Wymagania

- Node.js >= 18.x
- npm >= 9.x
- MongoDB (dostępny URI do bazy)
- Token Discord bota

## Instalacja

1. Sklonuj repozytorium:
   ```bash
   git clone <adres-repozytorium>
   cd DyzioBOT
   ```
2. Zainstaluj zależności:
   ```bash
   npm install
   ```

## Konfiguracja

1. Utwórz plik `.env` w katalogu głównym na podstawie poniższego wzoru:
   ```env
   TOKEN=twój_token_bota
   MONGODB_URI=uri_do_twojej_bazy_mongodb
   DEV_GUILD_IDS=lista_id_gildii_dev (np. 123,456)
   DEV_USER_IDS=lista_id_użytkowników_dev (np. 123,456)
   DEV_ROLE_IDS=lista_id_ról_dev (np. 123,456)
   ```
2. (Opcjonalnie) Skonfiguruj dodatkowe ustawienia w plikach w katalogu `src/config`.

## Uruchomienie

- Tryb developerski (z automatycznym restartem):
  ```bash
  npm run dev
  ```
- Budowanie projektu (TypeScript → JavaScript):
  ```bash
  npm run build
  ```
- Uruchomienie produkcyjne (po zbudowaniu):
  ```bash
  npm start
  ```

## Struktura projektu

```
DyzioBOT/
├── src/                # Kod źródłowy bota
│   ├── config/         # Konfiguracje serwerów, emoji, itp.
│   ├── handlers/       # Obsługa komend i eventów
│   ├── interfaces/     # Typy i interfejsy TypeScript
│   ├── utils/          # Narzędzia i logger
│   └── index.ts        # Główny plik startowy
├── dist/               # Skonwertowany kod JS (po build)
├── package.json        # Zależności i skrypty
├── tsconfig.json       # Konfiguracja TypeScript
├── .env                # Zmienne środowiskowe (NIE wrzucaj do repo!)
└── README.md           # Ten plik
```

## Licencja

Projekt dostępny na licencji AGPL-3.0-or-later.
