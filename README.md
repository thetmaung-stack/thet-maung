# Thet Maung

Personal portfolio site of Thet Maung, mobile software engineer. Live at <https://thet-maung.cloudflare-trapping420.workers.dev/>, moving to <https://thetmaung.fyi>.

## Stack

- Plain HTML, CSS and JavaScript: no framework, no bundler, no build step, no `package.json`.
- Self-hosted variable fonts in WOFF2: JetBrains Mono, plus a Noto Sans Myanmar subset that only downloads when Burmese text is on the page (`unicode-range`).
- Inline SVG icons (Hugeicons, plus simple sun / moon / monitor icons for the theme switch), no icon font.
- Zero third-party requests, no cookies, no analytics. The only things stored in the browser are the language and theme choices (`localStorage`).
- Hosted on Cloudflare Workers Static Assets; security and cache headers in `_headers`.

## Features

- **English / Burmese switch**: the language is picked before first paint (saved choice, else the browser language, else English), so Burmese visitors never see English flash first. Switching animates the text and saves the choice in `localStorage`.
- **Light, dark and system themes**: a footer switch, left of the language switch. System (the default) follows `prefers-color-scheme`; light or dark pins the theme and the browser UI color (`theme-color`). The choice is saved in `localStorage` and applied before first paint on both pages, so there is no flash of the other theme. The favicon follows the system scheme.
- **Animated text selection**: highlight boxes drawn by `scripts.js`; the native highlight is used when JavaScript is off.
- **Morphing cursor** that takes the shape of the hovered button and becomes a text bar over text. Only on fine pointers (mouse, trackpad); touch devices keep their normal behavior. The animation loop sleeps when the cursor is idle.
- **Reduced motion**: with `prefers-reduced-motion`, UI transitions, the language animation, cursor easing and the buttons' magnetic pull are turned off.
- **Mobile layout**: at 600px wide and below, the links become a bottom tab bar.
- **Custom 404 page** for any missing path (English only).
- **Sharing and SEO**: meta description, canonical URL, Open Graph and Twitter card with a 1200×630 image, `robots.txt`, `sitemap.xml`.

## Project structure

```
.
├── index.html            The page: markup, meta and sharing tags, inline first-paint theme + language script
├── 404.html              Not-found page, served for any missing path (so all its URLs are root-relative)
├── public/
│   ├── css/styles.css    All styles: @font-face, light/dark tokens, layout, animations
│   └── js/scripts.js     Selection layer, footer year, theme switch, translations + language switch,
│                         carousel (not on the page right now), morphing cursor
├── assets/
│   ├── fonts/            JetBrains Mono and Noto Sans Myanmar: WOFF2 served, TTF kept as fallback and source
│   ├── ico/, svgs/       Favicons (the SVG follows light/dark)
│   ├── pdfs/             Résumé PDF behind the RESUME button
│   └── og-image.png      1200×630 social preview image
├── tools/og/             og-image.html, the source of og-image.png (not deployed)
├── _headers              Response headers: CSP and other security headers, cache rules
├── robots.txt            Allows everything, points to the sitemap
├── sitemap.xml           The one URL, on https://thetmaung.fyi/
├── wrangler.jsonc        Worker config: serve the repo root as static assets, 404-page handling
├── .assetsignore         Repo files kept off the public site
├── .gitignore
└── LICENSE               MIT, for the code (see License below)
```

## Local development

Needs Node.js 22.12 or newer (required by current wrangler). From the repo root:

```bash
npx wrangler dev
```

- Serves on <http://localhost:8787>, no Cloudflare login needed.
- Serves the same files production serves: `.assetsignore`, `_headers` and the 404 page all apply, so `curl -I` shows the real headers and ignored files return 404.
- Creates a local `.wrangler/` folder (ignored by git and by `.assetsignore`).

## Deployment

- Cloudflare Workers Static Assets with no Worker script. `wrangler.jsonc` sets `assets.directory` to `"./"` (the repo root) and `not_found_handling` to `"404-page"`.
- Every push to `main` deploys through Workers Builds (set up in the Cloudflare dashboard): no build command, deploy command `npx wrangler deploy`.
- Because the whole repo root is the assets directory, `.assetsignore` keeps repo-only files off the public site: `.git`, `README.md`, `LICENSE`, `wrangler.jsonc`, `.gitignore`, `.assetsignore`, `tools/`, `.wrangler`, `node_modules`, `.DS_Store`.
- **Any new file that should not be public must be added to `.assetsignore`.** Check with `npx wrangler dev`: the file should return 404.
- `_headers` is read by Cloudflare and is not served itself.
- To validate the config without deploying:

  ```bash
  npx wrangler deploy --dry-run
  ```

## Maintenance gotchas

- **The inline `<head>` scripts are pinned by hash in the CSP.** `index.html` has one inline script (it sets the theme and language before first paint), and `404.html` has one (theme only). The `Content-Security-Policy` in `_headers` allows them only by their `sha256`, index first. After any edit to either, even whitespace, recompute its hash and replace that `sha256-…` value in `_headers`. Otherwise browsers block the script: Burmese visitors see English first again, and a saved theme flashes the system one first. From the repo root:

  ```bash
  for f in index.html 404.html; do echo "$f"; python3 -c "import re,sys,hashlib,base64;s=re.search(r'<script>(.*?)</script>',open(sys.argv[1]).read(),re.S).group(1);print(base64.b64encode(hashlib.sha256(s.encode()).digest()).decode())" "$f"; done
  ```

  The command hashes the first plain `<script>` in each page. Any other inline script, or a `style="…"` attribute in HTML, is blocked by the CSP (`style-src 'self'`). Setting styles from JavaScript (`element.style.…`) is fine.
- **Fonts, icons and favicons are cached for a year (`immutable`):** everything under `assets/fonts/`, `assets/ico/` and `assets/svgs/`. To change one, add it under a new file name and update its references: `@font-face` in `styles.css`, the font preload in `index.html` and `404.html`, the favicon links in both pages. Replaced in place, returning visitors keep the old file for up to a year.
- **The résumé PDF revalidates on every request.** Replace `assets/pdfs/ThetMaungResume.pdf` in place and keep the file name.
- **Translations live in `public/js/scripts.js`**, in `translations.en` and `translations.my`. Every `data-i18n="key"` in `index.html` needs that key in both; `title` sets the browser tab title. The English text written in `index.html` is what shows first and without JavaScript, so keep it identical to `translations.en`.
- **Regenerating the og image**: edit `tools/og/og-image.html` (same colors, font and grain as the site), then run from the repo root on macOS (elsewhere, use your Chrome or Chromium binary):

  ```bash
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
      --allow-file-access-from-files --hide-scrollbars --force-device-scale-factor=1 \
      --window-size=1200,630 --virtual-time-budget=3000 \
      --screenshot="$PWD/assets/og-image.png" "file://$PWD/tools/og/og-image.html"
  ```

  The site caches it for a day; social networks cache previews on their own.
- **Regenerating a font** (only if a source TTF changes; remember the new file name). Install fonttools in a virtualenv outside the repo, since an in-repo `.venv/` would be deployed:

  ```bash
  python3 -m venv ~/.venvs/fonttools
  ~/.venvs/fonttools/bin/pip install "fonttools[woff]"
  ```

  JetBrains Mono, converted as is:

  ```bash
  ~/.venvs/fonttools/bin/fonttools ttLib.woff2 compress -o assets/fonts/jetbrains/NEW-NAME.woff2 assets/fonts/jetbrains/JetBrainsMono-VariableFont_wght.ttf
  ```

  Noto Sans Myanmar, subset to the same ranges as its `unicode-range` in `styles.css` (keeps both variable axes and Myanmar shaping):

  ```bash
  ~/.venvs/fonttools/bin/pyftsubset assets/fonts/myanmar/NotoSansMyanmar-VariableFont.ttf \
    --unicodes="U+1000-109F,U+A9E0-A9FF,U+AA60-AA7F,U+200C-200D,U+25CC" \
    --layout-features='*' --layout-scripts='*' --name-IDs='*' --name-languages='*' \
    --flavor=woff2 --output-file=assets/fonts/myanmar/NEW-NAME.woff2
  ```
- **`404.html` uses root-relative URLs** (`/public/css/styles.css`) because it is served at any depth. Keep it that way.
- **Commits use the GitHub noreply email**, set in this repo's local git config so no personal address ends up in the public history. Local config is not cloned, so set it again in every new clone, and check it before committing:

  ```bash
  git config --local user.email
  ```

  Set it with `git config user.email "<id>+<username>@users.noreply.github.com"` (the address is listed under GitHub > Settings > Emails).

## Roadmap

- [ ] Move to the custom domain <https://thetmaung.fyi>: HTTPS + HSTS, DNSSEC, an Email Routing alias, then disable the workers.dev route (`"workers_dev": false` in `wrangler.jsonc`). The canonical URL, Open Graph image and sitemap already point there, so link previews show no image until it is live.
- [ ] Real projects to replace the coming-soon section (the carousel code and styles are still in `scripts.js` and `styles.css`).
- [ ] Updated résumé.

## License

- **Code: [MIT](LICENSE).** The HTML structure, CSS, JavaScript, `_headers`, config and `tools/` may be reused under the MIT terms.
- **Content: all rights reserved.** Not covered by the MIT license: the written content (the bio and other text in `index.html`, `404.html` and the translations in `scripts.js`), the résumé in `assets/pdfs/`, and the name and TM monogram (favicons, `og-image.png`).
- **Third-party parts keep their own terms:**
  - JetBrains Mono and Noto Sans Myanmar: SIL Open Font License 1.1 (license text referenced in each font file's metadata).
  - Icons: derived from Hugeicons free icons (MIT).
