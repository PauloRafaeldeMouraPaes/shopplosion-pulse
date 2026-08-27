const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const failures = [];

function requireText(label, text) {
  if (!html.includes(text)) failures.push(`${label}: missing ${text}`);
}

// Product-level regression guardrails: these are capabilities that must not disappear
// when the monolithic index.html is regenerated or updated.
[
  ['category selector', 'MINHA CATEGORIA'],
  ['all-categories option', 'Todas as categorias'],
  ['category-specific badge', 'Específico da sua categoria'],
  ['general-market badge', 'Sinal geral do mercado'],
  ['opportunity filters', 'data-filter-scope="opportunities"'],
  ['source-status panel', 'Status das Fontes'],
  ['print stylesheet', '@media print'],
  ['persistent history', 'localStorage'],
  ['evidence registry', 'window.PULSE_EVIDENCE'],
  ['source registry', 'window.PULSE_SOURCES'],
  ['last-updated registry', 'window.PULSE_LAST_UPDATED'],
  ['route function', 'function pulseRoute'],
  ['custom answer renderer', 'function pulseRenderCustomAnswer'],
  ['history renderer', 'function pulseRenderHistory'],
  ['history saver', 'function pulseSaveHistory'],
  ['fuzzy matcher', 'function pulseMatchEvidence']
].forEach(([label, text]) => requireText(label, text));

if (/assets\//i.test(html)) failures.push('artifact: contains forbidden assets/ reference');
if (/sessionStorage/i.test(html)) failures.push('artifact: contains forbidden sessionStorage reference');

// Basic HTML balance check for the tags whose corruption would invalidate the artifact.
for (const tag of ['html', 'head', 'body', 'main', 'script']) {
  const open = (html.match(new RegExp(`<${tag}(?:\\s|>)`, 'gi')) || []).length;
  const close = (html.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
  if (open !== close) failures.push(`HTML: unbalanced <${tag}> (${open}/${close})`);
}

// Execute only the evidence-engine script so the matcher is tested against the real data,
// not a reconstructed fixture.
const match = html.match(/<script[^>]*id=["']pulse-evidence-engine["'][^>]*>([\\s\\S]*?)<\\/script>/i);
if (!match) {
  failures.push('evidence engine: script block not found');
} else {
  const context = { window: {} };
  vm.createContext(context);
  try {
    vm.runInContext(match[1], context, { timeout: 1000 });
    const evidence = context.window.PULSE_EVIDENCE;
    const matcher = context.window.pulseMatchEvidence;
    if (!Array.isArray(evidence) || typeof matcher !== 'function') {
      failures.push('evidence engine: PULSE_EVIDENCE or pulseMatchEvidence unavailable');
    } else {
      const cases = [
        ['renda menor', 'confianca-financeira'],
        ['aperto no bolso', 'confianca-financeira'],
        ['packs menores', 'pack'],
        ['onde existe espaço para premium', 'premium'],
        ['quais ocasiões sustentam a compra', 'ocasiao'],
        ['quais canais estão protegendo a categoria', 'canal']
      ];
      for (const [question, expected] of cases) {
        const result = matcher(question);
        const ids = (Array.isArray(result) ? result : []).map(x => x && x.id).filter(Boolean);
        if (!ids.includes(expected)) failures.push(`Ask AI: ${question} -> expected ${expected}; got ${ids.join(', ') || 'no match'}`);
      }

      // Anti-regression guard: the exact financial synonym must outrank pack-only
      // partial matches when the matcher returns scored evidence.
      const result = matcher('renda menor');
      if (Array.isArray(result) && result.length) {
        const top = result[0] && result[0].id;
        if (top !== 'confianca-financeira') failures.push(`Ask AI ranking: renda menor top result is ${top}, expected confianca-financeira`);
      }

      evidence.forEach((item, i) => {
        if (!item || !item.id) failures.push(`PULSE_EVIDENCE[${i}]: missing id`);
        if (!item || !item.categoria) failures.push(`PULSE_EVIDENCE[${i}]: missing categoria`);
        if (!item || !item.proxima_revisao) failures.push(`PULSE_EVIDENCE[${i}]: missing proxima_revisao`);
        if (!item || !Array.isArray(item.keywords)) failures.push(`PULSE_EVIDENCE[${i}]: missing keywords array`);
      });
    }
  } catch (err) {
    failures.push(`evidence engine runtime: ${err.message}`);
  }
}

if (failures.length) {
  console.error('Pulse regression validation FAILED');
  failures.forEach(f => console.error(`- ${f}`));
  process.exit(1);
}

console.log('Pulse regression validation PASSED');
