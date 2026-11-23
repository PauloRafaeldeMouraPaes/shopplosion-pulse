"use strict";
/* Per-EAN price index of a category pilot, built only from the NFC-e captures (Economiza Alagoas, SEFAZ/AL).
   Nothing in the computation is specific to a category: what changes per category is its profile, read from the
   configuration of the pilot (pilot.json): the rules that read brand and manufacturer from the invoice text and the
   definition of its benchmark segment.
   Pure functions: no file access, no dates of the run. Used by scripts/pilot-autonomy.js, which writes
   the price file of each pilot, and by scripts/test-pilot-price-index.js.

   What is computed and what is inferred:
   - Observed in the source: EAN, description on the invoice, store (inscrição estadual), price of the last sale.
   - Computed here: one observation per EAN x store (the most recent sale), median, percentiles, number of stores.
   - Inferred here from the invoice text, never from the source: brand, manufacturer and weight in grams. The output
     says so (brand_inferred) and leaves the field empty when the text does not allow it.
   - Sale unit: the same EAN appears sold by the unit and by the case. An observation more than UNIT_RATIO times above
     or below the EAN median is counted as "another sale unit" and left out of the statistics; the count is kept. */

const UNIT_RATIO = 2.5;
const MIN_STORES_FOR_SPREAD = 10;
const MIN_STORES_FOR_CHANGE = 5;


const plain = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const round2 = n => (Number.isFinite(n) ? Math.round(n * 100) / 100 : null);

function inferBrand(description, rules) {
  const t = plain(description);
  for (const [re, brand, manufacturer] of rules || []) if (re.test(t)) return { brand, manufacturer };
  return { brand: "", manufacturer: "" };
}

// Weight in grams, only when the invoice text states it ("80G", "90 GR", "1KG", "1,01KG").
function inferGrams(description) {
  const t = plain(description);
  const kg = t.match(/(\d{1,2}(?:[.,]\d{1,3})?)\s?KG\b/);
  if (kg) { const g = parseFloat(kg[1].replace(",", ".")) * 1000; return g >= 5 && g <= 5000 ? Math.round(g * 10) / 10 : null; }
  const g = t.match(/(\d{1,4}(?:[.,]\d)?)\s?(?:GRS|GR|G)\b/);
  if (g) { const v = parseFloat(g[1].replace(",", ".")); return v >= 5 && v <= 5000 ? v : null; }
  return null;
}

// Same definition as pandas' default (linear interpolation), on a sorted array.
function quantile(sorted, p) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
const sortedNums = xs => xs.filter(Number.isFinite).sort((a, b) => a - b);

const storeKey = r => r.inscricao_estadual || `${r.loja}|${r.endereco}`;

/* One observation per EAN x store: the most recent sale; ties broken by the lowest price so the result does not
   depend on the order of the rows. Rows without EAN or without a positive price are counted and left out. */
function observationsByEan(records) {
  const pairs = new Map();
  let withoutEan = 0, withoutPrice = 0;
  for (const r of records) {
    const gtin = String(r.gtin || "").trim();
    if (!gtin) { withoutEan++; continue; }
    const price = parseFloat(r.valor_ultima_venda_brl);
    if (!(price > 0)) { withoutPrice++; continue; }
    const key = `${gtin}|${storeKey(r)}`;
    const sold = String(r.ultima_venda_estimada_utc || "");
    const cur = pairs.get(key);
    if (!cur || sold > cur.sold || (sold === cur.sold && price < cur.price)) pairs.set(key, { gtin, store: storeKey(r), price, sold, description: String(r.descricao_nfce || "").trim() });
  }
  const byEan = new Map();
  for (const o of pairs.values()) { if (!byEan.has(o.gtin)) byEan.set(o.gtin, []); byEan.get(o.gtin).push(o); }
  return { byEan, withoutEan, withoutPrice, pairs: pairs.size };
}

function eanStats(observations) {
  const all = sortedNums(observations.map(o => o.price));
  const m0 = quantile(all, 0.5);
  const kept = all.filter(p => p <= m0 * UNIT_RATIO && p >= m0 / UNIT_RATIO);
  const inUnit = p => p <= m0 * UNIT_RATIO && p >= m0 / UNIT_RATIO;
  return { kept, otherUnit: all.length - kept.length, median: quantile(kept, 0.5), inUnit };
}

function mostCommon(values) {
  const count = new Map();
  for (const v of values) if (v) count.set(v, (count.get(v) || 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "";
}

/* The same EAN is typed differently by each store. Brand and grams are the most frequent value among the
   descriptions that state one; the description shown is the most frequent one that states the weight, when any. */
function describe(observations, rules) {
  const texts = observations.map(o => o.description).filter(Boolean);
  const grams = mostCommon(texts.map(t => inferGrams(t)).filter(g => g !== null).map(String));
  const brandKey = mostCommon(texts.map(t => inferBrand(t, rules)).filter(b => b.brand).map(b => `${b.brand}\u0000${b.manufacturer}`));
  const [brand, manufacturer] = brandKey ? brandKey.split("\u0000") : ["", ""];
  const withGrams = grams ? texts.filter(t => String(inferGrams(t)) === grams) : [];
  return { description: mostCommon(withGrams.length ? withGrams : texts), brand, manufacturer, grams: grams ? parseFloat(grams) : null };
}

/* profile: { key, label, generatedBy, brandRules: [[RegExp, brand, manufacturer]], benchmark: { label, minGrams,
   maxGrams, minObservations } }. It comes from the configuration of the pilot (scripts/lib/pilot-config.js, priceProfile).
   In brandRules the order matters: the first rule that matches wins (product lines before the house brand).
   benchmark: a segment of comparable items (by weight) whose price per 100 g is compared across manufacturers. */
function buildPriceIndex(latest, previous, profile) {
  if (!profile || !profile.key || !Array.isArray(profile.brandRules) || !profile.benchmark) throw new Error("buildPriceIndex needs a category profile");
  const bench = profile.benchmark;
  const cur = observationsByEan(latest.records);
  const prev = previous ? observationsByEan(previous.records) : null;
  const stores = new Set();
  for (const r of latest.records) if (String(r.gtin || "").trim()) stores.add(storeKey(r));
  const items = [];
  for (const [gtin, obs] of cur.byEan) {
    const s = eanStats(obs);
    const { description, brand, manufacturer, grams } = describe(obs, profile.brandRules);
    const p10 = quantile(s.kept, 0.1), p90 = quantile(s.kept, 0.9);
    // Change only over the stores that sold the item in both captures, so a different mix of stores is not read as a price move.
    let prevMedian = null, matchedMedian = null, matched = 0;
    if (prev && prev.byEan.has(gtin)) {
      const ps = eanStats(prev.byEan.get(gtin));
      const before = new Map(prev.byEan.get(gtin).filter(o => ps.inUnit(o.price)).map(o => [o.store, o.price]));
      const both = obs.filter(o => s.inUnit(o.price) && before.has(o.store));
      matched = both.length;
      if (matched >= MIN_STORES_FOR_CHANGE) { prevMedian = quantile(sortedNums(both.map(o => before.get(o.store))), 0.5); matchedMedian = quantile(sortedNums(both.map(o => o.price)), 0.5); }
    }
    items.push({
      gtin, description, brand, manufacturer, grams,
      stores: s.kept.length, other_unit_observations: s.otherUnit,
      median_brl: round2(s.median), p10_brl: round2(p10), p90_brl: round2(p90),
      min_brl: round2(s.kept[0]), max_brl: round2(s.kept[s.kept.length - 1]),
      spread_pct: s.kept.length >= MIN_STORES_FOR_SPREAD && p10 > 0 ? Math.round((p90 / p10 - 1) * 1000) / 10 : null,
      price_per_100g_brl: grams ? round2(s.median / grams * 100) : null,
      matched_stores: matched,
      previous_median_brl: round2(prevMedian),
      change_pct: prevMedian > 0 ? Math.round((matchedMedian / prevMedian - 1) * 1000) / 10 : null,
    });
  }
  items.sort((a, b) => b.stores - a.stores || a.gtin.localeCompare(b.gtin));

  // Stores where each manufacturer had at least one sale, over the stores with any identified EAN.
  const makerOf = new Map(items.map(i => [i.gtin, i.manufacturer]));
  const makerStores = new Map();
  for (const r of latest.records) {
    const gtin = String(r.gtin || "").trim(); if (!gtin) continue;
    const item = cur.byEan.get(gtin); if (!item) continue;
    const maker = makerOf.get(gtin); if (!maker) continue;
    if (!makerStores.has(maker)) makerStores.set(maker, new Set());
    makerStores.get(maker).add(storeKey(r));
  }
  const coverage = [...makerStores.entries()].map(([manufacturer, set]) => ({
    manufacturer, stores: set.size, store_share_pct: Math.round(set.size / stores.size * 1000) / 10,
    ean: items.filter(i => i.manufacturer === manufacturer).length,
  })).sort((a, b) => b.stores - a.stores || a.manufacturer.localeCompare(b.manufacturer));

  // Tablets: price per 100 g of each EAN x store observation, grouped by manufacturer.
  const tablet = new Map();
  for (const i of items) {
    if (!i.manufacturer || !i.grams || i.grams < bench.minGrams || i.grams > bench.maxGrams) continue;
    const kept = eanStats(cur.byEan.get(i.gtin)).kept;
    if (!tablet.has(i.manufacturer)) tablet.set(i.manufacturer, { prices: [], ean: 0 });
    const t = tablet.get(i.manufacturer); t.ean++; for (const p of kept) t.prices.push(p / i.grams * 100);
  }
  const tablets = [...tablet.entries()].filter(([, t]) => t.prices.length >= bench.minObservations).map(([manufacturer, t]) => {
    const s = sortedNums(t.prices);
    return { manufacturer, ean: t.ean, observations: s.length, median_per_100g_brl: round2(quantile(s, 0.5)), p10_per_100g_brl: round2(quantile(s, 0.1)), p90_per_100g_brl: round2(quantile(s, 0.9)) };
  }).sort((a, b) => a.median_per_100g_brl - b.median_per_100g_brl || a.manufacturer.localeCompare(b.manufacturer));

  return {
    generated_by: profile.generatedBy || "",
    category: { key: profile.key, label: profile.label },
    source: "Economiza Alagoas (SEFAZ/AL), página pública",
    scope: "Preço da última venda por EAN e loja nos 7 dias antes da captura; não mede volume, participação nem o Brasil",
    capture_date: latest.day, previous_capture_date: previous ? previous.day : null, municipalities: latest.places,
    method: {
      one_observation_per: "EAN x loja (venda mais recente)",
      other_sale_unit_rule: `observação mais de ${String(UNIT_RATIO).replace(".", ",")} vezes acima ou abaixo da mediana do EAN fica fora das estatísticas`,
      spread: `p90 / p10 - 1, só para EAN em ${MIN_STORES_FOR_SPREAD} lojas ou mais`,
      change: `mediana nas lojas que venderam o item nas duas capturas; só com ${MIN_STORES_FOR_CHANGE} lojas ou mais em comum`,
      brand_inferred: true,
      brand_note: "Marca, fabricante e gramatura são lidos do texto da nota fiscal por regra; campo vazio quando o texto não permite",
      benchmark: `EAN de ${bench.minGrams} g a ${bench.maxGrams} g com fabricante identificado; fabricantes com ${bench.minObservations} observações ou mais`,
    },
    totals: {
      rows: latest.records.length, rows_without_ean: cur.withoutEan, rows_without_price: cur.withoutPrice,
      ean: items.length, stores: stores.size, ean_store_pairs: cur.pairs,
      codes_not_gtin_length: items.filter(i => ![8, 12, 13, 14].includes(i.gtin.length)).length,
      ean_with_brand: items.filter(i => i.brand).length, ean_with_grams: items.filter(i => i.grams).length,
      other_unit_observations: items.reduce((n, i) => n + i.other_unit_observations, 0),
    },
    manufacturer_coverage: coverage,
    benchmark: { label: bench.label, rows: tablets },
    items,
  };
}

module.exports = { buildPriceIndex, inferBrand, inferGrams, quantile, observationsByEan, eanStats, describe, UNIT_RATIO };
