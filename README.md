# رست (Rust)

حزمة رست على منصة سيرفرك (`serverk.gg`). هذا المستودع فيه كل شيء اللعبة تحتاجه عشان تشتغل على المنصة: ملف التعريف `serverk.yml`، الـ driver اللي يدير السيرفر، صورة الدوكر، والشروحات.

The Rust game package for the Serverk platform (`serverk.gg`). This repo holds everything the game needs to run on the platform: the `serverk.yml` manifest, the driver that manages the server, the Docker image, and the guides.

## Layout

- `serverk.yml` — the game manifest: metadata, resources, ports, backup rules, guides.
- `src/` — the bridge driver: install (SteamCMD), lifecycle, the WebRCON control channel, query, backup, and the panel modules. The driver keeps one WebSocket to `rcon.port` on loopback for the whole run, matching replies to commands by identifier, and drops it on stop and before every start. The same password is what the remote-access card shows: `rcon.ip` binds every interface only while the panel toggle is on, and a rotation waits in the install stamp until the next start.
- `image/Dockerfile` — the runtime image; the compiled bridge binary is its entrypoint.
- `assets/` — logo and banner (webp).
- `guides/` — player guides in Arabic and English.

## Develop

Everything runs on [Bun](https://bun.sh):

```sh
bun install
bun run check
bun run tsc
bun run test
bun run validate
bun run compile
```

`validate` checks the manifest, assets, and driver wiring with the exact validation the platform runs at publish. `compile` produces `dist/bridge`, an amd64 binary — serverk publishes game images for `linux/amd64` only.

The `.githooks/pre-commit` hook is the gate: it runs `fix`, `tsc`, `test`, `validate`, and `serverk-bridge schema --check` on every commit. `bun install` wires it up through the `prepare` script.

The driver is built on [`@serverkgg/bridge`](https://www.npmjs.com/package/@serverkgg/bridge). `bun install` runs `serverk-bridge link`, which points `node_modules/@serverkgg/bridge` at a local `serverk` checkout when one sits beside this repository — never commit a `file:` dependency.

## Contribute

- افتح issue لأي مشكلة أو اقتراح — بالعربي أو بالإنجليزي، كلها مرحّب فيها.
- Run `bun run check`, `bun run tsc`, `bun run test` and `bun run validate` before you open a pull request — the same checks the pre-commit hook runs.
- Releases are done by the Serverk team through the platform's central release pipeline; merged changes ride the next release.

## Arabic copy

Arabic is the source language of the platform. Player-facing strings in `serverk.yml` and the guides use Gulf gaming Arabic — the game's Arabic name is always «رست», written solid.
