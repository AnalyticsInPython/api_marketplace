# Changelog

All notable changes to this project are recorded here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Git history is the authoritative record; this file is the readable summary.

## [Unreleased]

### Added

- **Suppliers are now told to turn network access off after the demo.** The setup
  helper, the dashboard setup guide (new step 5), and the README all explain that
  while `OLLAMA_HOST` is set the Mac accepts unauthenticated Ollama requests on
  every network it joins, that Ollama's API can pull and delete models rather than
  only answer prompts, and that restarting the Mac or running
  `--restore-localhost` clears it. (2026-09-02)

### Fixed

- **The sidebar could not be reopened once collapsed.** The collapse control was
  rendered only while the sidebar was expanded, so collapsing it removed the only
  way back; the topbar's menu button is mobile-only. The control now stays
  rendered, flipping to a right chevron with an `Expand sidebar` label, and is
  centred in the 60px rail. (2026-09-02)
- **Icon buttons rendered their glyph off-centre.** `.btn-icon` set a 32px box but
  no flex centring, and Tailwind's preflight makes `svg` a block element, so the
  16px glyph sat 1px from the left edge and 15px from the right. It is now centred
  on all four sides. The mobile/desktop visibility rules were given matching
  specificity so they still win over the new `display` value. (2026-09-02)


- **The Ollama network bind was documented as permanent.** `spec.md` and the
  README described the setup helper as configuring a "permanent" bind. It uses
  `launchctl setenv`, which lasts only for the current login session and is lost
  on restart. Corrected both. (2026-09-02)

- **README now states the required Python and Node versions.** The backend needs
  Python 3.10+ (macOS ships 3.9, which cannot start FastAPI because it fails on
  `str | None` annotations) and the dashboard needs Node 18.17+ for Next.js 14.
  Neither was documented, so a teammate on stock macOS Python hit an unexplained
  startup crash. (2026-09-02)

### Fixed

- **OpenCode setup used the wrong API key.** `spec.md` instructed readers to run
  `export MARKETPLACE_API_KEY="marketplace-demo-key"`, but `README.md`,
  `backend/.env.example`, and `frontend/.env.example` all use
  `dev-marketplace-key`. Anyone following the spec verbatim sent a key the
  router did not recognize, and every OpenCode request failed with
  `401 invalid API key`. Corrected the spec to `dev-marketplace-key` so all six
  references agree. (2026-09-02)
