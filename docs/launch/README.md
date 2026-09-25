# Launch kit

Everything here is a draft for you to post. Nothing is published automatically.

## Assets

Rendered from the real components by `npm run social` (Playwright + local static server), so they can never drift from the library.

| File | Size | Use |
|---|---|---|
| `site/public/social/og.png` | 1200x630 @2x | Social preview, already wired into every page |
| `site/public/social/og-platinum.png` | 1200x630 @2x | Preview for the Themes page |
| `site/public/social/og-liquid.png` | 1200x630 @2x | Spare, for a liquid glass post |
| `site/public/social/gallery-1-aqua.png` | 1270x760 @2x | Product Hunt gallery 1 |
| `site/public/social/gallery-2-liquid.png` | 1270x760 @2x | Product Hunt gallery 2 |
| `site/public/social/gallery-3-platinum.png` | 1270x760 @2x | Product Hunt gallery 3 |
| `site/public/social/gallery-4-brutalist.png` | 1270x760 @2x | Product Hunt gallery 4 |
| `site/public/social/gallery-5-urban.png` | 1270x760 @2x | Product Hunt gallery 5 |
| `site/public/social/gallery-6-minimal.png` | 1270x760 @2x | Spare |
| `site/public/social/gallery-7-paper.png` … `gallery-11-aero.png` | 1270x760 @2x | paper, terminal, neon, system (1-bit), aero |
| `site/public/social/og-terminal.png`, `og-paper.png` | 1200x630 @2x | Alternate social cards |
| `site/public/social/block-dashboard-urban.png` | 1270x760 @2x | The dashboard block, urban. Strongest single image |
| `site/public/social/block-dashboard-brutalist.png` | 1270x760 @2x | The dashboard block, brutalist |
| `site/public/social/block-dashboard-aqua.png` | 1270x760 @2x | The dashboard block, Aqua |
| `site/public/social/eras.gif` | 1000x600, 6 frames | The era switch, for X, Reddit and the PH gallery |
| `site/public/social/eras.webm` | 1000x600 video | Same clip as video, for anywhere that takes webm |

Regenerate with `npm run social` (images) and `npm run clip` (GIF + webm). Both render the live site, so they cannot drift from the components.

**If you want an mp4** (X prefers it, and it looks sharper than a GIF), Playwright's bundled ffmpeg only writes webm, so install a full ffmpeg once and convert:

```bash
brew install ffmpeg
ffmpeg -i site/public/social/eras.webm -vf "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -crf 22 -movflags +faststart site/public/social/eras.mp4
```

X also accepts the GIF directly and converts it to video on upload, so the mp4 is optional.

## Before you post

1. `mitame.dev` bought and pointing at the Vercel project.
2. `SITE_URL=https://mitame.dev` set in Vercel, then redeploy, so previews and the sitemap use real URLs.
3. `npm publish` done, then check `npx @lazizbekio/mitame@latest init` in an empty folder.
4. Open https://mitame.dev in a private window and click through: theme switch, a component page, a block, dark mode, phone width.
5. Paste the URL into a Slack or Discord message to confirm the preview image shows.
6. Post the same day to Product Hunt (12:01am PT) and X, then Show HN and r/reactjs a few hours apart.

## Files

- `product-hunt.md`: tagline, description, maker comment, topics
- `twitter.md`: launch thread plus spare single posts
- `show-hn.md`: title and body
- `reddit.md`: r/reactjs and r/webdev versions

## Notes on what tends to land

- Lead with the picture. A UI library is judged in one second by how it looks.
- The hook is the contrast: the same screen in 1997, 2001 and 2026.
- Say the boring facts early: React 19, zero dependencies, MIT, copy-paste.
- Answer every comment for the first few hours. That matters more than the copy.
