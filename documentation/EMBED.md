# OMF Atlas embed (fakarny)

Interactive embed surface for lesson iframes. Built as a second Vite entry (`embed.html` → `src/embed.js` → shared `main.js`).

## URLs

| URL | Purpose |
|-----|---------|
| `/embed.html` | Production embed document |
| `/embed` | nginx alias to `embed.html` (when configured) |

### Query parameters (v1)

| Param | Example | Effect |
|-------|---------|--------|
| `ui` | `minimal` | Hides footer, consent, analytics chrome; compacts chrome |
| `scene` | `head`, `dental`, `development`, `study`, `quiz` | Initial tab / mode |
| `part` | `FJ3289` or FDI `36` | Select structure after load |
| `theme` | `light` / `dark` | Theme before first paint |
| `modes` | `anatomy,dental` | Allowlist main tabs in the tab bar |
| `parentOrigin` | `https://app.fakarny.example` | Restrict incoming `postMessage` (dev allows any origin) |

Google Analytics and the consent banner are **not** loaded on the embed entry.

## Run locally

```powershell
cd C:\Users\krx15\agent-library\clones\OMFAtlas
git checkout fakarny/embed-mvp
npm ci
# If tests/build need meshes: git sparse-checkout add public && git checkout HEAD -- public
npm run dev
```

Open:

- Standalone: http://127.0.0.1:3016/
- Embed (minimal): http://127.0.0.1:3016/embed.html?ui=minimal&scene=head

Production build:

```powershell
npm run build
npm run preview
```

For iframe CSP smoke tests, `vite preview` sets permissive `frame-ancestors *` on `/embed.html` only (see `vite.config.js`). Production uses `deploy/omfatlas-embed-headers.conf`.

## postMessage v1

**Discipline:** parent validates `event.origin === ATLAS_ORIGIN` and `event.data.source === 'omf-atlas'`. The iframe validates `event.data.source === 'fakarny'` and (in production) `event.origin === parentOrigin` from `?parentOrigin=` or your configured default.

### Child → parent

```json
{ "source": "omf-atlas", "v": 1, "type": "ready", "payload": { "version": "0.2.0-fakarny", "ui": "minimal" } }
```

```json
{ "source": "omf-atlas", "v": 1, "type": "selectStructure", "payload": { "partId": "FJ3289", "displayName": "Mandible", "scene": "head", "mode": "3d" } }
```

Optional: `state`, `error` (see `src/embed-bridge.js`).

### Parent → child

```json
{ "source": "fakarny", "v": 1, "type": "navigate", "payload": { "scene": "dental", "partId": "36" } }
```

```json
{ "source": "fakarny", "v": 1, "type": "selectStructure", "payload": { "partId": "FJ3289" } }
```

```json
{ "source": "fakarny", "v": 1, "type": "requestState" }
```

## fakarny iframe example

```html
<iframe
  id="omf-atlas"
  src="https://atlas.yourdomain/embed.html?ui=minimal&scene=head&parentOrigin=https%3A%2F%2Fapp.fakarny.example"
  allow="fullscreen"
  referrerpolicy="strict-origin-when-cross-origin"
  title="OMF anatomy atlas"
  style="width:100%;min-height:640px;border:0;border-radius:12px;"
></iframe>
<script>
  const iframe = document.getElementById("omf-atlas");
  const ATLAS_ORIGIN = "https://atlas.yourdomain";
  const LESSON_ORIGIN = window.location.origin;

  window.addEventListener("message", (e) => {
    if (e.origin !== ATLAS_ORIGIN || e.data?.source !== "omf-atlas" || e.data.v !== 1) return;
    if (e.data.type === "ready") console.log("Atlas ready", e.data.payload);
    if (e.data.type === "selectStructure") console.log("Selected", e.data.payload);
  });

  iframe.addEventListener("load", () => {
    iframe.contentWindow.postMessage(
      {
        source: "fakarny",
        v: 1,
        type: "navigate",
        payload: { scene: "dental", partId: "36" },
      },
      ATLAS_ORIGIN,
    );
  });
</script>
```

Local dev: use `http://127.0.0.1:3016/embed.html?ui=minimal` and set `ATLAS_ORIGIN` to `http://127.0.0.1:3016` (omit `parentOrigin` in dev or match your lesson app origin).

## Deploy CSP split

1. Copy `deploy/omfatlas-standalone-headers.conf` and `deploy/omfatlas-embed-headers.conf` to `/etc/nginx/snippets/` on the server.
2. Edit **embed** snippet `frame-ancestors` to your real fakarny hostnames.
3. Use `deploy/omfatlas.xera.ac.nginx` as reference: standalone `/` keeps deny; `/embed` and `/embed.html` include embed headers.

Attribution: embed shows a one-line fixed caption (BodyParts3D / project schematics). Full credits remain on the standalone site.

## License note

Embed does not remove dataset license obligations. Review NC-SA dental assets before commercial fakarny production (`public/models/dental/ATTRIBUTION.md` when models are present).
