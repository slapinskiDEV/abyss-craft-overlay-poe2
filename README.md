<div align="center">

<img src="build/icon.png" alt="PoE2 Abyss Craft Overlay icon" width="128" height="128">

# PoE2 Abyss Craft Overlay

**Abyss Desecration crafting overlay for Path of Exile 2**<br>
**Nakładka do craftingu Desecration z Abyss w Path of Exile 2**

<br>

## ⬇ [DOWNLOAD / POBIERZ](https://github.com/slapinskiDEV/abyss-craft-overlay-poe2-releases/releases/latest/download/poe2-abyss-overlay-setup.exe) ⬇

<a href="https://github.com/slapinskiDEV/abyss-craft-overlay-poe2-releases/releases/latest/download/poe2-abyss-overlay-setup.exe"><img src="https://img.shields.io/badge/%E2%AC%87%20Download%20for%20Windows-Installer%20(.exe)-3fd49a?style=for-the-badge&labelColor=0b1016" alt="Download for Windows — Installer (.exe)" height="48"></a>

<a href="https://github.com/slapinskiDEV/abyss-craft-overlay-poe2-releases/releases/latest/download/poe2-abyss-overlay-portable.exe"><img src="https://img.shields.io/badge/Portable-.exe-8a6cff?style=for-the-badge&labelColor=0b1016" alt="Portable (.exe)" height="32"></a>
<a href="https://github.com/slapinskiDEV/abyss-craft-overlay-poe2-releases"><img src="https://img.shields.io/badge/User%20guide%20%2F%20Instrukcja-EN%20%7C%20PL-555?style=for-the-badge&labelColor=0b1016" alt="User guide / Instrukcja (EN | PL)" height="32"></a>

Windows 10/11 · 64-bit · [All versions / Wszystkie wersje](https://github.com/slapinskiDEV/abyss-craft-overlay-poe2-releases/releases)

**[🇬🇧 English](#english)** · **[🇵🇱 Polski](#polski)**

</div>

---

<a id="english"></a>

## 🇬🇧 English

Windows desktop overlay for Path of Exile 2 that shows the **eligible modifier pool** for Abyss
Desecration crafting on a copied item, including blocked modifiers and the reasons they are blocked.
It does not predict reveals and shows no probabilities.

**Players:** use the download button above. The
[releases repository](https://github.com/slapinskiDEV/abyss-craft-overlay-poe2-releases) has the
installer, the portable exe and a user guide. This repository holds the source code.
The build is not code-signed yet, so Windows SmartScreen may warn: **More info → Run anyway**.

### Status

Specs 001–016 implemented (013, trade search link, is planned only). The overlay shows the base
Desecration pool (SoT §14.7): the modifiers the selected Bone and Omens can produce on the copied
base at its item level. The exact item check (current modifiers, existing Desecration) stays
`unknown` until verbatim EN clipboard fixtures confirm the Desecrated/fractured markers (SoT §19.1,
U-011/U-014). The overlay does not guess.

### Safety boundary

The runtime data flow is `PoE2 → clipboard → overlay`. The app does not read game memory, game
files or the game process, and does not automate crafting. Its only input to the game is one
`Ctrl+Alt+C` per hotkey press (setting `autoCopy`, `src/main/copy-shortcut.ts`); its only network
access is the update check against the releases repository (`src/main/app-update.ts`).

### Development

- Product/architecture authority: [`POE2_ABYSS_OVERLAY_SOURCE_OF_TRUTH.md`](POE2_ABYSS_OVERLAY_SOURCE_OF_TRUTH.md)
- Implementation specs: [`specs/`](specs/000-index.md)
- Overview for new contributors: [`docs/APP_CONTEXT_REPORT.md`](docs/APP_CONTEXT_REPORT.md)

Requires Node.js 22+.

```sh
npm install
npm run typecheck
npm test
npm run dev              # Electron + Vite
npm run data:update      # fetch RePoE + wiki evidence, rebuild and validate the data pack
npm run verify:release   # non-skippable release gate
npm run package:win      # Windows build (NSIS needs Windows or Wine; see docs/RELEASE_CHECKLIST.md)
```

Contributions are welcome — read [`CONTRIBUTING.md`](CONTRIBUTING.md) first. The most useful
contribution right now is verbatim clipboard copies of real items (SoT §19.1).

### License

Source code: [MIT](LICENSE) © slapinskiDEV. Game data from the RePoE export is owned by Grinding
Gear Games; PoE2 Wiki excerpts are CC BY-NC-SA 3.0. Details in [`NOTICE.txt`](NOTICE.txt).

---

<a id="polski"></a>

## 🇵🇱 Polski

Nakładka na Windows do Path of Exile 2. Pokazuje **pulę modyfikatorów**, które może dać crafting
Desecration z Abyss na skopiowanym przedmiocie, a także modyfikatory zablokowane wraz z powodem
blokady. Nie przewiduje wyniku odsłonięcia i nie pokazuje prawdopodobieństw.

**Gracze:** pobierz nakładkę przyciskiem powyżej. W
[repozytorium z wydaniami](https://github.com/slapinskiDEV/abyss-craft-overlay-poe2-releases) jest
instalator, wersja portable i instrukcja. To repozytorium zawiera kod źródłowy.
Program nie ma jeszcze podpisu cyfrowego, więc Windows SmartScreen może ostrzec: **Więcej
informacji → Uruchom mimo to**.

### Stan

Zaimplementowane specyfikacje 001–016 (013, link do wyszukiwarki trade, jest tylko zaplanowana).
Nakładka pokazuje bazową pulę Desecration (SoT §14.7): modyfikatory, które wybrany Bone i Omeny
mogą dać na skopiowanej bazie przy jej poziomie przedmiotu. Dokładne sprawdzenie przedmiotu
(obecne modyfikatory, istniejąca Desecration) pozostaje `unknown`, dopóki dosłowne kopie schowka
z gry (EN) nie potwierdzą znaczników Desecrated/fractured (SoT §19.1, U-011/U-014). Nakładka nie
zgaduje.

### Bezpieczeństwo

Przepływ danych to `PoE2 → schowek → nakładka`. Aplikacja nie czyta pamięci gry, plików gry ani
procesu gry i nie automatyzuje craftingu. Jedyne wejście do gry to jedno `Ctrl+Alt+C` na
naciśnięcie skrótu (ustawienie `autoCopy`, `src/main/copy-shortcut.ts`); jedyne połączenie z siecią
to sprawdzanie aktualizacji w repozytorium z wydaniami (`src/main/app-update.ts`).

### Rozwój

- Nadrzędna specyfikacja produktu i architektury: [`POE2_ABYSS_OVERLAY_SOURCE_OF_TRUTH.md`](POE2_ABYSS_OVERLAY_SOURCE_OF_TRUTH.md)
- Specyfikacje implementacji: [`specs/`](specs/000-index.md)
- Przegląd dla nowych kontrybutorów: [`docs/APP_CONTEXT_REPORT.md`](docs/APP_CONTEXT_REPORT.md)

Wymaga Node.js 22+. Komendy są w sekcji [English → Development](#development).

Wkład w projekt jest mile widziany — najpierw przeczytaj [`CONTRIBUTING.md`](CONTRIBUTING.md)
(po angielsku). Najbardziej potrzebne są teraz dosłowne kopie prawdziwych przedmiotów ze schowka
(SoT §19.1).

### Licencja

Kod źródłowy: [MIT](LICENSE) © slapinskiDEV. Dane gry z eksportu RePoE należą do Grinding Gear
Games; fragmenty PoE2 Wiki są na licencji CC BY-NC-SA 3.0. Szczegóły w [`NOTICE.txt`](NOTICE.txt).

---

This product isn't affiliated with or endorsed by Grinding Gear Games in any way.<br>
Ten produkt nie jest powiązany z Grinding Gear Games ani przez nie wspierany.
