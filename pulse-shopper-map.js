/* Shopper question map: which public evidence speaks to each question a shopper insights team asks.
   Target user of Pulse: shopper insights in a consumer goods manufacturer.
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
  const LEVELS = { observado: 'compra observada em painel', declarado: 'declaração em pesquisa', mercado: 'indicador de mercado, não por shopper' };
  const LEVEL_ORDER = ['observado', 'declarado', 'mercado'];
  const CONTEXT_TYPES = ['IPCA', 'PMC'];
  const MAP = {
    'kantar-chocolate-brasil-volume-q1-2025': { q: ['quanto', 'preco'], level: 'observado' },
    'kantar-chocolate-brasil-compras-pascoa-2024': { q: ['quanto', 'ocasiao'], level: 'observado' },
    'locomotiva-pascoa-2026-intencao-drivers': { q: ['escolha', 'ocasiao', 'preco'], level: 'declarado' },
    'niq-full-view-2026-price': { q: ['preco', 'escolha'], level: 'declarado' },
    'niq-private-label-global': { q: ['escolha'], level: 'declarado' },
    'niq-ecommerce-2026': { q: ['canal'], level: 'declarado' },
    'worldpanel-ecommerce-2025': { q: ['canal'], level: 'observado' },
    'worldpanel-whatsapp-2025': { q: ['canal'], level: 'observado' },
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
  const entry = e => MAP[String(e && e.id)] || (e && CONTEXT_TYPES.includes(e.tipo) ? { q: [], level: 'mercado' } : null);

  /* For one category ("chocolate") against everything else: per question, the evidence that speaks to it,
     the strongest level among them and the most recent period text. No evidence is a result, not an error. */
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
      return { ...question, category: cell(hit.filter(x => x.e.categoria === category)), general: cell(hit.filter(x => x.e.categoria !== category)) };
    });
  }

  // Which shopper question a typed question is about. Words only; no match means "not classified", shown as such.
  const TERMS = {
    quem: ['quem compra', 'quem sao', 'perfil', 'penetracao', 'classe social', 'faixa etaria', 'publico', 'comprador', 'quantos lares'],
    quanto: ['frequencia', 'quantas vezes', 'unidades por', 'ticket', 'quanto compra', 'compra menos', 'comprando menos', 'volume por lar', 'por viagem'],
    ocasiao: ['ocasiao', 'missao', 'momento de consumo', 'presente', 'pascoa', 'natal', 'dia das', 'sazonal', 'copa'],
    canal: ['canal', 'onde compra', 'onde o shopper', 'atacarejo', 'supermercado', 'e-commerce', 'ecommerce', 'online', 'conveniencia', 'farmacia', 'formato de loja'],
    escolha: ['escolhe', 'escolha', 'fator', 'decide', 'decisao', 'impulso', 'planejad', 'marca', 'embalagem', 'rotulo', 'atributo'],
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

  return { QUESTIONS, LEVELS, LEVEL_ORDER, CONTEXT_TYPES, MAP, entry, coverage, classify };
});
