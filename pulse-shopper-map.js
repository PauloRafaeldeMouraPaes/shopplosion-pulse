/* Shopper question map: which public evidence speaks to each question a shopper insights team asks.
   Target user of Pulse: shopper insights in a consumer goods manufacturer.
   Built for any product category: the categories live in CATEGORIES, never in the pages.
   Every public evidence item that is not an IBGE monthly series must be listed here (scripts/test-shopper-map.js
   fails otherwise), so a new item is classified by a person or agent who read it, never by a keyword guess.
   Levels, strongest first:
     observado: purchases measured in a household or consumer panel
     declarado: what people said in a survey
     mercado:   aggregate market indicator (sales, price, promotion share), not measured per shopper
   An item with no question (q: []) is market context: it does not describe shopper behaviour. */
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.PULSE_SHOPPER = api; })(typeof self !== 'undefined' ? self : this, function () {
  const QUESTIONS = [
    { key: 'quem', label: 'Quem compra', detail: 'penetração e perfil do lar ou do comprador' },
    { key: 'quanto', label: 'Quanto e com que frequência', detail: 'frequência, unidades por viagem e volume por lar' },
    { key: 'ocasiao', label: 'Para qual ocasião ou missão', detail: 'momento de consumo, presente, data sazonal' },
    { key: 'canal', label: 'Onde compra', detail: 'canal e formato de loja' },
    { key: 'escolha', label: 'Como escolhe', detail: 'fatores de escolha, marca, embalagem, impulso ou planejamento' },
    { key: 'preco', label: 'Como reage ao preço', detail: 'embalagem menor, opção mais barata, promoção, saída da categoria' },
  ];
  /* Product categories the workspace can be read by. To add one: add an entry here (key = the `categoria` value its
     evidence items use), add its evidence to the public base, and classify each item in MAP below. Nothing else in
     the pages names a category. `prices` and `pilot` are optional: the per-item price file and the status page of a pilot, when the category has one. */
  const CATEGORIES = [
    { key: 'chocolate', label: 'Chocolate', terms: ['chocolate', 'bombom', 'cacau', 'ovo de pascoa', 'ovos de pascoa'], prices: './pilot-chocolate-prices.json', pilot: './pilot-chocolate.html' },
    { key: 'refrigerantes', label: 'Refrigerantes', terms: ['refrigerante', 'guarana', 'bebida gaseificada', 'soft drink'] },
  ];
  const LEVELS = { observado: 'compra observada em painel', declarado: 'declaração em pesquisa', mercado: 'indicador de mercado, não por shopper' };
  const LEVEL_ORDER = ['observado', 'declarado', 'mercado'];
  const CONTEXT_TYPES = ['IPCA', 'PMC'];
  const MAP = {
    'kantar-chocolate-brasil-volume-q1-2025': { q: ['quanto', 'preco'], level: 'observado' },
    'kantar-chocolate-brasil-compras-pascoa-2024': { q: ['quanto', 'ocasiao'], level: 'observado' },
    'kantar-chocolate-pascoa-2024-lares-canal': { q: ['quem', 'canal', 'ocasiao'], level: 'observado' },
    'kantar-chocolate-classes-4tri-2024': { q: ['quem', 'preco'], level: 'observado' },
    'locomotiva-pascoa-2026-intencao-drivers': { q: ['escolha', 'ocasiao', 'preco'], level: 'declarado' },
    'nexus-chocolate-consumo-perfil-2025': { q: ['quem', 'escolha'], level: 'declarado' },
    'nexus-pascoa-2025-ovos-intencao-presente': { q: ['ocasiao', 'preco'], level: 'declarado' },
    'worldpanel-frequencia-volume-viagem-2t2026': { q: ['quanto', 'ocasiao'], level: 'observado' },
    'worldpanel-classe-c-participacao-fmcg-2t2026': { q: ['quem', 'ocasiao'], level: 'observado' },
    'worldpanel-lares-monoparentais-2025': { q: ['quem'], level: 'observado' },
    'worldpanel-50-mais-gasto-2025': { q: ['quem', 'quanto'], level: 'observado' },
    'worldpanel-repertorio-marcas-classes-2025': { q: ['escolha', 'quem'], level: 'observado' },
    'ifb-chocolate-foodservice-abr2025-mar2026': { q: ['ocasiao', 'canal', 'quem', 'escolha'], level: 'declarado' },
    'varejo360-tabletes-canal-sp-jan-fev-2026': { q: ['canal'], level: 'mercado' },
    'worldpanel-refrigerantes-fora-do-lar-2026': { q: ['canal', 'quanto'], level: 'observado' },
    'neogrid-refrigerantes-zero-2024-2026': { q: ['escolha', 'preco'], level: 'mercado' },
    'niq-refrigerantes-sem-acucar-2026': { q: ['escolha'], level: 'mercado' },
    'niq-full-view-2026-price': { q: ['preco', 'escolha'], level: 'declarado' },
    'niq-private-label-global': { q: ['escolha'], level: 'declarado' },
    'niq-ecommerce-2026': { q: ['canal'], level: 'declarado' },
    'worldpanel-ecommerce-2025': { q: ['canal'], level: 'observado' },
    'worldpanel-whatsapp-2025': { q: ['canal'], level: 'observado' },
    'worldpanel-ecommerce-abastecimento-2026': { q: ['canal', 'ocasiao'], level: 'observado' },
    'niq-ecommerce-vendas-2026': { q: ['canal'], level: 'mercado' },
    'niq-ecommerce-motivos-2026': { q: ['canal', 'preco', 'escolha'], level: 'declarado' },
    'app-delivery-mercado-bebidas-2026': { q: ['canal', 'escolha'], level: 'mercado' },
    'octadesk-opinionbox-redes-compra-online-2026': { q: ['canal', 'escolha'], level: 'declarado' },
    'brain-preco-influenciadores-2025': { q: ['escolha', 'preco', 'quem'], level: 'declarado' },
    'kantar-copa-2026': { q: ['ocasiao'], level: 'declarado' },
    'niq-polarization-brazil': { q: ['preco'], level: 'mercado' },
    'niq-promo-polarization': { q: ['preco'], level: 'mercado' },
    'niq-black-friday-2026': { q: ['ocasiao', 'preco'], level: 'mercado' },
    'niq-full-view-2026-volume': { q: [], level: 'mercado' },
    'abras-cesta-julho': { q: [], level: 'mercado' },
    'abras-consumo-julho': { q: [], level: 'mercado' },
    'scanntech-julho': { q: [], level: 'mercado' },
    'idv-junho': { q: [], level: 'mercado' },
    'idv-julho-2026': { q: [], level: 'mercado' },
    'abicab-chocolate-producao-brasil-2025-pascoa-2026': { q: [], level: 'mercado' },
    'rico-preco-chocolate-barra-bombom-out-2026': { q: [], level: 'mercado' },
    'lei-15404-2026-rotulagem-chocolate': { q: [], level: 'mercado' },
    'google-trends-chocolate-sazonalidade-pascoa-2022-2026': { q: [], level: 'mercado' },
  };
  const plain = v => String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const category = key => CATEGORIES.find(c => c.key === key) || null;
  // Evidence about one registered category; everything else describes the shopper as a whole.
  const isCategoryEvidence = e => !!(e && CATEGORIES.some(c => c.key === e.categoria));
  // Categories of the registry that have at least one evidence item in the given base, in registry order.
  const categoriesIn = evidence => CATEGORIES.filter(c => (Array.isArray(evidence) ? evidence : []).some(e => e && e.categoria === c.key));
  // The category a typed question names, by the registry terms; null when it names none.
  const categoryOf = question => { const t = plain(question); const hit = CATEGORIES.find(c => c.terms.some(w => t.includes(w))); return hit ? hit.key : null; };
  // The category the person is working on: their last choice when still valid, otherwise the first with evidence.
  const STORE_KEY = 'pulse.shopper.category';
  function activeCategory(evidence) {
    const available = categoriesIn(evidence);
    let stored = null;
    try { stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORE_KEY) : null; } catch (e) { stored = null; }
    return (available.find(c => c.key === stored) || available[0] || CATEGORIES[0]).key;
  }
  function setActiveCategory(key) { if (!category(key)) return false; try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORE_KEY, key); } catch (e) { /* storage is a convenience */ } return true; }
  const entry = e => MAP[String(e && e.id)] || (e && CONTEXT_TYPES.includes(e.tipo) ? { q: [], level: 'mercado' } : null);

  /* Two layers per question: `general`, the shopper as a whole (evidence that is not about any registered category),
     and `category`, what is specific to the category read. Evidence of another registered category is in neither:
     it is not about the shopper in general and not about this category. Each cell keeps the evidence that speaks to
     the question, the strongest level among them and their periods. No evidence is a result, not an error. */
  function coverage(evidence, category) {
    const rows = (Array.isArray(evidence) ? evidence : []).map(e => ({ e, m: entry(e) })).filter(x => x.m);
    const cell = list => {
      if (!list.length) return { count: 0, level: null, items: [] };
      const level = LEVEL_ORDER.find(l => list.some(x => x.m.level === l));
      const items = list.slice().sort((a, b) => LEVEL_ORDER.indexOf(a.m.level) - LEVEL_ORDER.indexOf(b.m.level));
      return { count: list.length, level, items: items.map(x => ({ id: String(x.e.id), level: x.m.level, period: String(x.e.periodo || '') })) };
    };
    return QUESTIONS.map(question => {
      const hit = rows.filter(x => x.m.q.includes(question.key));
      return { ...question, general: cell(hit.filter(x => !isCategoryEvidence(x.e))), category: cell(hit.filter(x => x.e.categoria === category)) };
    });
  }

  // Which shopper question a typed question is about. Words only; no match means "not classified", shown as such.
  const TERMS = {
    quem: ['quem compra', 'quem sao', 'perfil', 'penetracao', 'classe social', 'faixa etaria', 'publico', 'comprador', 'quantos lares'],
    quanto: ['frequencia', 'quantas vezes', 'unidades por', 'ticket', 'quanto compra', 'compra menos', 'comprando menos', 'volume por lar', 'por viagem'],
    ocasiao: ['ocasiao', 'missao', 'momento de consumo', 'presente', 'pascoa', 'natal', 'dia das', 'sazonal', 'copa'],
    canal: ['canal', 'onde compra', 'onde o shopper', 'atacarejo', 'supermercado', 'e-commerce', 'ecommerce', 'online', 'conveniencia', 'farmacia', 'formato de loja'],
    escolha: ['escolhe', 'escolha', 'fator', 'decide', 'decisao', 'impulso', 'planejad', 'marca', 'embalagem', 'rotulo', 'atributo', 'prefere', 'preferencia', 'versao', 'variante', 'sabor', 'sem acucar', 'zero', 'light', 'tamanho', 'influenciador', 'rede social', 'redes sociais', 'instagram', 'tiktok', 'youtube', 'avaliac', 'resenha'],
    preco: ['preco', 'caro', 'aumento', 'sobe', 'subiu', 'promocao', 'desconto', 'trocando', 'troca de', 'barato', 'trade down', 'downsizing', 'embalagem menor'],
  };
  const NO_DATA_TERMS = ['participacao de mercado', 'participacao da', 'participacao do', 'market share', 'share de', 'sell-out', 'sell out', 'vendas da marca', 'ranking de marcas', 'lider de mercado'];
  function classify(question) {
    const t = plain(question);
    if (!t.trim()) return { questions: [], noMarketData: false };
    const scored = Object.keys(TERMS).map(key => ({ key, n: TERMS[key].filter(w => t.includes(w)).length })).filter(x => x.n > 0)
      .sort((a, b) => b.n - a.n || QUESTIONS.findIndex(q => q.key === a.key) - QUESTIONS.findIndex(q => q.key === b.key));
    return { questions: scored.slice(0, 2).map(x => x.key), noMarketData: NO_DATA_TERMS.some(w => t.includes(w)) };
  }

  /* Deterministic reading of the evidence a person selected, for the public Investigação (no AI involved).
     It only restates facts and the limits each item declares (nao_representa); it never infers a cause.
     Returns the text and the evidence in the order it is cited ([E1], [E2], ...). */
  const shortPeriod = p => String(p || '').split(';')[0].trim();
  const upperFirst = t => t.charAt(0).toUpperCase() + t.slice(1);
  function reading(question, selected, allEvidence, categoryKey) {
    const name = ((category(categoryKey) || {}).label || String(categoryKey || '')).toLowerCase();
    const rows = (Array.isArray(selected) ? selected : []).filter(Boolean).map((e, i) => ({ e, i, m: entry(e) || { q: [], level: 'mercado' } }));
    // Two layers: the category read first, then the shopper as a whole; another registered category is said to be one and comes last.
    const layer = e => (categoryKey && e.categoria === categoryKey) ? 0 : isCategoryEvidence(e) ? 2 : 1;
    const layerName = e => { const l = layer(e); if (l === 0) return (category(categoryKey) || {}).label || 'Categoria'; if (l === 1) return 'Shopper em geral'; return `Outra categoria (${(category(e.categoria) || {}).label || e.categoria}), não vale para ${name || 'a categoria lida'}`; };
    const ordered = rows.slice().sort((a, b) => layer(a.e) - layer(b.e) || LEVEL_ORDER.indexOf(a.m.level) - LEVEL_ORDER.indexOf(b.m.level) || a.i - b.i).slice(0, 4);
    if (!ordered.length) return { text: '', ordered: [] };
    const levels = new Set(ordered.map(x => x.m.level));
    const asked = classify(question).questions;
    const cov = coverage(allEvidence, categoryKey);
    const gaps = asked.map(k => cov.find(r => r.key === k)).filter(r => r && !r.category.count).map(r => r.label.toLowerCase());
    const leitura = ordered.map((x, n) => `[E${n + 1}] ${layerName(x.e)}: ${LEVELS[x.m.level]}${shortPeriod(x.e.periodo) ? ' (' + shortPeriod(x.e.periodo) + ')' : ''}: ${String(x.e.fato || '').trim()}`).join('\n');
    const marketNote = ' Os indicadores de mercado dão o contexto de preço, vendas ou oferta, não o comportamento do shopper.';
    const hipotese = levels.has('observado') && levels.has('declarado')
      ? 'Há compra observada e declaração entre as evidências. A declaração mostra o que as pessoas dizem; só a compra observada mostra o que fizeram. Nenhuma das duas prova, sozinha, a causa da mudança.' + (levels.has('mercado') ? marketNote : '')
      : levels.has('observado') ? 'A compra observada mostra o que mudou, não por que mudou.' + (levels.has('mercado') ? marketNote : '')
      : levels.has('declarado') && levels.has('mercado') ? 'A leitura junta declaração e indicadores de mercado, sem compra observada: mostra intenção, percepção e contexto de mercado, não compra realizada.'
      : levels.has('declarado') ? 'A leitura se apoia só em declaração: mostra intenção e percepção, não compra realizada.'
      : 'As evidências selecionadas são indicadores de mercado: descrevem preço, vendas ou oferta, não o comportamento de um shopper.';
    const recomendacao = gaps.length
      ? `Antes de concluir, buscar evidência de ${name} para: ${gaps.join('; ')}.`
      : 'Confrontar esta leitura com um estudo próprio de shopper ou com o painel da categoria antes de decidir.';
    const limits = ordered.map((x, n) => (x.e.nao_representa ? `[E${n + 1}] ${String(x.e.nao_representa).trim().replace(/\.$/, '')}.` : '')).filter(Boolean).join(' ');
    const desconhecidos = (limits || 'As evidências selecionadas não declaram seus limites.') + (gaps.length ? ` A base não tem evidência de ${name} para: ${gaps.join('; ')}.` : '');
    const text = `LEITURA: ${leitura}\n\nHIPÓTESE: ${hipotese}\n\nRECOMENDAÇÃO: ${recomendacao}\n\nDESCONHECIDOS: ${desconhecidos}\n\nATUALIZAÇÃO: INSUFFICIENT: leitura baseada nas evidências públicas selecionadas.`;
    return { text, ordered: ordered.map(x => x.e) };
  }

  return { QUESTIONS, CATEGORIES, isCategoryEvidence, LEVELS, LEVEL_ORDER, CONTEXT_TYPES, MAP, entry, coverage, classify, reading, category, categoriesIn, categoryOf, activeCategory, setActiveCategory };
});
