# Display adapter

The runtime now uses a small `DisplayAdapter` contract between `GameHost` and the host surface.

## Browser and Electron

`BrowserDisplayAdapter` is the default. It:

- keeps the game's logical width and height stable;
- resizes the Canvas2D backing store to the device pixel ratio, capped at 2;
- observes both viewport resize and the runtime stage when `ResizeObserver` is available;
- owns fullscreen entry/exit for the runtime stage; and
- disconnects listeners and observers during `GameHost.stop()`.

This means game code and the renderer do not need to know about `window`, `document`, CSS fitting, or
fullscreen state. The same `GameHost` can accept a custom adapter for an editor preview, an embedded
portal pane, or a future external/native display host.

## UE4 redistributable bundle

The supplied `gameforge-ue4-redist-main.zip` is verified into `vendor/ue4-redist/` for local staging.
It contains Windows DLLs and `UE4PrereqSetup_x64.exe`; it cannot execute in the Linux browser preview or
be bundled into the PWA. Use `npm run ue4:stage -- <Windows game directory>` on Windows to place the
verified `Engine/` tree beside a packaged UE4 game's `.exe`.

The browser live preview runs the GameForge TypeScript engine and Canvas2D games. UE4 remains a desktop
artifact and is intentionally kept out of the public web payload.
