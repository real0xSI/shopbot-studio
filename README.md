# ShopBot Studio — IdeaLab Hacks 2026

**Live:** https://shopbot.digitalshoup.my.id/ (builder) ·
https://shopbot.digitalshoup.my.id/demo (demo bot, Toko Baju Kirana)

**One-liner:** Bikin bot CS tokomu sendiri dalam 60 detik — isi katalog, dapat
link bot yang jawab harga, stok, ongkir, cara bayar, dan lacak pesanan. Tanpa
coding, tanpa daftar, tanpa bayar.

## Files

- `worker.js` — Cloudflare Worker: parameterized FAQ engine + `/api/build`
  (validate + encode shop config) + `/api/chat` + `/api/health` + `/api/demo-config`.
- `builder.html` — landing + builder form (1–6 produk, ongkir, cara bayar).
- `bot.html` — webchat page; renders ANY shop from `?c=` link, falls back to demo shop.
- `test.mjs` — offline tests (node, vm sandbox, no network): **27/27 pass, exit 0**.
- `deploy.py` — deploy to `shopbot.digitalshoup.my.id` (Workers free tier).
- `CONCEPT.md` — concept + what is new vs pre-existing.
- `BUILD_LOG.md` — build + test + live verification log with real outputs.
- `SUBMISSION.md` — Devpost submission package (description draft + checklist).

## How it works

1. Owner fills the form (shop name, city, hours, products + price + stock,
   shipping, payment). No account, no signup.
2. `POST /api/build` validates the config (1–8 products, price/stock ranges,
   string limits) and returns a shareable link: `/bot?c=<base64url JSON>`.
3. The shop config lives INSIDE the link — nothing is stored on any server.
   Customers open the link and chat; `POST /api/chat` answers from that shop's
   own data. Unknown questions are handed to the admin, never invented.

## Honest limits

- NOT WhatsApp Business API (paid per message + business number + Meta approval).
  The bot is a webchat link the shop puts in its WhatsApp bio/profile.
- No generative AI: answers are deterministic from the shop's own catalog.
  It cannot answer anything not in the catalog — by design.
- No order backend: order tracking works only for demo order numbers the shop
  provides (Kirana demo: KRN-1042, KRN-1043). A real shop plugs its own source.
- No storage: if the owner loses the link, they rebuild it from the form (60s).

## Cost

Rp 0. Cloudflare Workers free tier, no database, no paid API, no card.
