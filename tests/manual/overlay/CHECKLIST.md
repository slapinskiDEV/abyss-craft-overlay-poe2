# Overlay smoke checklist (SoT §18.6, §19.3)

Record each run as `<YYYY-MM-DD>.md` next to this file.

- [ ] App starts on Windows 10/11 (packaged unsigned .exe after SmartScreen bypass)
- [ ] Alt+T toggles the overlay; clipboard read on every show
- [ ] Overlay open: copy another item, press Alt+T once -> new item shown (spec 009);
      press again without copying -> overlay hides; Escape hides; ↻ re-reads the clipboard
- [ ] Auto-copy (spec 010): hover item, Alt+T once -> overlay shows it; hover another,
      Alt+T -> replaced; same item again -> overlay hides; works in Windowed Fullscreen
- [ ] Auto-copy off in settings -> no key sent, manual Ctrl+Alt+C needed
- [ ] Update (spec 011): install build N, publish N+1 -> "Update to …" button within ~15 s of start;
      click -> progress -> app restarts on N+1 and shows the release notes once, in the UI language
- [ ] Portable: the update button opens the releases page; setting "Check for updates" off -> no button
- [ ] Only Bones usable on the item type are listed (weapon, armour, jewellery, jewel)
- [ ] Spec 012: click a Bone in the overlay, hover another item in the game, Alt+T -> new item
      shown without clicking the game first
- [ ] Free prefix/suffix slots match the in-game item; picked modifier appears in the preview
- [ ] Spec 015: click Bones/Omens in the overlay, hover items in the game, Alt+T each time -> each item
      shown at once; search typing works; old Ctrl+Shift+D settings now start with Alt+T
- [ ] Spec 016: Alt+T -> loading state at once, new item shortly after; same item -> loading, then hides
- [ ] Spec 014: new weapon -> unrestricted Jawbone preselected; only suffix free -> Suffix filter on
- [ ] Rare item + compatible Bone shows "Possible modifiers for this base" with a list
- [ ] Window stays above PoE2 in Windowed Fullscreen
- [ ] Saved position restored; off-screen position reset
- [ ] Hotkey conflict with other tools reported, tray still works
- [ ] Multiple monitors
- [ ] DPI scaling 100 %, 125 %, 150 %
- [ ] EN client clipboard parsing
