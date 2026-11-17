// Offline test for ShopBot Studio worker.js — no network, no secrets.
// Loads the worker in a vm with a stubbed addEventListener, then drives the
// fetch handler with synthetic Requests and asserts status + intent + content.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(dir, "worker.js"), "utf8")
  .replace("__BUILDER_HTML__", JSON.stringify(readFileSync(join(dir, "builder.html"), "utf8")))
  .replace("__BOT_HTML__", JSON.stringify(readFileSync(join(dir, "bot.html"), "utf8")));

let fetchHandler = null;
const sandbox = {
  console, URL, Request, Response, TextEncoder, TextDecoder, Buffer,
  fetch: async () => { throw new Error("fetch must not be called"); },
  addEventListener: (type, fn) => { if (type === "fetch") fetchHandler = fn; },
};
vm.createContext(sandbox);
vm.runInContext(workerSrc, sandbox);
if (!fetchHandler) { console.error("FAIL: worker did not register a fetch handler"); process.exit(1); }

async function call(url, opts) {
  let promise = null;
  fetchHandler({ request: new Request(url, opts), respondWith: (p) => { promise = p; } });
  const res = await promise;
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, text, json };
}

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("PASS", name); }
  else { fail++; console.log("FAIL", name, extra); }
}

const BASE = "http://localhost";
const SNACK = {
  name: "Toko Camilan Rasa",
  city: "Yogyakarta",
  hours: "Setiap hari 08.00-22.00 WIB",
  adminWa: "https://wa.me/6281300000000",
  products: [
    { name: "Keripik Singkong Balado", price: 15000, stock: 40 },
    { name: "Kopi Gula Aren", price: 12000, stock: 0 },
    { name: "Brownies Keju", price: 35000, stock: 7 },
  ],
  shipping: { cost: "Yogyakarta Rp 8.000, Jawa Rp 12.000-20.000", freeMin: 100000, eta: "1-2 hari (Jawa)", couriers: ["JNE", "SiCepat"] },
  payment: { methods: ["QRIS", "Transfer BCA"] },
};

// Routing
let r = await call(BASE + "/");
check("GET / 200 + builder form", r.status === 200 && r.text.includes("Bikin Bot Gue") && r.text.includes("Toko Baju Kirana") === false || r.text.includes("Isi Contoh"));
r = await call(BASE + "/bot");
check("GET /bot 200 + chat", r.status === 200 && r.text.includes("bikin bot tokomu sendiri"));
r = await call(BASE + "/demo");
check("GET /demo 200 + chat", r.status === 200 && r.text.includes("bikin bot tokomu sendiri"));
r = await call(BASE + "/api/health");
check("GET /api/health ok faq no-llm", r.status === 200 && r.json?.ok === true && r.json?.mode === "faq" && r.json?.llm === false);
r = await call(BASE + "/api/demo-config");
check("GET /api/demo-config returns Kirana + code", r.status === 200 && r.json?.shop?.name === "Toko Baju Kirana" && typeof r.json?.code === "string" && r.json.code.length > 50);
r = await call(BASE + "/nope");
check("GET /nope 404", r.status === 404);

// Build: valid custom shop
r = await call(BASE + "/api/build", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ shop: SNACK }) });
check("POST /api/build snack shop -> 200 + bot url", r.status === 200 && r.json?.ok === true && typeof r.json?.url === "string" && r.json.url.includes("/bot?c="), r.text.slice(0, 200));
check("build normalizes keywords from names", r.json?.shop?.products?.[0]?.keywords?.includes("keripik") && r.json?.shop?.products?.[0]?.keywords?.includes("balado"));
const snackCode = r.json?.code || "";
// Build: invalid shops
r = await call(BASE + "/api/build", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ shop: { products: [] } }) });
check("POST /api/build no name + no products -> 400 + errors", r.status === 400 && Array.isArray(r.json?.errors) && r.json.errors.length >= 2, r.text.slice(0, 200));
r = await call(BASE + "/api/build", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ shop: { name: "X", products: [{ name: "A", price: 100, stock: 1 }] } }) });
check("POST /api/build price 100 too low -> 400", r.status === 400 && r.text.includes("harga"));
r = await call(BASE + "/api/build", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ shop: { name: "X", products: Array.from({ length: 9 }, (_, i) => ({ name: "P" + i, price: 5000, stock: 1 })) } }) });
check("POST /api/build 9 products -> 400", r.status === 400);
r = await call(BASE + "/api/build", { method: "GET" });
check("GET /api/build -> 405", r.status === 405);

// Chat with custom shop (in body)
async function chat(msg, extra = {}) {
  return call(BASE + "/api/chat", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: msg, shop: SNACK, ...extra }),
  });
}
r = await chat("harga keripik berapa?");
check("chat snack: harga keripik -> 15.000", r.status === 200 && r.json?.intent === "price" && r.text.includes("15.000"), r.text.slice(0, 200));
r = await chat("stok kopi masih ada?");
check("chat snack: stok kopi 0 -> kosong", r.status === 200 && r.json?.intent === "stock" && r.text.includes("kosong"), r.text.slice(0, 200));
r = await chat("ongkir ke Jakarta berapa?");
check("chat snack: ongkir -> SiCepat + gratis 100rb", r.status === 200 && r.json?.intent === "shipping" && r.text.includes("SiCepat") && r.text.includes("100.000"), r.text.slice(0, 200));
r = await chat("cara bayar gimana?");
check("chat snack: bayar -> QRIS", r.status === 200 && r.json?.intent === "payment" && r.text.includes("QRIS"), r.text.slice(0, 200));
r = await chat("katalognya apa aja?");
check("chat snack: katalog -> 3 produk", r.status === 200 && r.json?.intent === "catalog" && (r.text.match(/Rp /g) || []).length >= 3, r.text.slice(0, 200));
r = await chat("apakah toko ini ada garansi seumur hidup?");
check("chat snack: tak terjawab -> handoff, no invent", r.status === 200 && r.json?.intent === "handoff" && r.text.includes("admin"), r.text.slice(0, 200));
r = await chat("lacak pesanan saya");
check("chat snack: lacak tanpa nomor -> minta nomor", r.status === 200 && r.json?.intent === "order_status" && r.text.includes("nomor order"), r.text.slice(0, 200));

// Chat via encoded link code (round-trip: build -> chat with code only)
r = await call(BASE + "/api/chat", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ message: "harga brownies berapa?", code: snackCode }),
});
check("chat via build code -> brownies 35.000", r.status === 200 && r.json?.intent === "price" && r.text.includes("35.000"), r.text.slice(0, 200));

// Chat with no shop = demo fallback (Kirana)
r = await call(BASE + "/api/chat", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ message: "harga kemeja berapa?" }),
});
check("chat no shop -> demo Kirana kemeja 189.000", r.status === 200 && r.json?.intent === "price" && r.text.includes("189.000"), r.text.slice(0, 200));
r = await call(BASE + "/api/chat", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ message: "lacak KRN-1042" }),
});
check("chat demo lacak KRN-1042 -> resi", r.status === 200 && r.json?.intent === "order_status" && r.text.includes("JNE1234567890"), r.text.slice(0, 200));

// Validation / errors
r = await chat("");
check("chat kosong -> 400", r.status === 400);
r = await chat("x".repeat(501));
check("chat >500 char -> 400", r.status === 400);
r = await call(BASE + "/api/chat", { method: "GET" });
check("GET /api/chat -> 405", r.status === 405);
r = await call(BASE + "/api/chat", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ message: "halo", code: "!!!not-base64!!!" }),
});
check("chat bad code -> 400", r.status === 400);
r = await call(BASE + "/api/chat", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ message: "halo", shop: { name: "X", products: [] } }),
});
check("chat bad shop -> 400", r.status === 400);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
