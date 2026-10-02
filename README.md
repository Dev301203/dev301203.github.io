# Portfolio - Devanshu Singhvi

Single-page personal portfolio drawn as a river in manga ink: a generated river system fills the hero, then runs down the page between panel-style sections and ends in a sea behind the contact links. Motion is powered by **[anime.js](https://animejs.com/)**.

## Stack

- Static **HTML**, **CSS** (custom properties, no preprocessor)
- **Vanilla JavaScript**, no build step
  - `assets/js/ink-river.js`: the hero river (canvas), seeded so `?seed=123` reproduces a drawing
  - `assets/js/page-river.js`: the river below the hero (SVG), its scroll ink-in, and the sea
  - `assets/js/main.js`: renders the sections from `assets/data/site-data.js`
- **anime.js 4.5.0**, vendored at `assets/js/vendor/anime.umd.min.js`
- **Google Fonts** (Archivo, JetBrains Mono)

Projects marked `"featured": true` in `content.json` get the large panels. Add `?static` to the URL to load without animation.

## Run locally

Open `index.html` in a browser, or serve the repo root with any static server (e.g. `npx serve .`).

After editing `assets/data/content.json`, refresh the embedded local-preview data with `node tools/sync-site-data.js`.

## GitHub Pages

This repo is set up as a **user site** (`username.github.io`). Push to the default branch; in **Settings → Pages**, use **Deploy from branch** (root `/`). No build step is required.

## License

See [LICENSE](LICENSE).
