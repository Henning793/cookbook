# App-ikon — Kokeboka

Ikonet "Med innhold": bolle på salviegrunn, terrakotta form, mørkt blad.
Farger fra Organic-paletten: bakgrunn #7a8a5e, bolle #f5ead8, form #c67139, blad #201e1d.

## Filer

| Fil | Bruk |
| --- | --- |
| `icon-512.png` | PWA-ikon, purpose `any` |
| `icon-192.png` | PWA-ikon, purpose `any` |
| `icon-maskable-512.png` | PWA-ikon, purpose `maskable` (motivet er skalert til 72 % så det overlever Androids maskering) |
| `apple-touch-icon-180.png` | iOS hjemskjerm (iOS runder selv, derfor firkantet kilde) |
| `favicon-32.png` | Fanen i nettleseren |
| `icon.svg`, `icon-maskable.svg`, `icon-square.svg` | Kildefiler — rediger disse hvis ikonet skal endres, og render PNG-ene på nytt |
| `manifest.json` | Web app manifest |

## Slik legger du det inn

1. Kopier PNG-ene til `public/icons/` og `manifest.json` til `public/manifest.json`.
2. Legg `apple-touch-icon-180.png` og `favicon-32.png` i `public/`.
3. I `app/layout.tsx` (eller tilsvarende `<head>`):

```html
<link rel="manifest" href="/manifest.json">
<link rel="icon" href="/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
<meta name="theme-color" content="#f5ead8">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
```

Bruker du Next.js sin metadata-API i stedet, sett `themeColor: '#f5ead8'` og `manifest: '/manifest.json'` i `export const metadata`.

## Sjekk etterpå

- Chrome DevTools → Application → Manifest: ingen advarsler, maskable-ikonet vises med sikkerhetssone.
- iOS Safari → Del → Legg til på hjemskjerm: ikonet skal være fullt, ikke et skjermbilde av siden.
