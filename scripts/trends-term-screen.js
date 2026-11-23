#!/usr/bin/env node
/* Google Trends term screen of a category pilot (method v2, trends-method-v2.md in the capture kit of the pilot).

   A brand or category search term is only useful as a category signal when most of the searches behind it are
   about the category. A bare brand name can fail that in two ways: the name is also an ordinary word, or the brand
   sells far beyond the category. The screen tests every term column of a captured multiTimeline export against the
   seasonal calendar of the category, declared in the configuration of the pilot (trends.seasonal_calendar): the
   anchor week where demand peaks, the peak windows, and the seasonal band. Nothing here names a category or a date.
   Events are "easter" (Easter Sunday) or "date" (a fixed day of the year); a week is an offset in weeks from the
   week of its event (Trends weeks start on Sunday).

     anchor_lift  = mean of the term's value in the anchor week over the years in the file, divided by the term's
                    median week.                                                                PASS if >= 2.0
     peak_timing  = in every calendar year with at least 40 weeks in the file and a maximum of at least 5, the
                    year's maximum week falls in one of the peak windows.                        PASS if all years
     low_volume   = share of weeks reported as "<1".                                             PASS if <= 0.50

   A term that fails any criterion is FLAGGED: it is not dropped, it is replaced by a scoped combination (see the
   method) or exported on its own, and the flag is recorded with the set. Weeks outside the seasonal band whose
   value is at least 5, at least half the year's maximum and at least twice the median are listed as off-season
   spikes for review; they are not a criterion. "<1" counts as 0.5 in medians and means. The last week of a file is
   excluded when the export happened before that week ended (--exported-at). Values are Google's own
   normalised index, so every metric is a ratio within one column and never compares columns.

   Usage:
     node scripts/trends-term-screen.js [--pilot <key>] --file <multiTimeline.csv> --exported-at 2026-11-03T05:17:41Z [--json out.json]
     node scripts/trends-term-screen.js --self-test
   Exit code 0 whether terms pass or are flagged (the outcome is the report); 1 on a malformed file. */
const fs = require("fs");
const path = require("path");
const { parseExport } = require("./parse-google-trends-export.js");

const CRITERIA = { anchorLiftMin: 2.0, lowVolumeMaxShare: 0.5, fullYearMinWeeks: 40, peakTimingMinMax: 5, spikeShareOfMax: 0.5, spikeTimesMedian: 2, spikeMinValue: 5 };
const DAY = 86400000;

function easterSunday(year) { // Anonymous Gregorian algorithm; returns a UTC timestamp.
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(year, month - 1, day);
}
const iso = ts => new Date(ts).toISOString().slice(0, 10);
const utc = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return Date.UTC(+m[1], +m[2] - 1, +m[3]); };
function weekStartOnOrBefore(ts) { const dow = new Date(ts).getUTCDay(); return ts - dow * DAY; } // Trends weeks start on Sunday

function eventWeek(year, e) {
  if (e.event === "easter") return easterSunday(year) + (e.shift_weeks || 0) * 7 * DAY;
  if (e.event === "date") return weekStartOnOrBefore(Date.UTC(year, e.month - 1, e.day)) + (e.shift_weeks || 0) * 7 * DAY;
  throw new Error(`seasonal calendar: unknown event ${JSON.stringify(e)}`);
}
// calendar: trends.seasonal_calendar of the pilot. anchor: one week; peak_windows and band: lists of week offsets.
function windowsForYear(year, calendar) {
  const weeks = spec => spec.weeks.map(k => eventWeek(year, spec) + k * 7 * DAY);
  return { anchorWeek: eventWeek(year, calendar.anchor), peaks: calendar.peak_windows.map(weeks), band: calendar.band.flatMap(weeks) };
}

function median(values) { const v = values.slice().sort((a, b) => a - b); const n = v.length; return n ? (n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2) : NaN; }

function screenTerm(points, calendar) {
  // points: [{date, value|"<1"}] already restricted to complete weeks, ascending.
  const num = points.map(p => ({ date: p.date, ts: utc(p.date), low: p.value === "<1", v: p.value === "<1" ? 0.5 : p.value }));
  const med = median(num.map(p => p.v));
  const years = [...new Set(num.map(p => new Date(p.ts).getUTCFullYear()))];
  const byYear = Object.fromEntries(years.map(y => [y, windowsForYear(y, calendar)]));
  const anchorValues = years.map(y => num.find(p => p.ts === byYear[y].anchorWeek)).filter(Boolean);
  const anchorLift = anchorValues.length ? anchorValues.reduce((s, p) => s + p.v, 0) / anchorValues.length / med : NaN;
  const inWindow = p => byYear[new Date(p.ts).getUTCFullYear()].peaks.some(w => w.includes(p.ts));
  const inBand = p => byYear[new Date(p.ts).getUTCFullYear()].band.includes(p.ts);
  const peakTiming = [];
  const spikes = [];
  for (const y of years) {
    const ys = num.filter(p => new Date(p.ts).getUTCFullYear() === y);
    const max = ys.reduce((m, p) => p.v > m.v ? p : m, ys[0]);
    // Peak timing needs enough resolution to tell weeks apart: a year whose maximum is below 5 is left unresolved (the low-volume criterion covers it).
    if (ys.length >= CRITERIA.fullYearMinWeeks && max.v >= CRITERIA.peakTimingMinMax) peakTiming.push({ year: y, max_week: max.date, max_value: max.v, in_window: inWindow(max) });
    for (const p of ys) if (!inBand(p) && !p.low && p.v >= CRITERIA.spikeMinValue && p.v >= CRITERIA.spikeShareOfMax * max.v && p.v >= CRITERIA.spikeTimesMedian * med) spikes.push({ week: p.date, value: p.v, year_max: max.v });
  }
  const lowShare = num.filter(p => p.low).length / num.length;
  const reasons = [];
  if (!(anchorLift >= CRITERIA.anchorLiftMin)) reasons.push(`anchor_lift ${Number.isFinite(anchorLift) ? anchorLift.toFixed(2) : "n/a"} < ${CRITERIA.anchorLiftMin}`);
  const badYears = peakTiming.filter(t => !t.in_window);
  if (badYears.length) reasons.push("peak_timing: " + badYears.map(t => `${t.year} max in week ${t.max_week}`).join("; "));
  if (lowShare > CRITERIA.lowVolumeMaxShare) reasons.push(`low_volume ${(lowShare * 100).toFixed(0)}% of weeks "<1"`);
  return { weeks: num.length, median: med, anchor: calendar.anchor.name, anchor_weeks: anchorValues.map(p => ({ week: p.date, value: p.low ? "<1" : p.v })), anchor_lift: Number.isFinite(anchorLift) ? +anchorLift.toFixed(2) : null,
    peak_timing: peakTiming, low_volume_share: +lowShare.toFixed(3), off_season_spikes: spikes, verdict: reasons.length ? "FLAGGED" : "PASS", reasons };
}

function screenFile(text, exportedAt, calendar) {
  if (!calendar || !calendar.anchor) return { errors: ["no seasonal calendar: pass the pilot (--pilot) whose trends.seasonal_calendar applies"] };
  const parsed = parseExport(text);
  if (parsed.errors.length) return { errors: parsed.errors };
  if (parsed.granularity !== "week") return { errors: [`the screen is defined for weekly exports; this file is ${parsed.granularity}ly`] };
  let dates = parsed.dates.slice();
  let droppedPartial = null;
  if (exportedAt) {
    const last = utc(dates[dates.length - 1]);
    if (Date.parse(exportedAt) < last + 7 * DAY) { droppedPartial = dates[dates.length - 1]; dates = dates.slice(0, -1); }
  }
  const terms = parsed.terms.map(t => {
    const points = dates.map(d => { const s = parsed.series.find(x => x.date === d && x.term === t); return { date: d, value: s.value }; });
    return { term: t.label, ...screenTerm(points, calendar) };
  });
  return { criteria: CRITERIA, seasonal_anchor: calendar.anchor.name, category_in_file: parsed.category, weeks_screened: dates.length, dropped_partial_week: droppedPartial, terms };
}

function selfTest() {
  const assert = require("assert");
  assert.strictEqual(iso(easterSunday(2026)), "2026-04-05"); assert.strictEqual(iso(easterSunday(2024)), "2024-03-31"); assert.strictEqual(iso(easterSunday(2022)), "2022-04-17");
  // An invented calendar with the same shape as a real one: anchor on the week before Easter, a second peak at a fixed date.
  const CAL = { anchor: { name: "test-anchor", event: "easter", shift_weeks: -1 },
    peak_windows: [{ event: "easter", shift_weeks: -1, weeks: [-1, 0, 1] }, { event: "date", month: 12, day: 24, weeks: [-1, 0] }],
    band: [{ event: "easter", shift_weeks: -1, weeks: [-3, -2, -1, 0, 1] }, { event: "date", month: 12, day: 24, weeks: [-3, -2, -1, 0] }] };
  assert.strictEqual(iso(windowsForYear(2026, CAL).anchorWeek), "2026-03-29"); assert.strictEqual(iso(windowsForYear(2024, CAL).peaks[1][1]), "2024-12-22");
  // A calendar anchored on a fixed date only (no Easter): the anchor week is the week that holds that day.
  const DATE_ONLY = { anchor: { name: "june", event: "date", month: 6, day: 12 }, peak_windows: [{ event: "date", month: 6, day: 12, weeks: [0] }], band: [{ event: "date", month: 6, day: 12, weeks: [-1, 0] }] };
  assert.strictEqual(iso(windowsForYear(2026, DATE_ONLY).anchorWeek), "2026-06-07");
  assert.ok(screenFile("x", null, null).errors[0].includes("no seasonal calendar"));
  // Synthetic file: "cacau" peaks before Easter and Christmas; "menino" (a common word) is flat; "raro" is mostly "<1".
  const start = utc("2021-10-31"); const rows = ["Categoria: Todas as categorias", "", "Semana,cacau: (Brasil),menino: (Brasil),raro: (Brasil)"];
  for (let i = 0; i < 262; i++) {
    const ts = start + i * 7 * DAY; const y = new Date(ts).getUTCFullYear(); const w = windowsForYear(y, CAL);
    const cacau = ts === w.anchorWeek ? 100 : w.peaks[0].includes(ts) ? 60 : w.peaks[1].includes(ts) ? 55 : 30;
    const menino = ts === w.anchorWeek ? 70 : 60;
    rows.push([iso(ts), cacau, menino, i % 3 ? "<1" : 1].join(","));
  }
  const r = screenFile(rows.join("\n") + "\n", "2026-11-03T05:17:41Z", CAL);
  assert.strictEqual(r.dropped_partial_week, "2026-11-01");
  const [cacau, menino, raro] = r.terms;
  assert.strictEqual(cacau.verdict, "PASS", JSON.stringify(cacau)); assert.ok(cacau.anchor_lift > 3); assert.strictEqual(cacau.anchor, "test-anchor");
  assert.strictEqual(menino.verdict, "FLAGGED"); assert.match(menino.reasons[0], /anchor_lift 1\.17/);
  assert.strictEqual(raro.verdict, "FLAGGED"); assert.ok(raro.reasons.some(x => /low_volume/.test(x)));
  // Peak timing: a term whose 2025 maximum sits in August is flagged even with a strong Easter lift.
  const easter2025 = iso(windowsForYear(2025, CAL).anchorWeek);
  const rows2 = rows.map((line, i) => i < 3 ? line : line.startsWith("2025-08-10") ? line.replace(/^([^,]+),\d+/, "$1,100") : line.startsWith(easter2025) ? line.replace(/^([^,]+),\d+/, "$1,90") : line);
  const r2 = screenFile(rows2.join("\n") + "\n", "2026-11-03T05:17:41Z", CAL);
  assert.strictEqual(r2.terms[0].verdict, "FLAGGED"); assert.match(r2.terms[0].reasons.join(" "), /peak_timing: 2025 max in week 2025-08-10/);
  // Every registered pilot has a calendar the screen can use.
  const { loadPilots } = require("./lib/pilot-config.js");
  for (const p of loadPilots()) { const w = windowsForYear(2026, p.trends.seasonal_calendar); assert.ok(Number.isFinite(w.anchorWeek) && w.peaks.length && w.band.length, p.key); }
  console.log("Trends term screen self-test: PASS (Easter dates, calendar windows, partial-week drop, three criteria on synthetic series, registered calendars)");
}

function main() {
  const a = {}; const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) a[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
  if (a["self-test"]) return selfTest();
  if (!a.file) { console.error("usage: [--pilot <key>] --file <multiTimeline.csv> [--exported-at <ISO UTC>] [--json <report.json>] | --self-test"); process.exit(2); }
  const { getPilot } = require("./lib/pilot-config.js");
  const pilot = getPilot(a.pilot && a.pilot !== "true" ? a.pilot : null);
  const r = screenFile(fs.readFileSync(path.resolve(a.file), "utf8"), a["exported-at"], pilot.trends.seasonal_calendar);
  if (r.errors) { console.error("REJECTED: " + r.errors.join("; ")); process.exit(1); }
  if (a.json) fs.writeFileSync(path.resolve(a.json), JSON.stringify(r, null, 2) + "\n");
  console.log(`${path.basename(a.file)}: ${r.weeks_screened} complete weeks screened${r.dropped_partial_week ? ` (partial week ${r.dropped_partial_week} dropped)` : ""}`);
  for (const t of r.terms) {
    console.log(`  ${t.verdict.padEnd(7)} ${t.term}: anchor_lift (${t.anchor}) ${t.anchor_lift ?? "n/a"} (median ${t.median}), low volume ${(t.low_volume_share * 100).toFixed(0)}%, peak timing ${t.peak_timing.filter(x => x.in_window).length}/${t.peak_timing.length} years in window${t.reasons.length ? "; " + t.reasons.join("; ") : ""}`);
    if (t.off_season_spikes.length) console.log(`          off-season spikes to review: ${t.off_season_spikes.map(s => `${s.week} (${s.value}, year max ${s.year_max})`).join(", ")}`);
  }
}

if (require.main === module) main();
module.exports = { screenFile, screenTerm, easterSunday, windowsForYear, CRITERIA };
