# Concept — ShopBot Studio

## The annoyance

Small Indonesian online shops get the same 5 questions all day — harga,
stok, ongkir, cara bayar, lacak pesanan — and the owner answers them by hand,
often while packing orders. Existing "CS bot" solutions need either a paid
WhatsApp Business API setup (per-message fees, business number, Meta approval)
or a developer to hardcode one shop's catalog into a bot.

## The idea

Turn the CS bot itself into a self-serve tool: **any shop owner builds their
own bot in 60 seconds by filling a form** — no code, no signup, no payment —
and gets a shareable link they paste into their WhatsApp bio. The bot answers
only from that shop's own catalog; anything it doesn't know goes to the human
admin instead of being invented.

## What is pre-existing vs new (IdeaLab disclosure)

- **Pre-existing (CS Bot pilot, 14 Nov 2026, disclosed):** the deterministic
  FAQ answer logic — intents (price/stock/shipping/payment/order/greeting/
  human/handoff), the "never invent, hand to admin" rule, the Kirana demo
  shop data, the Cloudflare Worker deploy pattern.
- **NEW during IdeaLab (16 Nov 2026):** everything that makes it a builder
  instead of a one-shop bot — parameterized engine (any shop config, not one
  hardcoded shop), `validateShop` + `normalizeShop` (keyword derivation from
  product names), base64url config codec + shareable `/bot?c=` links,
  `POST /api/build`, the builder form page, the generic bot page that renders
  any shop, `GET /api/demo-config`, and the 27-case offline test suite.

## Why this fits IdeaLab

- "Turn any idea into a project": a real, working tool, not a slide deck.
- One thing done well: a focused prototype (judging: 25% creativity, 25%
  execution, 25% usefulness, 25% clarity).
- Useful to a real audience: millions of small Indonesian online shops,
  phone-only owners, zero budget — the exact user the builder is designed for.
- Honest about limits (no WA API, no generative AI, no order backend) —
  stated on the page itself, not hidden.

## What was NOT done (and why)

- No WhatsApp Business API integration: needs a paid Cloud API + business
  number + Meta approval; out of scope for a $0 hackathon build and would
  touch the user's own number.
- No generative-AI fallback: would need an API key and could invent prices;
  the deterministic engine is the point (never invents).
- No database/accounts: stateless links keep cost at Rp 0 and need no signup.
