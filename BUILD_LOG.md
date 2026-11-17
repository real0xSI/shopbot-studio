# Build log — ShopBot Studio (IdeaLab Hacks 2026)

## Rules verified first (2026-11-16 ~02:00 EST)

- Triage file: `~/workspace/hackathon-triage/b-codeforchange-buildyourownwebsite-idealab.md`
- Live Devpost home: https://idealab-hacks.devpost.com/ (fetched 2026-11-16 06:59 UTC)
- Live rules: https://idealab-hacks.devpost.com/rules (fetched 2026-11-16 06:59 UTC)
- Deadline: **30 Nov 2026, 23:45 EST**. Judging 1–5 Dec, results 7 Dec 2026.
- Eligibility: open to all, solo or teams up to 5, all levels; code/low-code/
  no-code welcome; AI tools allowed with disclosure.
- Prizes: non-cash recognition only (1st/2nd/3rd + 3 runner-ups).
- Submission needs (verbatim from rules page): **no explicit video or repo
  requirement**. Entries must be accessible to reviewers, accurately describe
  capabilities, clearly separate pre-existing work from work done during the
  event. Judged 25% each: creativity/originality, execution/functionality,
  usefulness/experience, clarity/learning.

## Build (2026-11-16 ~02:00–02:10 EST)

- `worker.js` — parameterized FAQ engine, validate/normalize/codec, routes
  `/`, `/bot`, `/demo`, `/api/health`, `/api/demo-config`, `/api/build`,
  `/api/chat`. No secrets, no LLM, no storage.
- `builder.html` — landing + form (6 product rows, Isi Contoh prefill).
- `bot.html` — generic webchat; `?c=` config or demo-shop fallback.
- `test.mjs` — 27 offline cases.

## Tests (offline, node v24.22.1)

```
$ node test.mjs
27 passed, 0 failed   (exit 0)
```

Coverage: routing (/, /bot, /demo, /api/health, /api/demo-config, 404);
build valid custom shop (Toko Camilan Rasa) + keyword derivation; build
rejections (no name/no products, price too low, 9 products, GET 405);
chat on a DIFFERENT shop (price 15.000, stock-0 → kosong, shipping SiCepat
+ free-min 100.000, payment QRIS, catalog 3 products, handoff no-invent,
order-status asks for number); build→chat round-trip via encoded code;
demo fallback (Kirana kemeja 189.000, lacak KRN-1042 → resi JNE1234567890);
error paths (empty 400, >500 chars 400, GET /api/chat 405, bad code 400,
bad shop 400).

Two fixes during testing (both in test/harness, verified by re-run):
1. `Buffer` missing from the vm sandbox — added to sandbox (real Workers
   use btoa/TextEncoder; the Buffer branch never runs there).
2. One test question named a product ("keripik ... menyembuhkan penyakit?")
   and correctly got a product reply — test changed to a product-free
   question ("garansi seumur hidup?") which correctly hands off.

## Deploy (2026-11-16 07:02 UTC / 02:02 EST)

```
$ python3 deploy.py deploy
uploading worker idealab-shopbot (30744 bytes js)...
upload: 200 (worker id idealab-shopbot)
creating DNS A shopbot.richcommunity.dpdns.org ... dns: 200
creating route shopbot.richcommunity.dpdns.org/* -> idealab-shopbot ... route: 200
DEPLOYED https://shopbot.richcommunity.dpdns.org/
```

Free tier only, no card, no payment. Existing Cloudflare account/zone reused
(same as CS Bot pilot).

## Live verification (2026-11-16 ~02:05 EST, real curl)

- `GET /api/health` → `{"ok":true,"service":"shopbot-studio","mode":"faq","llm":false,"demo":true}`
- `GET /` → 200, contains "Bikin Bot Gue"
- `GET /demo` → 200
- `POST /api/build` (Toko Camilan Rasa, live) → 200, `ok:true`, bot URL with `/bot?c=`
- `POST /api/chat` with live code → "Keripik Singkong Balado harganya Rp 15.000 kak. Stok tersedia 40 pcs..."
- `POST /api/chat` no shop → demo Kirana "Kemeja Linen Pria harganya Rp 189.000 kak..."
- `GET /bot?c=<live code>` → 200

## Known gaps (not hidden)

- No demo video recorded yet — rules do NOT require one. A 60-second phone
  demo script is in SUBMISSION.md for the user to record if he wants (optional).
- No public GitHub repo yet — rules do NOT require one. Repo creation is a
  manual user step (see SUBMISSION.md checklist); nothing was submitted.
