# SignPath Foundation application — field by field

Form: https://signpath.org/apply (read from the live form on 2026-09-30). Before sending: turn on
two-factor authentication for the GitHub account `slapinskiDEV`.

| Field | What to enter |
|---|---|
| Project Name* | `PoE2 Abyss Craft Overlay` |
| Repository URL* | `https://github.com/slapinskiDEV/abyss-craft-overlay-poe2` |
| Homepage URL* | `https://github.com/slapinskiDEV/abyss-craft-overlay-poe2-releases` |
| Download URL | `https://github.com/slapinskiDEV/abyss-craft-overlay-poe2-releases/releases/latest` |
| Privacy Policy URL | `https://github.com/slapinskiDEV/abyss-craft-overlay-poe2-releases#safety-and-privacy` |
| Wikipedia URL (optional) | leave empty |
| Tagline* | see below |
| Description* | see below |
| Reputation* | see below |
| Maintainer Type | `Individual maintainer(s)` |
| Build System* | `GitHub Actions` |
| First Name* / Last Name* | your name |
| Email* | your contact e-mail |
| Company Name | `slapinskiDEV` (optional) |
| Primary Discovery Channel* | `AI / LLM tools` |
| Please specify the exact source (optional) | `Claude Code` or leave empty |
| Code of Conduct checkbox* | tick (certificates are issued in SignPath Foundation's name) |
| Other communications checkbox | your choice |
| Store and process personal data* | tick |

## Tagline*

```
Windows overlay for Path of Exile 2 that shows which modifiers an Abyss Desecration craft can produce on a copied item, and why the others are excluded.
```

## Description*

```
PoE2 Abyss Craft Overlay is a small Windows desktop app (Electron, React, TypeScript, MIT license) for the game Path of Exile 2. The player copies an item in the game; the overlay reads the copied item text from the clipboard and shows which modifiers an "Abyss Desecration" crafting step (Abyssal Bones and Omens) can produce on that item, and the reason every other modifier is excluded. It shows no probabilities and does not automate anything in the game.

What we want to sign: the NSIS installer and the portable exe built by electron-builder (Windows x64), plus the app's own binaries inside them.

Build: fully automated on GitHub Actions (.github/workflows/windows-build.yml, windows-latest): npm ci, a release gate (type check, all tests, validated data pack, no skipped tests), electron-vite build, artifact scan, electron-builder. A player release is a separate, manually started run.

Network: the only network access is an update check against the public GitHub releases repository (release metadata only, nothing about the user or the game is sent; can be turned off). The clipboard is read only when the user presses the hotkey.

Third-party components: open-source npm dependencies only (Electron, React, i18next, electron-updater, koffi). No closed-source code or binaries.

Question about eligibility: the app bundles one JSON data file (not code) with a normalized extract of the public RePoE export of the game's data (https://repoe-fork.github.io/poe2/, generator MIT-licensed). The game data is owned by Grinding Gear Games, the developer of Path of Exile 2, and is used under their terms; the file also holds short Path of Exile 2 Wiki excerpts (CC BY-NC-SA 3.0) as evidence references. Both are documented in NOTICE.txt and excluded from the MIT license. Is a project that ships such a data file eligible under the "no proprietary components" rule? If not, would downloading the data at build time instead of storing it in the repository change that?
```

## Reputation*

```
The project is new: public since 2026-09-30, first release 2026-09-29, 8 releases so far. It targets the Path of Exile 2 crafting community; a walkthrough video (Polish with English subtitles) is planned and is the main reason we ask for signing now, because every new user currently gets a Windows SmartScreen warning for the unsigned installer. The app is maintained actively (daily commits, about 260 automated tests, a documented specification in the repository) and published under the brand slapinskiDEV.
```

## After acceptance (repository work, not part of the form)

- "Code signing policy" section in both READMEs: the sentence "Free code signing provided by
  SignPath.io, certificate by SignPath Foundation", roles (committers/reviewers and approvers:
  slapinskiDEV) and the privacy link above.
- SignPath signing step in the publish run; each release approved manually in SignPath.
- Windows will show "SignPath Foundation" as the publisher.
