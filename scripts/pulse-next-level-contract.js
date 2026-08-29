/* Pulse Next-Level contract helpers. Kept dependency-free so the final single-file build can inline equivalent logic. */
(function (global) {
  'use strict';

  function normalizePeriod(value) {
    if (!value) return null;
    var text = String(value).trim();
    if (!text) return null;
    return text;
  }

  function compareSeries(current, previous) {
    if (!Number.isFinite(Number(current)) || !Number.isFinite(Number(previous))) {
      return { status: 'unavailable', delta: null, deltaPct: null, causal: false };
    }
    var c = Number(current), p = Number(previous);
    var delta = c - p;
    var deltaPct = p === 0 ? null : (delta / Math.abs(p)) * 100;
    return { status: 'observed_change', delta: delta, deltaPct: deltaPct, causal: false };
  }

  function qualityBand(record) {
    var score = Number(record && record.score);
    if (!Number.isFinite(score)) return 'insufficient';
    if (score >= 80) return 'high';
    if (score >= 60) return 'moderate';
    if (score >= 40) return 'low';
    return 'insufficient';
  }

  function categoryRole(category, evidence) {
    return {
      category: category || null,
      role: 'heuristic',
      evidenceCount: Array.isArray(evidence) ? evidence.length : 0,
      claim: 'Heurística: validar com evidência específica antes de decisão.'
    };
  }

  function localEvidence(records) {
    return (Array.isArray(records) ? records : []).map(function (r) {
      return {
        id: r.id || null,
        geography: r.geography || r.region || null,
        source: r.source || null,
        date: r.date || null,
        claim: r.claim || null,
        provenance: r.provenance || null
      };
    });
  }

  global.PULSE_NEXT_LEVEL = {
    normalizePeriod: normalizePeriod,
    compareSeries: compareSeries,
    qualityBand: qualityBand,
    categoryRole: categoryRole,
    localEvidence: localEvidence
  };
})(window);
