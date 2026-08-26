# Compare Manager – Rendered Website Engine

The Compare Manager now renders target websites with Playwright/Chromium before extracting content. This is required for Next.js/client-rendered/Firebase-backed pages where a normal `fetch()` only receives the initial HTML shell.

## Local setup

```bash
npm install
npx playwright install chromium
npm run dev
```

If Chrome is already installed on Windows, the renderer automatically checks common Chrome executable locations. You can also explicitly set:

```text
CHROME_EXECUTABLE_PATH=C:\\Path\\To\\chrome.exe
```

## Important deployment note

This Compare Manager uses runtime Next.js API routes (`/api/compare` and `/api/compare/preview`) and Playwright. Therefore it cannot be deployed as a pure static Next.js export (`output: "export"`). The included `next.config.mjs` intentionally does not use static export.

The admin application must run on a Node-capable Next.js host (for example Next.js App Hosting/Cloud Run/Vercel), not only Firebase Hosting's static `out/` directory.

## What the renderer does

1. Opens the target website in a real headless Chromium browser.
2. Executes Next.js/client-side JavaScript.
3. Waits for meaningful rendered content.
4. Captures the rendered DOM.
5. Uses that DOM for content extraction/comparison.
6. Removes executable scripts from the preview copy so the already-rendered page does not re-hydrate and crash inside the iframe.
7. Keeps the target site's CSS/images/fonts through the original URL as the document base.

This makes the side-by-side preview and comparison operate on the same rendered page rather than on a raw HTML shell.
