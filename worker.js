// ShopBot Studio — IdeaLab Hacks 2026.
// "Build your own shop CS bot in 60 seconds, no code."
// A shop owner fills a form -> gets a shareable bot link -> customers chat with
// a bot that answers price, stock, shipping, payment, order status from THAT
// shop's own data. Stateless: the shop config travels as base64url JSON in the
// bot link (?c=...). No database, no accounts, no secrets, no LLM.
// Pre-existing work (disclosed, from the CS Bot pilot, 2026-11-14): the
// deterministic FAQ answer logic (intents, handoff-instead-of-inventing).
// NEW during IdeaLab (Nov 2026): parameterized engine (any shop, not one
// hardcoded shop), config validation + encode/decode, /api/build, builder form,
// shareable bot links, bot page that renders any shop.

var BUILDER_HTML = __BUILDER_HTML__;
var BOT_HTML = __BOT_HTML__;

// Demo shop, pre-filled so reviewers can try instantly at /demo with zero setup.
var DEMO_SHOP = {
  name: "Toko Baju Kirana",
  city: "Bandung",
  hours: "Senin-Sabtu 09.00-21.00 WIB, Minggu 10.00-18.00 WIB",
  adminWa: "https://wa.me/6281200000000",
  products: [
    { name: "Kemeja Linen Pria", keywords: ["kemeja", "linen"], price: 189000, stock: 12 },
    { name: "Dress Floral Wanita", keywords: ["dress", "floral", "gaun"], price: 249000, stock: 8 },
    { name: "Hoodie Polos", keywords: ["hoodie", "hodie"], price: 159000, stock: 20 },
    { name: "Celana Chino", keywords: ["chino", "celana"], price: 179000, stock: 5 },
    { name: "Kaos Oversize", keywords: ["kaos", "oversize", "t-shirt", "tshirt"], price: 99000, stock: 30 }
  ],
  shipping: {
    couriers: ["JNE REG", "J&T", "AnterAja"],
    cost: "Jabodetabek Rp 10.000, Jawa Rp 15.000-25.000, luar Jawa Rp 25.000-35.000",
    freeMin: 300000,
    eta: "Jawa 1-3 hari, luar Jawa 3-7 hari"
  },
  payment: {
    methods: ["QRIS", "Transfer BCA 1234567890 a.n. Kirana", "COD khusus Bandung"],
    note: "Konfirmasi pembayaran dengan kirim bukti transfer ke chat ini."
  },
  demoOrders: {
    "KRN-1042": "Pesanan KRN-1042 sudah dikirim via JNE REG. Resi: JNE1234567890. Estimasi sampai 2 hari lagi.",
    "KRN-1043": "Pesanan KRN-1043 sedang disiapkan dan estimasi kirim besok."
  }
};

// ---------- config validation + codec ----------

function isInt(n) { return typeof n === "number" && isFinite(n) && Math.floor(n) === n; }

function validateShop(s) {
  var errs = [];
  if (!s || typeof s !== "object" || Array.isArray(s)) return ["config harus objek JSON"];
  if (typeof s.name !== "string" || !s.name.trim() || s.name.trim().length > 60)
    errs.push("nama toko wajib diisi (max 60 karakter)");
  if (s.city !== undefined && (typeof s.city !== "string" || s.city.length > 60))
    errs.push("kota max 60 karakter");
  if (s.hours !== undefined && (typeof s.hours !== "string" || s.hours.length > 120))
    errs.push("jam buka max 120 karakter");
  if (s.adminWa !== undefined && (typeof s.adminWa !== "string" || s.adminWa.length > 120))
    errs.push("link admin max 120 karakter");
  if (!Array.isArray(s.products) || s.products.length < 1 || s.products.length > 8)
    errs.push("produk harus 1-8 item");
  else {
    s.products.forEach(function (p, i) {
      if (!p || typeof p.name !== "string" || !p.name.trim() || p.name.trim().length > 60)
        errs.push("produk #" + (i + 1) + ": nama wajib (max 60 karakter)");
      if (!p || !isInt(p.price) || p.price < 1000 || p.price > 100000000)
        errs.push("produk #" + (i + 1) + ": harga harus bilangan bulat Rp 1.000-100.000.000");
      if (!p || !isInt(p.stock) || p.stock < 0 || p.stock > 100000)
        errs.push("produk #" + (i + 1) + ": stok harus bilangan bulat 0-100.000");
      if (p && p.keywords !== undefined && (!Array.isArray(p.keywords) ||
          p.keywords.some(function (k) { return typeof k !== "string" || !k.trim() || k.length > 30; })))
        errs.push("produk #" + (i + 1) + ": keywords harus array string max 30 karakter");
    });
  }
  if (s.shipping !== undefined) {
    if (typeof s.shipping !== "object") errs.push("shipping harus objek");
    else {
      if (s.shipping.cost !== undefined && (typeof s.shipping.cost !== "string" || s.shipping.cost.length > 200))
        errs.push("ongkir max 200 karakter");
      if (s.shipping.eta !== undefined && (typeof s.shipping.eta !== "string" || s.shipping.eta.length > 120))
        errs.push("estimasi max 120 karakter");
      if (s.shipping.freeMin !== undefined && (!isInt(s.shipping.freeMin) || s.shipping.freeMin < 0))
        errs.push("freeMin harus bilangan bulat >= 0");
      if (s.shipping.couriers !== undefined && (!Array.isArray(s.shipping.couriers) ||
          s.shipping.couriers.some(function (c) { return typeof c !== "string" || c.length > 30; })))
        errs.push("couriers harus array string max 30 karakter");
    }
  }
  if (s.payment !== undefined) {
    if (typeof s.payment !== "object") errs.push("payment harus objek");
    else if (s.payment.methods !== undefined && (!Array.isArray(s.payment.methods) ||
        s.payment.methods.length < 1 || s.payment.methods.length > 6 ||
        s.payment.methods.some(function (m) { return typeof m !== "string" || !m.trim() || m.length > 80; })))
      errs.push("cara bayar harus 1-6 item string max 80 karakter");
  }
  return errs;
}

// Fill defaults + derive keywords from product names so a shop owner never
// has to think about keywords: every word (>=3 chars) of the name matches.
function normalizeShop(s) {
  var shop = JSON.parse(JSON.stringify(s));
  shop.name = shop.name.trim();
  shop.city = (shop.city || "").trim();
  shop.hours = (shop.hours || "Senin-Sabtu 09.00-21.00 WIB").trim();
  shop.adminWa = (shop.adminWa || "").trim();
  shop.products = shop.products.map(function (p) {
    var kws = (p.keywords || []).map(function (k) { return String(k).toLowerCase().trim(); }).filter(Boolean);
    p.name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).forEach(function (w) {
      if (w.length >= 3 && kws.indexOf(w) === -1) kws.push(w);
    });
    return { name: p.name.trim(), keywords: kws, price: p.price, stock: p.stock };
  });
  shop.shipping = shop.shipping || {};
  shop.shipping.couriers = shop.shipping.couriers || ["JNE REG", "J&T"];
  shop.shipping.cost = (shop.shipping.cost || "Tanya admin untuk ongkir ke kotamu.").trim();
  shop.shipping.freeMin = shop.shipping.freeMin || 0;
  shop.shipping.eta = (shop.shipping.eta || "1-3 hari (Jawa)").trim();
  shop.payment = shop.payment || {};
  shop.payment.methods = shop.payment.methods || ["QRIS", "Transfer bank"];
  shop.payment.note = (shop.payment.note || "Konfirmasi pembayaran dengan kirim bukti transfer ke chat ini.").trim();
  if (shop.demoOrders && typeof shop.demoOrders !== "object") delete shop.demoOrders;
  return shop;
}

function b64urlEncode(str) {
  var b64;
  if (typeof btoa === "function") {
    var bytes = new TextEncoder().encode(str);
    var bin = "";
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    b64 = btoa(bin);
  } else {
    b64 = Buffer.from(str, "utf8").toString("base64");
  }
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s) {
  var b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  if (typeof atob === "function") {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(b64, "base64").toString("utf8");
}

function encodeShop(shop) { return b64urlEncode(JSON.stringify(shop)); }

function decodeShop(code) {
  if (typeof code !== "string" || !code || code.length > 6000) return null;
  try {
    var shop = JSON.parse(b64urlDecode(code));
    if (validateShop(shop).length) return null;
    return normalizeShop(shop);
  } catch (e) { return null; }
}

// ---------- FAQ engine (parameterized by shop) ----------

function rp(n) { return "Rp " + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
function norm(s) { return (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim(); }
function has(msg, words) {
  for (var i = 0; i < words.length; i++) if (msg.indexOf(words[i]) !== -1) return true;
  return false;
}
function findProduct(shop, msg) {
  for (var i = 0; i < shop.products.length; i++) {
    var p = shop.products[i];
    for (var j = 0; j < p.keywords.length; j++) if (msg.indexOf(p.keywords[j]) !== -1) return p;
  }
  return null;
}
function productList(shop) {
  var lines = shop.products.map(function (p) {
    return "- " + p.name + ": " + rp(p.price) + " (stok " + p.stock + ")";
  });
  return "Katalog " + shop.name + ":\n" + lines.join("\n") +
    "\n\nTanya harga atau stok produk tertentu, contoh: \"harga " + shop.products[0].keywords[0] + "\".";
}
function suggestions(shop) {
  var first = shop.products[0];
  return ["Harga " + first.keywords[0] + "?", "Stok " + first.name.split(" ")[0] + "?",
    "Ongkir ke Jakarta?", "Cara bayar?", "Lacak pesanan"];
}
function handoffReply(shop, extra) {
  var admin = shop.adminWa ? ". Atau langsung chat admin di " + shop.adminWa : ".";
  return {
    reply: (extra ? extra + "\n\n" : "") + "Pertanyaan ini saya teruskan ke admin ya kak. Admin online " + shop.hours + admin,
    intent: "handoff", source: "faq"
  };
}

function answer(shop, msg) {
  var m = norm(msg);
  if (!m) return { reply: "Halo kak! Ada yang bisa dibantu? Coba tanya harga, stok, ongkir, cara bayar, atau lacak pesanan.", intent: "greeting", source: "faq" };
  if (has(m, ["admin", "manusia", "orang", "customer service", "cs ", "hubungi", "komplain"])) {
    return { reply: "Siap kak, saya sambungkan ke admin. Admin online " + shop.hours +
      (shop.adminWa ? ". Langsung chat: " + shop.adminWa : ""), intent: "human", source: "faq" };
  }
  if (has(m, ["pesanan", "lacak", "resi", "status", "sudah dikirim", "kapan sampai", "order"])) {
    var found = null;
    if (shop.demoOrders) {
      for (var key in shop.demoOrders) {
        if (m.indexOf(norm(key)) !== -1) { found = shop.demoOrders[key]; break; }
      }
    }
    if (found) return { reply: found, intent: "order_status", source: "faq" };
    return { reply: "Boleh kirim nomor ordernya kak? Nanti saya cekkan statusnya.", intent: "order_status", source: "faq" };
  }
  var product = findProduct(shop, m);
  if (product && has(m, ["harga", "berapa", "brp", "harganya", "price"])) {
    return { reply: product.name + " harganya " + rp(product.price) + " kak. Stok tersedia " + product.stock + " pcs. Mau order? Cara bayar: " + shop.payment.methods.join(", ") + ".", intent: "price", source: "faq" };
  }
  if (product && has(m, ["stok", "ready", "tersedia", "masih ada", "kosong", "abis", "habis"])) {
    var s = product.stock > 0
      ? product.name + " masih ready kak, stok " + product.stock + " pcs, harga " + rp(product.price) + "."
      : product.name + " sedang kosong kak. Bisa tanya admin untuk restock.";
    return { reply: s, intent: "stock", source: "faq" };
  }
  if (product) {
    return { reply: product.name + " — harga " + rp(product.price) + ", stok " + product.stock + " pcs kak. Mau tanya ongkir atau cara bayar?", intent: "product", source: "faq" };
  }
  if (has(m, ["katalog", "daftar", "produk", "list", "apa aja", "jualan apa", "koleksi"])) {
    return { reply: productList(shop), intent: "catalog", source: "faq" };
  }
  if (has(m, ["ongkir", "ongkos kirim", "kirim", "ekspedisi", "jne", "j&t", "anteraja", "berapa lama", "sampainya", "pengiriman"])) {
    var free = shop.shipping.freeMin > 0 ? " Gratis ongkir untuk belanja min " + rp(shop.shipping.freeMin) + "." : "";
    return { reply: "Ongkir: " + shop.shipping.cost + ". Ekspedisi: " + shop.shipping.couriers.join(", ") + "." + free + " Estimasi sampai: " + shop.shipping.eta + ".", intent: "shipping", source: "faq" };
  }
  if (has(m, ["harga", "berapa", "brp", "harganya", "price", "murah", "diskon", "promo"])) {
    var prices = shop.products.map(function (p) { return p.price; });
    return { reply: "Harga mulai " + rp(Math.min.apply(null, prices)) + " sampai " + rp(Math.max.apply(null, prices)) + " kak, tergantung produk. Lihat katalog:\n" + productList(shop), intent: "price", source: "faq" };
  }
  if (has(m, ["stok", "ready", "tersedia", "masih ada", "kosong"])) {
    var low = shop.products.filter(function (p) { return p.stock <= 5; }).map(function (p) { return p.name + " tinggal " + p.stock + " pcs"; });
    return { reply: low.length
      ? "Sebagian produk ready kak, tapi menipis: " + low.join(", ") + ". Mau cek produk apa?"
      : "Semua produk di katalog saat ini ready kak. Mau cek produk apa?", intent: "stock", source: "faq" };
  }
  if (has(m, ["bayar", "pembayaran", "qris", "transfer", "cod", "rekening", "dp", "cara order", "cara beli", "order"])) {
    return { reply: "Pembayaran bisa via " + shop.payment.methods.join(", ") + ". " + shop.payment.note, intent: "payment", source: "faq" };
  }
  if (has(m, ["halo", "hai", "pagi", "siang", "sore", "malam", "assalamu", "permisi", "kak", "bang", "tes", "test"])) {
    return { reply: "Halo kak! Selamat datang di " + shop.name + (shop.city ? " (" + shop.city + ")" : "") + ". Saya bot toko, bisa bantu jawab harga, stok, ongkir, cara bayar, dan lacak pesanan. Mau tanya apa?", intent: "greeting", source: "faq" };
  }
  if (has(m, ["jam", "buka", "alamat", "lokasi", "dimana", "di mana", "tutup"])) {
    return { reply: shop.name + (shop.city ? " di " + shop.city : "") + ", buka " + shop.hours + ". Order online tetap bisa 24 jam lewat chat ini.", intent: "info", source: "faq" };
  }
  return handoffReply(shop, "Maaf kak, pertanyaan itu belum bisa saya jawab.");
}

// ---------- HTTP ----------

function jsonResp(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "content-type": "application/json;charset=utf-8", "access-control-allow-origin": "*" }
  });
}
function htmlResp(html) {
  return new Response(html, { status: 200, headers: { "content-type": "text/html;charset=utf-8", "cache-control": "public, max-age=300" } });
}

async function handle(req) {
  var url = new URL(req.url);
  var path = url.pathname;

  if (req.method === "GET" && path === "/") return htmlResp(BUILDER_HTML);
  if (req.method === "GET" && (path === "/bot" || path === "/demo")) return htmlResp(BOT_HTML);
  if (req.method === "GET" && path === "/api/health") {
    return jsonResp({ ok: true, service: "shopbot-studio", mode: "faq", llm: false, demo: true });
  }
  if (req.method === "GET" && path === "/api/demo-config") {
    return jsonResp({ shop: DEMO_SHOP, code: encodeShop(normalizeShop(DEMO_SHOP)) });
  }
  if (path === "/api/build") {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" } });
    }
    if (req.method !== "POST") return jsonResp({ error: "POST only" }, 405);
    var body;
    try { body = await req.json(); } catch (e) { return jsonResp({ error: "bad json" }, 400); }
    var shop = body && body.shop ? body.shop : body;
    var errs = validateShop(shop);
    if (errs.length) return jsonResp({ ok: false, errors: errs }, 400);
    var normed = normalizeShop(shop);
    var code = encodeShop(normed);
    var base = url.origin;
    return jsonResp({ ok: true, code: code, url: base + "/bot?c=" + code, shop: normed });
  }
  if (path === "/api/chat") {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" } });
    }
    if (req.method !== "POST") return jsonResp({ error: "POST only" }, 405);
    var chatBody;
    try { chatBody = await req.json(); } catch (e) { return jsonResp({ error: "bad json" }, 400); }
    var message = (chatBody && chatBody.message) || "";
    if (typeof message !== "string" || message.length > 500 || !message.trim()) {
      return jsonResp({ error: "message kosong atau terlalu panjang (max 500 karakter)" }, 400);
    }
    var chatShop = null;
    if (chatBody.shop) {
      if (validateShop(chatBody.shop).length) return jsonResp({ error: "config toko tidak valid" }, 400);
      chatShop = normalizeShop(chatBody.shop);
    } else if (chatBody.code) {
      chatShop = decodeShop(chatBody.code);
      if (!chatShop) return jsonResp({ error: "link bot tidak valid" }, 400);
    } else {
      chatShop = normalizeShop(DEMO_SHOP);
    }
    var out = answer(chatShop, message);
    out.suggestions = suggestions(chatShop);
    return jsonResp(out);
  }
  return jsonResp({ error: "not found" }, 404);
}

addEventListener("fetch", function (event) { event.respondWith(handle(event.request)); });
