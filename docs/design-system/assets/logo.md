# Cogni logo — "7 v2 Glass"

Approved by the user on 2026-10-28. `logo.svg` here is the lockup on paper.
The production files live in `public/brand/` (outlined paths only: no
fonts, scripts or external references).

- **Mark**: frosted violet squircle (violet and lilac blobs and the
  landing's Bayer-4 grain behind the glass) with a white lowercase "c" in
  Manrope ExtraBold.
- **Wordmark**: lowercase "cogni", Manrope ExtraBold, -0.03em. In a lockup
  the mark is 17% larger than the wordmark font size.

## Which file

| Surface | File |
| --- | --- |
| Paper / light grounds | `cogni-mark.svg` (paper glass), `cogni-lockup.svg`, `cogni-wordmark.svg` |
| Ink / dark grounds | `cogni-mark-ink.svg` (ink glass), `cogni-lockup-ink.svg`, `cogni-wordmark-ink.svg` |
| 20px and below (favicon, sidebar) | `cogni-favicon.svg`: dedicated build without blur, thin bezel, heavier c |
| One-colour stamp (cards, print, watermark) | `cogni-stamp.svg` |
| App icon | `cogni-app-icon.svg`; `src/app/apple-icon.png` (180) |

## Rules

- Minimum size: 16px for the favicon build; the glass mark from 21px up.
  At 20px and below always use the favicon build, the blur turns to mush.
- Use the glass that matches the ground (paper glass on paper, ink glass on
  ink). Do not add CSS glass effects, shadows or filters on top.
- Use the stamp only where a single colour is required; never recolour the
  glass mark.
- In the app (no Manrope loaded) the wordmark is the outlined SVG; on the
  landing it is live Manrope text with the mark before it.
