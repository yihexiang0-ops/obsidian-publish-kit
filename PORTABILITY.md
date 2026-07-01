# Windows -> macOS Portability

## Current Environment

- Primary development environment: Windows
- Current local path used during development: `F:\codex-reference-library\sources\github\obsidian-publish-kit`
- Node.js is required for development and build.
- Obsidian runs the built plugin files from a vault plugin directory.

## Future Target Environment

- Target device: Mac Studio
- Recommended clone path: `~/codex-reference-library/sources/github/obsidian-publish-kit` or any user-owned development folder
- Use the same Node.js and npm workflow on macOS.

## Entry Points

Windows PowerShell:

```powershell
npm.cmd install
npm.cmd run lint
npm.cmd run build
```

macOS / Linux shell:

```bash
npm install
npm run lint
npm run build
```

## Cross-Platform Logic

- Core plugin logic is TypeScript in `src/`.
- Build logic is `esbuild.config.mjs` and does not hard-code Windows paths.
- Export paths inside Obsidian use vault-relative paths through the Obsidian adapter.

## Windows-Specific Content

- No Windows-only runtime dependency is used.
- `npm.cmd` is documented only as a Windows PowerShell workaround for blocked `npm.ps1`.
- No registry, Windows Service, COM, Credential Manager, or absolute user path is used.

## macOS Migration Risks

- Case-sensitive filesystems require import paths to keep exact casing.
- Obsidian vault plugin installation paths differ by vault location, but the plugin itself uses vault-relative paths.
- Node/npm versions should be refreshed on the target machine before building.

## Migration Steps

1. Clone the repository on macOS.
2. Run `npm install`.
3. Run `npm run lint` and `npm run build`.
4. Copy or release `manifest.json`, `main.js`, and `styles.css` into the target Obsidian vault plugin directory.
5. Enable the plugin in Obsidian.

## Latest Migration Impact Record

2026-07-01: Created the first Obsidian plugin implementation. No platform-specific runtime dependency was introduced. Development commands are documented for Windows and macOS. Core logic remains TypeScript and vault-relative.

