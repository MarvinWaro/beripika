@CIEL.md

# Minimal Mode — project context

A one-click switch on Marvin's Windows laptop between a **minimal, OLED-friendly desktop** (black ridge wallpaper, Rainmeter widgets, clear floating taskbar) and his **normal desktop**. Built with Claude on 2026-10-22/23. This file is the hand-off so Claude Code can maintain and extend it.

- **Project folder:** `C:\Users\Marvin Waro\Documents\MinimalMode` (the _local_ Documents folder — Marvin's shell Documents is redirected to OneDrive, this one is not).
- **Machine:** Acer Swift Go 14 (SFG14-75), OLED, **1920×1200 @ 100% scale**, Windows 11, dark mode.
- **Switch:** `Ctrl+Alt+M`, Start menu → "Minimal Mode", or the `Minimal Mode` shortcut in this folder.

---

## What each mode does

|                | Minimal Mode **ON**                                                        | Minimal Mode **OFF** (normal)                                                 |
| -------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Wallpaper      | `wallpaper-ridge.png` (Fill)                                               | Marvin's previous wallpaper restored (path + style saved in `state.json`)     |
| Desktop icons  | hidden                                                                     | restored to previous state (Marvin keeps them hidden anyway)                  |
| Taskbar        | visible, made clear by **TranslucentTB**                                   | TranslucentTB closed; auto-hide restored (Marvin's normal = auto-hide **on**) |
| Widgets        | Rainmeter running layout `MinimalMode`                                     | Rainmeter fully closed (`!Quit`)                                              |
| Startup        | `Rainmeter.lnk` + `TranslucentTB (Minimal Mode).lnk` in the Startup folder | both startup shortcuts removed                                                |
| RAM (measured) | Rainmeter ~12 MB private, TranslucentTB ~39 MB, ~0% CPU                    | 0 MB                                                                          |

The mode survives restarts (wallpaper/icons/taskbar persist in Windows; apps come back via the Startup shortcuts only while ON).

---

## Files

| File                                                                                                          | Purpose                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `MinimalMode.ps1`                                                                                             | **The whole system.** `-Action Toggle` (default) / `On` / `Off` / `Setup` / `Remove`. Logs to `last-run.log`, state in `state.json`. |
| `Minimal Mode.lnk`                                                                                            | Folder shortcut to the toggle (no hotkey).                                                                                           |
| `wallpaper-ridge.png`                                                                                         | 1920×1200 layered misty ridges, ~55% pure-black pixels.                                                                              |
| `MinimalMode.ico`                                                                                             | Icon for the shortcuts.                                                                                                              |
| `Skin\MinimalMode\`                                                                                           | **Source** of the Rainmeter suite (copied into Rainmeter's Skins folder on every ON).                                                |
| `Skin\MinimalClock\`                                                                                          | Old v1 single clock — unused, safe to delete.                                                                                        |
| `normal-wallpaper-backup.jpg`                                                                                 | Backup copy of Marvin's normal wallpaper.                                                                                            |
| `Setup Minimal Mode.cmd`                                                                                      | Installs Rainmeter silently if missing, recreates shortcuts (`-Action Setup`).                                                       |
| `Remove Minimal Mode.cmd`                                                                                     | Switches OFF and removes shortcuts, skin, layout (Rainmeter/TranslucentTB stay installed).                                           |
| `Restart Explorer.cmd`                                                                                        | Needed once after (re)creating the Start-menu shortcut so `Ctrl+Alt+M` registers.                                                    |
| `Install Rainmeter.cmd`, `Get TranslucentTB.cmd`                                                              | Reinstall helpers (Rainmeter 4.5.28 from Downloads, silent; TranslucentTB Store page).                                               |
| `Check RAM.cmd` → `ramcheck.ps1` → `ram.log`                                                                  | Reports Rainmeter/TranslucentTB memory.                                                                                              |
| `Cursor Check*.cmd`, `cursorcheck*.ps1`, `Diagnose.cmd`, `diag.ps1`, `End Leftover Queue.cmd`, `endqueue.ps1` | Diagnostics from the cursor-flicker investigation (see Incident log). Could be moved into a `tools\` folder.                         |
| `tools\build_skins.py`                                                                                        | Python generator that wrote every skin `.ini` (keeps them ASCII and consistent). Optional.                                           |
| `tools\gen_wallpapers.py`, `tools\make_icon.py`                                                               | Generators for the wallpaper options and icon (numpy + Pillow). Optional.                                                            |

---

## How `MinimalMode.ps1` works

- **Native helpers** (C# via `Add-Type`, class `MinimalModeNative`):
    - Wallpaper: `SystemParametersInfo(SPI_SETDESKWALLPAPER)` + `WallpaperStyle`/`TileWallpaper` in `HKCU:\Control Panel\Desktop`.
    - Desktop icons: find `SHELLDLL_DefView` (under `Progman` or a `WorkerW`), check `SysListView32 "FolderView"` visibility, send `WM_COMMAND 0x7402` (same as View → Show desktop icons).
    - Taskbar auto-hide: `SHAppBarMessage(ABM_GETSTATE / ABM_SETSTATE)`.
- **ON (`Enable-Minimal`)**: if previously Normal, save wallpaper + icon + auto-hide state → set ridge wallpaper → hide icons → `Start-Clock` → `Start-TTB` (if installed, set auto-hide **off** so the clear taskbar shows; otherwise auto-hide on) → `Mode=Minimal`.
- **OFF (`Disable-Minimal`)**: restore wallpaper/icons → `Stop-TTB` → restore auto-hide → `Stop-Clock` → `Mode=Normal`.
- **Widgets (`Start-Clock`)**: skins path read from `%APPDATA%\Rainmeter\Rainmeter.ini` `SkinPath` (fallback `MyDocuments\Rainmeter\Skins`); copies `Skin\MinimalMode\*`; writes `@Resources\Dock.inc` with real app paths (`Write-DockApps`, resolves Start-menu `.lnk` files); writes layout `%APPDATA%\Rainmeter\Layouts\MinimalMode\Rainmeter.ini` (**UTF-16**) from `$LayoutIni`; runs `Rainmeter.exe !LoadLayout "MinimalMode"` (starts Rainmeter if needed).
- **TranslucentTB (`Start-TTB` / `Stop-TTB`)**: package `28017CharlesMilette.TranslucentTB_v826wp6bftszj`, launched via `explorer.exe shell:AppsFolder\<PFN>!TranslucentTB`. Settings written to `%LOCALAPPDATA%\Packages\<PFN>\RoamingState\settings.json` (**UTF-8 without BOM**) from `$TTBSettings`: desktop `clear`, maximized window `acrylic #0000004D`. TTB's own startup task is disabled in the registry (otherwise the taskbar would be clear in Normal mode too). Closed politely with `taskkill /im` (TTB restores the taskbar), force-killed only as fallback.
- **Setup**: sets `JPEGImportQuality=100` (keeps dark gradients clean), creates Start-menu `Minimal Mode.lnk` with hotkey `Ctrl+Alt+M` → `conhost.exe --headless powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ...MinimalMode.ps1` (no console flash), plus the folder shortcut.

### Testing changes

```powershell
cd "$env:USERPROFILE\Documents\MinimalMode"
powershell -NoProfile -ExecutionPolicy Bypass -File .\MinimalMode.ps1 -Action Off
powershell -NoProfile -ExecutionPolicy Bypass -File .\MinimalMode.ps1 -Action On
Get-Content .\last-run.log
```

Always edit the **source** in `Skin\MinimalMode` — the copy in Rainmeter's Skins folder is overwritten on every ON.

---

## Widget suite (`Skin\MinimalMode`)

| Config     | Position (layout)          | Content                                                                                                           |
| ---------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Day`      | X 50% (anchor 50%), Y 88   | Spaced day name `T  H  U  R  S  D  A  Y` + `OCTOBER 23, 2026`                                                     |
| `Clock`    | X 128, Y 150               | Stacked 12-h clock: hours (Text1) over minutes (accent blue), small AM/PM                                         |
| `Dock`     | X 34, Y 50% (anchor 50%)   | Vertical pill: VS Code, Brave, File Explorer, Notion, Terminal (`wt.exe`), Settings. Only non-click-through skin. |
| `Calendar` | X 60R (anchor 100%), Y 146 | Month grid via `@Resources\Calendar.lua` (Sunday-first, today circled)                                            |
| `Weather`  | X 60R (anchor 100%), Y 460 | Open-Meteo (no key), Koronadal City `6.5031, 124.8469`, every 30 min; values hidden until first fetch             |
| `System`   | X 60R (anchor 100%), Y 592 | CPU / RAM / battery rings (Roundline); RAM ring turns warm ≥ 85%                                                  |

All skins: `Update=1000`, `AlwaysOnTop=-2` (on desktop), `Draggable=0`, `SavePosition=0`.

**Design tokens** (`@Resources\Style.inc`): font `Segoe UI Variable Display`, icons `Segoe Fluent Icons`; `Text1 200,200,200,235` · `Text2 128,132,141,235` · `Text3 86,90,99,235` · `Accent 150,172,214` · `Warm 214,170,140` · `CardFill 9,10,13,190` · `CardStroke 255,255,255,16`. Dim on purpose for OLED.

**OLED burn-in protection** (`@Resources\Drift.inc`): every meter is offset by `[MeasureShiftX]` (±3 px, ~30 min period) and `[MeasureShiftY]` (±2 px, ~45 min); each skin has a 4-px padded `MeterArea` so drift never clips.

---

## Gotchas learned (read before editing)

1. **Rainmeter `.ini` files must stay ASCII.** Use character references: `°` = `[\x00B0]`, `·` = `[\x00B7]`. Fluent glyphs used: `E943` code, `E774` globe, `E8B7` folder, `E70B` note, `E756` terminal, `E713` settings, `E706` sun, `E708` moon, `E753` cloud, `E945` lightning.
2. Rainmeter `Substitute` ignores zero-length regex matches → letter spacing uses `"(.)(?=.)":"\1  "`.
3. Rainmeter.ini / layout files: write as **UTF-16 LE** (`Set-Content -Encoding Unicode`). TranslucentTB `settings.json`: **UTF-8 no BOM**. Key is `maximized_window_appearance` (American spelling).
4. `Ctrl+Alt+M` lives on the Start-menu `.lnk`; Windows only registers shortcut hotkeys when Explorer starts → run `Restart Explorer.cmd` after recreating it.
5. Windows PowerShell 5.1: `& native.exe 2>&1` with `$ErrorActionPreference='Stop'` throws on stderr → use `Start-Process -Wait` for tools like `taskkill`.
6. WebParser's first fetch takes a few seconds; weather meters (`Group=WData`) start hidden and are shown in `FinishAction`.
7. Marvin's _normal_ state already has desktop icons hidden and taskbar auto-hide on — `state.json` `Prev*` values reflect that; don't "fix" them.
8. Acer's preinstalled **AICO Parallax Wallpaper** runs in the background and sometimes grabs the foreground. No conflict so far; suspect it first if the wallpaper is ever overridden.
9. Rainmeter is installed per-machine (`C:\Program Files\Rainmeter`, 4.5.28, silent install `/S /AUTOSTARTUP=0 /RESTART=0`).

---

## Incident log

**2026-10-23 — cursor "refreshing" every second.** Not caused by Minimal Mode. Diagnosed with `cursorcheck2/3.ps1`: two `php artisan queue:listen` processes (from `composer run dev` in two Laravel projects) were spawning `cmd.exe → php artisan queue:work --once` every ~3–4 s; each process start shows Windows' busy cursor. After VS Code was closed, one listener stayed **orphaned**. `End Leftover Queue.cmd` killed it; a reboot cleared the rest. Prevention: Ctrl+C dev servers before closing VS Code; switch the `dev` script to `php artisan queue:work --tries=1` (offered to Marvin, not yet applied — ask before editing his projects).

---

## Decisions & history

- Marvin wanted the "customized desktop" look from YouTube but **light on RAM** and **minimal/OLED-friendly**; chose static wallpaper + widgets over a live wallpaper.
- Wanted a **no-hassle on/off switch** → toggle script + hotkey; normal mode must cost 0 MB.
- Wallpaper: picked **1 Ridge** of three generated options (Ridge / Horizon / Moon).
- v1 was a single dim clock; v2 (current) added clock, calendar, weather, system rings, app dock and the clear taskbar after Marvin asked for more widgets and a less ordinary taskbar.
- **Music widget skipped** by Marvin. If revisited: `RainmeterMediaPlayer` v1.4 _static_ build (`MediaPlayer.dll`, reads Windows media sessions — works with Brave/YouTube and Spotify, no browser extension). Avoid WebNowPlaying v2.0.7 — broken on newer Windows 11 builds.
- Weather city: **Koronadal City** (change `City`/`Lat`/`Lon` in `Style.inc`).

## Ideas / backlog

- Tidy: move diagnostics into `tools\`, delete `Skin\MinimalClock`.
- Optional: hide widgets automatically when a window is maximized; pause System rings on battery saver.
- Optional: a second wallpaper (Horizon/Moon) selectable from `Style.inc`.
