# Momentum

A mobile-first web app for the iPhone that answers one question: **am I
moving in the right direction?** It has two worlds and one rank.

- **Mind** — a few questions of your own choosing, answered once a day.
- **Gym** — workouts logged set by set, training plans, a weekly target, a
  3D body that shows how each muscle group is developing, and **Laufen**
  (running) with a weekly target of its own.
- **One rank, the Boss**, moved by both and confirmed over seven days.

Everything stays on the device. There is no backend, no account, no cloud
sync, no analytics and no third-party service. Data leaves the phone only
when the user exports a backup themselves. The app is German first
(de-CH), English second, and works offline once installed.

It measures a person against their own history, never against anyone else.

## Build, test, check

```bash
npm ci
npm run dev         # development server
npm run typecheck   # tsc -b — never tsc --noEmit
npm run test        # unit and component tests; read the exit code, not the summary
npm run build       # validates the body model, typechecks, builds dist/
npm run verify      # builds, serves and runs every browser suite
```

`npm run verify` (`scripts/verify/run-all.mjs`) builds the app, serves it
the way GitHub Pages does and drives it in Chromium — every screen at four
phone widths, the accessibility tree, the rendered contrast of text, the
update from the live state, the app offline. It takes hours; `ONLY=a,b`
runs a choice. [`scripts/verify/README.md`](scripts/verify/README.md) lists
every suite. The same checks run on GitHub for the release branch, with a
selection in WebKit.

Stack: React, TypeScript and Vite; IndexedDB behind a typed repository
layer; three.js for the body; a service worker written by hand. It is
published to GitHub Pages from the default branch, under `/Momentum-App/`.

## Where things are written down

| | |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | The rules that stay true: the architecture, the product rules that are settled, the interface rules |
| [`HANDOVER.md`](HANDOVER.md) | Where things stand: the state of the repository, what was built when, what is verified, what comes next |
| [`docs/decisions.md`](docs/decisions.md) | Every decision with its reasoning, numbered |
| [`docs/wp3/vertrag.md`](docs/wp3/vertrag.md) | The visual contract: how every screen looks and speaks (German) |
| [`docs/release-candidates.md`](docs/release-candidates.md) | Each release candidate, what it contains and how it was checked |
| [`docs/device-tests.md`](docs/device-tests.md) | What only the phone can show, and what it has shown |

The one rule everything else follows: **store what happened, derive
everything else, every time.** Answers, sessions, sets and configuration
snapshots are stored; scores, ratings, the rank and every figure on screen
are replayed from them on each load.

```
src/
  app/        the shell, navigation, the service worker's registration
  components/ shared surfaces and controls
  core/       everything that computes — no React, no storage
  domains/    the question and training controls
  features/   the screens: today, progress, rank, areas, gym, body, onboarding
  i18n/       both languages, German as the source
  storage/    IndexedDB, migrations, repositories, services, backup
  styles/     the design tokens — the one place a colour or a size is written
  sw/         the service worker
tools/        what builds the body model and the app icon
scripts/verify/  the browser suites
```

## Licence

The app — its code, its design and its texts — is all rights reserved; see
[`LICENSE`](LICENSE). The 3D body is built from MakeHuman data released
under CC0; that, and what is kept in the repository from an earlier model,
is in [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).
