<!-- Synced by CI from the main repository (docs/releases-repo/README.md). Edit it there. -->

# PoE2 Abyss Craft Overlay

A small Windows overlay for **Path of Exile 2** that shows which modifiers an **Abyss Desecration
craft** (Bones + Omens) can give on the item under your mouse, and why each of the other modifiers
is blocked.

**[🇵🇱 Polski niżej](#polski)**

## Download

| | |
|---|---|
| **[⬇ Installer (recommended)](https://github.com/slapinskiDEV/abyss-craft-overlay-poe2-releases/releases/latest/download/poe2-abyss-overlay-setup.exe)** | Installs the overlay and updates itself (an "Update" button appears in the overlay). |
| [⬇ Portable](https://github.com/slapinskiDEV/abyss-craft-overlay-poe2-releases/releases/latest/download/poe2-abyss-overlay-portable.exe) | Runs without installation. For a new version, download it again. |

All versions: [Releases](https://github.com/slapinskiDEV/abyss-craft-overlay-poe2-releases/releases).

The build is not code-signed yet, so Windows SmartScreen may warn: click **More info → Run anyway**.

## Video tutorial

🎬 *Coming soon:* a video walkthrough in Polish with English subtitles.

## How to use it

1. Start the overlay. It runs in the system tray (green diamond icon) and stays hidden.
2. In the game, **hover over a Rare item** and press **`Alt+T`**.
   The overlay copies the item for you and appears next to the game.
The overlay has three columns: **currencies and Omens** on the left, the **modifier list** in the
middle, and your **item** on the right, as in the game, with its **free prefix and suffix slots**.

3. A **currency** (Bone) is already chosen on the left (the last one you used for this item type), and
   the Prefix/Suffix filter shows the side your item has room on. Only usable Bones are listed.
4. Optionally choose **Omens**. Only Omens usable with your Bone are listed; Omens that cannot be
   combined with another chosen Omen are greyed out (hover one to see why).
5. Read the list of **possible modifiers**:
   - **Prefix / Suffix** filters limit the list to one side.
   - **Regular** = modifiers the base can also roll through ordinary crafting.
     **Desecration-only** = modifiers that only Desecration can give.
   - Search box, and "More filters" for the required-level range.
   - The **Blocked** tab lists the modifiers that cannot appear, each with its reason.
   - **Click a modifier** to see it on your item on the right (marked "Desecrated · preview").
6. Hover **another item** and press `Alt+T` again: the overlay switches to it, also right
   after you clicked something in the overlay. Clicking in the overlay never takes focus away from the
   game (only typing in the search box does).
   Press it on the **same item** again, or press `Esc`, to hide the overlay.

Other controls: **↻** reads the clipboard again; **`Ctrl+V`** in the overlay reads an item you copied
yourself; **⚙** opens the settings (UI language English/Polish, hotkey, auto-copy on/off, updates).

## What the list means, and what it does not

- The list shows the modifiers that the chosen Bone and Omens can produce **on this base type at this
  item level**. The item's current modifiers are not taken into account yet, so a modifier that your
  item already blocks can still be listed.
- The overlay **never shows chances or probabilities**. Counts are counts, not odds.
- When a combination is not verified, the overlay says so instead of guessing a list.
- Corrupted or non-Rare items and items that already carry a Desecrated modifier get no list.

## Requirements

- Windows 10 or 11, 64-bit.
- Path of Exile 2 in **Windowed** or **Windowed Fullscreen** mode (Exclusive Fullscreen is not
  supported), with the **English** game client (the copied item text must be English).
- Game data: PoE2 0.5.5, from the RePoE export 4.5.5.2 and the PoE2 Wiki. The data version is shown
  in the overlay and in the settings.

## Safety and privacy

- The overlay **reads only the clipboard**. It does not read game memory, game files or the game
  process, and it does not click or craft for you.
- The only key press it sends to the game is **`Ctrl+Alt+C` (copy item), once per hotkey press**, so
  you do not have to copy manually. You can turn this off in the settings (then copy with
  `Ctrl+Alt+C` yourself first).
- The only network access is **checking this repository for a new version**. Nothing about you, your
  items or the game is sent, and a download starts only when you click "Update". The check can be
  turned off in the settings.

## Source code and license

The overlay is open source (MIT license):
[github.com/slapinskiDEV/abyss-craft-overlay-poe2](https://github.com/slapinskiDEV/abyss-craft-overlay-poe2).

## Feedback

Found a wrong modifier or a bug? Open an [issue](https://github.com/slapinskiDEV/abyss-craft-overlay-poe2-releases/issues)
and, if possible, attach the debug report (overlay footer → "Copy debug report").

---

<a id="polski"></a>

# 🇵🇱 PoE2 Abyss Craft Overlay (po polsku)

Mała nakładka na Windows do **Path of Exile 2**. Pokazuje, jakie modyfikatory może dać **crafting
Desecration z Abyss** (Bones + Omeny) na przedmiocie pod kursorem, i dlaczego pozostałe są
zablokowane.

## Pobieranie

| | |
|---|---|
| **[⬇ Instalator (zalecany)](https://github.com/slapinskiDEV/abyss-craft-overlay-poe2-releases/releases/latest/download/poe2-abyss-overlay-setup.exe)** | Instaluje nakładkę i sam się aktualizuje (w nakładce pojawia się przycisk „Aktualizuj”). |
| [⬇ Wersja portable](https://github.com/slapinskiDEV/abyss-craft-overlay-poe2-releases/releases/latest/download/poe2-abyss-overlay-portable.exe) | Działa bez instalacji. Nową wersję trzeba pobrać ponownie. |

Wszystkie wersje: [Releases](https://github.com/slapinskiDEV/abyss-craft-overlay-poe2-releases/releases).

Program nie ma jeszcze podpisu cyfrowego, więc Windows SmartScreen może ostrzec: kliknij
**Więcej informacji → Uruchom mimo to**.

## Film instruktażowy

🎬 *Wkrótce:* film po polsku z angielskimi napisami.

## Jak używać

1. Uruchom nakładkę. Działa w zasobniku systemowym (ikona zielonego rombu) i jest ukryta.
2. W grze **najedź kursorem na przedmiot Rare** i naciśnij **`Alt+T`**.
   Nakładka sama skopiuje przedmiot i pojawi się obok gry.
Nakładka ma trzy kolumny: **waluty i Omeny** po lewej, **listę modyfikatorów** na środku i Twój
**przedmiot** po prawej, jak w grze, z liczbą **wolnych miejsc na prefiksy i sufiksy**.

3. **Waluta** (Bone) po lewej jest już wybrana (ostatnio użyta dla tego typu przedmiotu), a filtr
   Prefiks/Sufiks pokazuje stronę, na której przedmiot ma wolne miejsce. Widać tylko pasujące Bones.
4. Opcjonalnie wybierz **Omeny**. Widoczne są tylko Omeny pasujące do Twojego Bone; te, których nie
   da się połączyć z innym wybranym Omenem, są wyszarzone (po najechaniu widać powód).
5. Przeczytaj listę **możliwych modyfikatorów**:
   - filtry **Prefiks / Sufiks** zawężają listę do jednej strony,
   - **Zwykłe** = modyfikatory, które baza może dostać także zwykłym craftingiem;
     **Tylko z Desecration** = modyfikatory, które daje wyłącznie Desecration,
   - wyszukiwarka oraz „Więcej filtrów” z zakresem wymaganego poziomu,
   - zakładka **Zablokowane** pokazuje modyfikatory, które nie mogą wypaść, każdy z powodem,
   - **kliknij modyfikator**, żeby zobaczyć go na przedmiocie po prawej („Desecrated · podgląd”).
6. Najedź na **inny przedmiot** i znowu naciśnij `Alt+T`: nakładka przełączy się na niego,
   także zaraz po kliknięciu czegoś w nakładce. Klikanie w nakładce nie zabiera grze fokusu (robi to
   tylko pisanie w wyszukiwarce).
   Ten sam skrót na **tym samym przedmiocie** albo `Esc` chowa nakładkę.

Inne: **↻** ponownie odczytuje schowek; **`Ctrl+V`** w nakładce wczytuje przedmiot skopiowany
ręcznie; **⚙** otwiera ustawienia (język interfejsu polski/angielski, skrót, automatyczne
kopiowanie, aktualizacje). Nazwy z gry (przedmioty, waluty, modyfikatory) zostają po angielsku.

## Co oznacza lista, a czego nie oznacza

- Lista pokazuje modyfikatory, które wybrany Bone i Omeny mogą dać **na tym typie bazy przy tym
  poziomie przedmiotu**. Obecne modyfikatory przedmiotu nie są jeszcze brane pod uwagę, więc na
  liście może być coś, co Twój przedmiot już blokuje.
- Nakładka **nigdy nie pokazuje szans ani prawdopodobieństw**. Liczby to liczby, nie szanse.
- Gdy dana kombinacja nie jest zweryfikowana, nakładka mówi to wprost zamiast zgadywać.
- Przedmioty Corrupted, inne niż Rare oraz z istniejącym modyfikatorem Desecrated nie dostają listy.

## Wymagania

- Windows 10 lub 11, 64-bit.
- Path of Exile 2 w trybie **Windowed** lub **Windowed Fullscreen** (Exclusive Fullscreen nie jest
  obsługiwany), z **angielskim** klientem gry (skopiowany tekst przedmiotu musi być po angielsku).
- Dane gry: PoE2 0.5.5, z eksportu RePoE 4.5.5.2 i z PoE2 Wiki. Wersja danych jest widoczna w
  nakładce i w ustawieniach.

## Bezpieczeństwo i prywatność

- Nakładka **czyta tylko schowek**. Nie czyta pamięci gry, plików gry ani procesu gry i nie klika ani
  nie craftuje za Ciebie.
- Jedyny klawisz, jaki wysyła do gry, to **`Ctrl+Alt+C` (kopiuj przedmiot), raz na naciśnięcie
  skrótu**, żebyś nie musiał kopiować ręcznie. Można to wyłączyć w ustawieniach (wtedy najpierw
  kopiujesz sam przez `Ctrl+Alt+C`).
- Jedyne połączenie z internetem to **sprawdzenie w tym repozytorium, czy jest nowa wersja**. Nic o
  Tobie, Twoich przedmiotach ani grze nie jest wysyłane, a pobieranie zaczyna się dopiero po
  kliknięciu „Aktualizuj”. Sprawdzanie można wyłączyć w ustawieniach.

## Kod źródłowy i licencja

Nakładka jest open source (licencja MIT):
[github.com/slapinskiDEV/abyss-craft-overlay-poe2](https://github.com/slapinskiDEV/abyss-craft-overlay-poe2).

## Zgłoszenia

Znalazłeś błędny modyfikator albo błąd? Załóż [issue](https://github.com/slapinskiDEV/abyss-craft-overlay-poe2-releases/issues)
i, jeśli możesz, dołącz raport debug (stopka nakładki → „Kopiuj raport debug”).

---

This product isn't affiliated with or endorsed by Grinding Gear Games in any way.
