# CLAUDE.md

A Linux (GNOME) screensaver adapted from the Chrome extension "ASCII Animals New
Tab" (MIT, https://github.com/Pawan-webdeveloper/Ascii-Animals-extension). The
animals are a web page shown in WebKitGTK by a Python launcher, and the whole
thing ships as a `.deb`.

The user talks in French, but everything in the repository is in English:
documentation (README, release notes, this file), code and comments. Keep the
README formal.

## Layout

```
src/ascii-animals-screensaver   Python launcher (single executable file)
web/index.html                  the page
web/screensaver.js              animals + rendering + clock + settings
web/screensaver.css             styles (glass, clock, panel)
web/fonts/                      Geist, Geist Mono (OFL, do not modify)
data/*.desktop                  menu entry + daemon autostart
data/icons/hicolor/             icons from the extension
packaging/debian/               control and copyright for the .deb
docs/screenshots/               README screenshot (Chrome, 1600×900)
.github/                        release workflow and release notes
Makefile                        run, settings, check, install, deb
```

## Architecture

Three subcommands in `src/ascii-animals-screensaver`:

- `daemon`: started at login (`/etc/xdg/autostart`). Asks GNOME for the idle
  time every 2 s (`org.gnome.Mutter.IdleMonitor.GetIdletime`). Once idle time
  exceeds `idleMinutes`, it starts `show` as a subprocess, unless the screen is
  already locked (`org.gnome.ScreenSaver.GetActive`), an app inhibits idle
  (`org.gnome.SessionManager.IsInhibited(8)`, e.g. video playback) or `show` is
  already running. It only re-arms once idle time drops below the delay again,
  so it never relaunches in a loop. Does not import GTK: it must stay light.
- `show`: one fullscreen GTK3 window per monitor, each with a WebView in `saver`
  mode. Closes on key press, click, scroll, touch or pointer motion > 16 px,
  after a 1.5 s grace period. Also closes when GNOME blanks or locks the screen
  (`ActiveChanged` signal). Dev options: `--windowed`, `--exit-after SECONDS`.
- `settings` (default): a normal window with the page in `settings` mode.
  Starts the daemon if it isn't running (the case right after installing).

Each subcommand runs as a single instance, using `flock` on
`$XDG_RUNTIME_DIR/ascii-animals-screensaver/*.lock`.

### Page ↔ launcher bridge

Before the page script runs, the launcher injects:

```js
window.SAVER_HOST = {
  mode: "saver" | "settings",
  settings: { ... },            // contents of settings.json
  seed, last, primary,          // saver mode: animal order, last animal shown, primary monitor
  systemIdleSeconds,            // settings mode: GNOME screen-blank delay (0 = never, null = not GNOME)
};
```

The page answers with `window.webkit.messageHandlers.saver.postMessage(JSON.stringify(msg))`:

- `{type: "save", settings}`: writes `~/.config/ascii-animals-screensaver/settings.json`
- `{type: "shown", animal}`: writes `~/.local/state/ascii-animals-screensaver/last-animal`
  (so a run never starts with the same animal twice in a row)
- `{type: "preview"}`: starts `show`

Every monitor gets the same `seed`, so they all show the same animal. Without
`SAVER_HOST` (page opened in a browser), the page uses `localStorage` and reads
the mode from `?mode=saver`.

The launcher only reads `enabled` and `idleMinutes` from the settings.
`DEFAULT_IDLE_MINUTES` in Python must stay equal to `DEFAULTS.idleMinutes` in JS.

### Web page (`web/screensaver.js`)

Sections in order: math helpers, `ANIMALS` (unchanged from the extension),
bridge + settings, EN/FR text (`STRINGS`), rendering and simulation (from the
extension), clock, saver mode, animal picker, settings panel, boot.

- Keep the 7 animals and their drawing code intact: that was the starting
  requirement. Adding an animal = an entry in `ANIMALS` plus its text in
  `STRINGS.fr.animals`.
- The mode is set on `<html data-mode>`. The CSS hides all UI unless the mode
  is `settings`, so it never flashes on the screensaver.
- All visible text goes through `t(key)` and exists in both `en` and `fr`.
- In saver mode the clock drifts a few pixels (CSS `drift-x`/`drift-y`
  animations) to avoid OLED burn-in, while still reading as centred.
- Plain JavaScript, no framework or build step, `"use strict"`.

## Commands

```bash
make check      # node --check + py_compile + desktop-file-validate
make settings   # settings window from the checkout
make run        # screensaver in a window
make deb        # dist/ascii-animals-screensaver_<version>_all.deb
```

`ASCII_SAVER_DEBUG=1` enables the WebKit inspector (right click › Inspect
Element in the settings window) and copies the JS console to stdout.

To test without touching the real settings:
`XDG_CONFIG_HOME=/tmp/x XDG_STATE_HOME=/tmp/y ./src/ascii-animals-screensaver ...`

The version is defined in one place: `__version__` in
`src/ascii-animals-screensaver` (the Makefile reads it from there).

## Releasing

`.github/workflows/release.yml` does everything when a `v*` tag is pushed:
checks that the tag equals `__version__`, runs `make deb`, installs the package
on Ubuntu 24.04 and in a Debian 13 container, then creates the GitHub release
with the `.deb` and `.github/release-notes.md` (plus notes generated from the
commits). If the release already exists, it replaces the `.deb` instead.

```bash
# 1. bump __version__ in src/ascii-animals-screensaver, commit, push main
git tag -a v1.1.0 -m "ASCII Animals Screensaver 1.1.0"
git push origin v1.1.0
```

Pushing a tag publishes a release: always ask the user first. To test the CI
without publishing: `gh workflow run release.yml` (builds and installs, keeps
the `.deb` as an artifact), then `gh run watch`.

## Testing

There is no automated test suite. Before concluding that a change works:

1. `make check`.
2. Page alone: open `web/index.html` (and `?mode=saver`) in Chrome, check the
   console and take a screenshot.
3. WebKitGTK: `./src/ascii-animals-screensaver show --windowed --exit-after 6`
   with `ASCII_SAVER_DEBUG=1`; no console line should be printed.
4. Fullscreen: `show --exit-after 5` covers the user's screen; warn them first.
5. `make deb`, then `dpkg-deb -c dist/*.deb` to check the contents.
   Installing (`sudo apt install ./dist/...deb`) is done by the user.

## Known pitfalls

- GNOME has no API for third-party screensavers: this is a plain fullscreen
  window above the desktop, not a lock screen. Never present it as locking.
- If `idleMinutes` ≥ GNOME's screen-blank delay (`org.gnome.desktop.session
  idle-delay`), GNOME blanks the screen first and the screensaver never shows.
  The settings panel says so.
- Wayland has no global pointer coordinates: the motion threshold is computed
  per window (`event.x/y`).
- The page is loaded from `file://`: `allow_file_access_from_file_urls` is
  required for the fonts.
- WebKitGTK for GTK3 (`WebKit2` 4.1) rather than GTK4 (`WebKit` 6.0): available
  on Debian 12 and 13 and already installed with GNOME.
- Tested on a single screen (laptop). Multi-monitor goes through
  `fullscreen_on_monitor` but has not been checked on real hardware.
