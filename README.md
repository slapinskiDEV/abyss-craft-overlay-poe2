# PoE2 Abyss Craft Overlay

Windows desktop overlay for Path of Exile 2 that shows the **eligible modifier pool** for Abyss
Desecration crafting on a copied item, including blocked modifiers and the reasons they are blocked.
It does not predict reveals and shows no probabilities.

**Players:** download the app from the
[releases repository](https://github.com/slapinskiDEV/abyss-craft-overlay-poe2-releases) — it has
the installer, the portable exe and a user guide (EN/PL). This repository holds the source code.

- Product/architecture authority: [`POE2_ABYSS_OVERLAY_SOURCE_OF_TRUTH.md`](POE2_ABYSS_OVERLAY_SOURCE_OF_TRUTH.md)
- Implementation specs: [`specs/`](specs/000-index.md)
- Overview for new contributors: [`docs/APP_CONTEXT_REPORT.md`](docs/APP_CONTEXT_REPORT.md)

## Status

Specs 001–016 implemented (013, trade search link, is planned only). The overlay shows the base
Desecration pool (SoT §14.7): the modifiers the selected Bone and Omens can produce on the copied
base at its item level. The exact item check (current modifiers, existing Desecration) stays
`unknown` until verbatim EN clipboard fixtures confirm the Desecrated/fractured markers (SoT §19.1,
U-011/U-014). The overlay does not guess.

## Safety boundary

The runtime data flow is `PoE2 → clipboard → overlay`. The app does not read game memory, game
files or the game process, and does not automate crafting. Its only input to the game is one
`Ctrl+Alt+C` per hotkey press (setting `autoCopy`, `src/main/copy-shortcut.ts`); its only network
access is the update check against the releases repository (`src/main/app-update.ts`).

## Development

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

## License

Source code: [MIT](LICENSE) © slapinskiDEV. Game data from the RePoE export is owned by Grinding
Gear Games; PoE2 Wiki excerpts are CC BY-NC-SA 3.0. Details in [`NOTICE.txt`](NOTICE.txt).

---

This product isn't affiliated with or endorsed by Grinding Gear Games in any way.
