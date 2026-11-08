# Endcord Orbs Overlay

A local-only Orbs display overlay for **Endcord Desktop Mod**.

> This is a source plugin for Endcord, not a theme JSON and not a one-click raw-URL installer. Endcord's documented plugin workflow loads plugins from `src/plugins/<pluginName>/index.ts`.

## Features

- Draggable floating bubble inside the Discord window
- Snaps to the nearest left/right edge
- Click the bubble to open its editor
- Customize the displayed number, icon/emoji and accent color
- Toggle glow and fade-in effects
- Position and appearance values are stored through plugin settings
- Does not read, send, or modify the real Discord Orbs balance

## Install into an Endcord source checkout

1. Clone your Endcord fork/source checkout and install dependencies.
2. Copy this repository's `src/plugins/orbsOverlay/` folder into Endcord's `src/plugins/`.
3. From the Endcord repository root, run:

   ```bash
   pnpm install
   pnpm lint
   pnpm testTsc
   pnpm testSecurity
   pnpm build
   pnpm inject
   ```

4. Reload Discord with `Ctrl+R`.
5. Open Endcord settings → Plugins → enable **OrbsOverlay**.

## GitHub Raw URLs

After publishing this repository, these files are available as raw text:

```text
https://raw.githubusercontent.com/<OWNER>/<REPO>/main/Endcord-Orbs-Overlay-GitHub/manifest.json
https://raw.githubusercontent.com/<OWNER>/<REPO>/main/Endcord-Orbs-Overlay-GitHub/src/plugins/orbsOverlay/index.ts
```

The raw `.ts` URL is for viewing/downloading source. Endcord does not document installing an arbitrary third-party plugin by pasting that raw URL into its theme loader. The `manifest.json` is metadata for the repository; it is not an Endcord-native install manifest.

## Compatibility

Built against the documented Endcord Desktop Mod plugin shape (`definePlugin`, `definePluginSettings`, `OptionType`, `Devs.rootpoi`). Endcord API changes may require adjustments. This package has not been compiled against your local Endcord checkout; run the checks above before enabling it.

## License

GPL-3.0-or-later. This plugin is intended to be used with Endcord, which is GPL-3.0-or-later. Review Endcord's current contribution and licensing requirements before redistribution.
