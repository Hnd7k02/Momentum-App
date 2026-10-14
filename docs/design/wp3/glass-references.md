# Glass references for WP3 Stage 6 (P11)

The two references named in the WP3 brief could not be fetched from the
build environment (its egress policy blocks both hosts). What follows is
the owner's transcription, recorded on 14.10.2026 so Stage 6 works from the
same values.

## glass_kit (Flutter) — the README example

Flutter, so a reference for the look only; none of its code is used.

| Property | Value |
|---|---|
| Fill | linear gradient, white 40 % to white 10 %, top-left to bottom-right |
| Border width | 1.5 px |
| Border | gradient: white 60 % · white 10 % · light blue 5 % · light blue 60 % |
| Border stops | 0 · 0.39 · 0.40 · 1 |
| Blur | 15 |
| Frosted noise | 12 % |
| Shadow | black 20 %, elevation 3 |

Source: https://github.com/bharat-1809/glass_kit

## Glass-Morphism-Generator (CSS)

A generator with adjustable colour, transparency, blur, border width and
border radius, which outputs plain CSS for exactly those properties
(`background` with alpha, `backdrop-filter: blur()`, `border`,
`border-radius`).

Source: https://github.com/daniektj/Glass-Morphism-Generator

## Notes for Stage 6

- Translate the glass_kit values into tokens in `src/styles/tokens.css`,
  never inline: fill alpha pair, border gradient and stops, blur radius,
  shadow.
- `backdrop-filter` needs the `-webkit-` prefix for iOS Safari, and a solid
  fallback where it is unsupported or where reduced transparency is
  requested.
- The 12 % frosted noise has no CSS property; if kept it is a tiled image,
  and its cost has to be measured like the blur.
