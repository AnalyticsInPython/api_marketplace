# Changelog

All notable changes to this project are recorded here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Git history is the authoritative record; this file is the readable summary.

## [Unreleased]

### Added

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
