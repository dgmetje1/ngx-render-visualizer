# Angular render visualizer

See what Angular change detection actually does: which components get checked, why a cycle ran, what `OnPush` and signals skip, and which DOM nodes the renderer touches. It is a dev-only library you add with **one provider line**, plus a demo app that shows it off.

```ts
// app.config.ts
import { isDevMode } from '@angular/core';
import { provideRenderVisualizer } from 'ngx-render-visualizer';

providers: [provideRenderVisualizer({ enabled: isDevMode() })]
```

Works with Angular 22+ standalone apps, both zoneless and zone.js. It is off in production by default, and there is also a script-tag build that needs no code changes. Options, internals and caveats are in the [library README](projects/render-visualizer/README.md).

## What's in the repo

| Path | What it is |
|------|------------|
| `projects/render-visualizer` | The `ngx-render-visualizer` library: flash overlay, component tree, step/slow-motion replay, freeze mode, toolbar. |
| `projects/demo-dashboard` | An "Ops Dashboard" demo. `OnPush` is the default; some components opt into `Eager` for comparison. |
| `e2e` | Playwright tests that run against the demo in both zone and zoneless modes. |

The demo imports the library straight from source (a `tsconfig` path mapping), so library edits hot-reload.

## Try the demo

```sh
pnpm install
pnpm ng serve demo-dashboard
```

- Open <http://localhost:4200/> for zoneless (the default), or <http://localhost:4200/?mode=zone> for the same app with zone.js. The Settings page has a link that switches between them.
- Press **Ctrl+Shift+V** to hide or show the visualizer.

Things to look for:

- The header clock is `Eager`, so it is checked on every cycle. The `OnPush` KPI cards flash only when their own signal changes.
- Settings → **Compare** shows `Eager` copies of the KPI cards next to the signal ones; every `Eager` card flashes blue (checked) on every cycle, while only the card whose value changed turns orange (re-rendered).
- Settings → **Heavy widget** adds an `Eager` component with a slow getter, which flashes blue on every cycle: checked (and slow) but never re-rendered, because its output does not change.
- **Server load** (bottom of the dashboard) is 24 `OnPush` cells where two change per second: only those flash orange and the other 22 are skipped in the tree.
- The **Cases** page has six small experiments: mutating vs replacing an `OnPush` input, signal vs plain field, a click marking its ancestors dirty, `track` by id vs by index (compare the DOM op counts), creating components, and one batched cycle vs twenty. Combine with the **slow** slider to watch each cycle.
- The throughput chart draws outside Angular, so it causes no cycles until it raises an alert.
- Use the toolbar scrubber and ◀ ▶ buttons to step through a recorded cycle, and **freeze** to hold ticks back and release them one at a time (experimental).

## Scripts

```sh
pnpm start                        # run the demo (zoneless; add ?mode=zone for zone.js)
pnpm test                         # library unit tests (Vitest); pnpm test:watch to watch
pnpm exec playwright install chromium   # one-time, before the first e2e run
pnpm e2e                          # e2e; starts the demo if it isn't running
pnpm build                        # APF package + script-tag bundle in dist/ngx-render-visualizer
pnpm build:demo                   # production build of the demo
pnpm pack:lib                      # build, then create the library tarball
```

To try the built package in another app, run `pnpm pack:lib`, then `pnpm add` the tarball (in `dist/ngx-render-visualizer`) there.

## Publishing to npm

The package is `ngx-render-visualizer` (the name was free on npm when checked). Its metadata lives in `projects/render-visualizer/package.json`; the license is MIT, with a placeholder copyright holder in `projects/render-visualizer/LICENSE` to edit.

One-time: `npm login` (or set an `NPM_TOKEN`). Then, for each release:

```sh
pnpm version:lib patch        # or minor / major; bumps projects/render-visualizer/package.json
pnpm publish:dry              # builds and shows what would be published; uploads nothing
pnpm publish:lib              # runs the unit tests, builds, publishes dist/ngx-render-visualizer
```

`pnpm release:check` runs the unit tests, the e2e tests, the build and a pack dry run, which is a good last step before publishing.

### Automatic releases with npm trusted publishing

`.github/workflows/publish.yml` publishes when you push a tag such as `v0.1.1`, using [npm trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC). **No npm token is stored in GitHub**; npm issues a short-lived credential to the workflow run, and the package gets provenance automatically.

One-time setup:

1. Add a `repository` field to `projects/render-visualizer/package.json` pointing at your GitHub repository, for example `"repository": { "type": "git", "url": "git+https://github.com/<owner>/<repo>.git" }`. npm checks it, and the workflow fails early with a clear message if it doesn't match.
2. On npmjs.com open the package, then **Settings → Trusted Publisher → GitHub Actions**, and enter your GitHub owner, the repository name, and the workflow filename `publish.yml` (leave environment empty).
3. The package has to exist on npm before it can be configured, so publish the first version by hand (`pnpm publish:lib`). Later releases can use the tag.

Then each release is: `pnpm version:lib patch`, commit, `git tag v0.1.1 && git push --tags`. The workflow also checks that the tag matches the package version, runs the tests and e2e tests, builds, and publishes with `npm publish` (npm 11.5.1 or newer is required, and the workflow installs it).

After publishing, the script-tag build is available from a CDN, for example `https://unpkg.com/ngx-render-visualizer`.

## Caveats

The library relies on private Angular APIs (`ng.ɵsetProfiler` and friends), so it only works in dev mode and its `peerDependencies` pin a supported Angular range. See the [library README](projects/render-visualizer/README.md#caveats) for the full list.
