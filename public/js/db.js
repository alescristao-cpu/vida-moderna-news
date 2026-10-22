/**
 * Vida Moderna News - Camada Offline-First & Sincronização 100% Automática via Nuvem (Supabase + GitHub Pages)
 *
 * Permite que o Painel Administrativo (hospedado gratuitamente no GitHub Pages) e o aparelho
 * Aquarius STV-Plus (no elevador do condomínio) funcionem em redes de internet totalmente diferentes!
 * - Sincroniza via Supabase REST API (gratuito) a cada 5 segundos quando há Wi-Fi
 * - Sincroniza via GitHub Pages (data/state.json) ou Servidor Local (opcional)
 * - Busca automática de notícias por Temas de Interesse com Filtro de Classificação Familiar [Livre]
 */

var FALA_STORAGE_KEY = 'vidamoderna_state_v3';
var FALA_DEVICE_CFG_KEY = 'vidamoderna_device_cfg_v1';
var FALA_MEDIA_CACHE = 'vidamoderna-media-cache-v1';
var AUTO_SYNC_INTERVAL_MS = 5000;
var RSS_AUTO_REFRESH_MS = 5 * 60 * 1000;

var NEWS_THEMES_CATALOG = {
  tecnologia: {
    id: 'tecnologia',
    nome: 'Tecnologia & Inovação',
    url: 'https://g1.globo.com/rss/g1/tecnologia/',
    fonte: 'G1 • TECNOLOGIA',
    cor: '#0d74b8',
    icone: '💻'
  },
  ciencia_saude: {
    id: 'ciencia_saude',
    nome: 'Ciência & Saúde',
    url: 'https://g1.globo.com/rss/g1/ciencia-e-saude/',
    fonte: 'G1 • SAÚDE & CIÊNCIA',
    cor: '#2a5e35',
    icone: '🧬'
  },
  bemestar: {
    id: 'bemestar',
    nome: 'Vida Saudável & Bem-Estar',
    url: 'https://g1.globo.com/rss/g1/bemestar/',
    fonte: 'G1 • BEM-ESTAR',
    cor: '#16a34a',
    icone: '🌿'
  },
  turismo: {
    id: 'turismo',
    nome: 'Turismo & Viagem',
    url: 'https://g1.globo.com/rss/g1/turismo-e-viagem/',
    fonte: 'G1 • TURISMO',
    cor: '#0284c7',
    icone: '✈️'
  },
  natureza: {
    id: 'natureza',
    nome: 'Meio Ambiente & Natureza',
    url: 'https://g1.globo.com/rss/g1/natureza/',
    fonte: 'G1 • NATUREZA',
    cor: '#15803d',
    icone: '🌎'
  },
  economia: {
    id: 'economia',
    nome: 'Economia & Finanças',
    url: 'https://g1.globo.com/rss/g1/economia/',
    fonte: 'G1 • ECONOMIA',
    cor: '#d97706',
    icone: '📈'
  },
  educacao: {
    id: 'educacao',
    nome: 'Educação & Carreira',
    url: 'https://g1.globo.com/rss/g1/educacao/',
    fonte: 'G1 • EDUCAÇÃO',
    cor: '#4f46e5',
    icone: '🎓'
  },
  cultura: {
    id: 'cultura',
    nome: 'Cultura, Música & Cinema',
    url: 'https://g1.globo.com/rss/g1/pop-arte/',
    fonte: 'G1 • CULTURA & ARTE',
    cor: '#9333ea',
    icone: '🎬'
  },
  carros: {
    id: 'carros',
    nome: 'Carros & Mobilidade',
    url: 'https://g1.globo.com/rss/g1/carros/',
    fonte: 'G1 • AUTOMÓVEIS',
    cor: '#0f766e',
    icone: '🚗'
  },
  geral: {
    id: 'geral',
    nome: 'Brasil & Atualidades',
    url: 'https://g1.globo.com/rss/g1/',
    fonte: 'G1 • BRASIL',
    cor: '#5bb75b',
    icone: '📰'
  }
};

var STRICT_FAMILY_BLOCKED_TERMS = [
  'morte', 'morto', 'morta', 'morre', 'morrem', 'morreu', 'assassin', 'homicid', 'homicíd',
  'feminicid', 'feminicíd', 'crime', 'criminos', 'tiroteio', 'tiro', 'balead', 'facad',
  'esfaque', 'arma', 'fuzil', 'pistola', 'assalto', 'assaltante', 'roubo', 'furto', 'sequestr',
  'refem', 'refém', 'policia', 'polícia', 'policial', 'preso', 'presa', 'prisao', 'prisão',
  'cadeia', 'presidio', 'presídio', 'detento', 'trafico', 'tráfico', 'traficante', 'droga',
  'cocaina', 'cocaína', 'maconha', 'crack', 'entorpecente', 'massacre', 'chacina', 'terroris',
  'bomba', 'explosao', 'explosão', 'cadaver', 'cadáver', 'corpo encontrado', 'necropsia',
  'delegacia', 'suspeito', 'foragido', 'faccao', 'facção', 'milicia', 'milícia', 'latrocinio',
  'latrocínio', 'estupr', 'abuso', 'assedio', 'assédio', 'pedofil', 'porn', 'sexo', 'sexual',
  'nudez', 'erotic', 'erótic', 'prostitui', 'suicid', 'suicíd', 'se matou', 'tragedia',
  'tragédia', 'acidente grave', 'vitima fatal', 'vítima fatal', 'afogamento', 'desabamento',
  'atropelad', 'tortura', 'espancad', 'agressao', 'agressão', 'agredid', 'sangue', 'violencia',
  'violência', 'guerra', 'bombardeio', 'execucao', 'execução', 'executad', 'linchamento'
];

var MODERATE_FAMILY_BLOCKED_TERMS = [
  'assassin', 'homicid', 'homicíd', 'feminicid', 'feminicíd', 'chacina', 'massacre',
  'estupr', 'pedofil', 'porn', 'sexo', 'sexual', 'nudez', 'erotic', 'erótic', 'prostitui',
  'suicid', 'suicíd', 'se matou', 'tortura', 'decapit', 'esquartej'
];

function isFamilySafeNews(title, description, filterLevel, customBlockedCsv) {
  var lvl = filterLevel || 'rigoroso';
  if (lvl === 'desativado') return true;
  var text = ((title || '') + ' ' + (description || '')).toLowerCase();

  var terms = lvl === 'moderado' ? MODERATE_FAMILY_BLOCKED_TERMS : STRICT_FAMILY_BLOCKED_TERMS;
  for (var i = 0; i < terms.length; i++) {
    if (text.indexOf(terms[i]) !== -1) return false;
  }

  if (customBlockedCsv && customBlockedCsv.trim()) {
    var customList = customBlockedCsv.split(/[,;\n]+/);
    for (var j = 0; j < customList.length; j++) {
      var clean = customList[j].trim().toLowerCase();
      if (clean.length >= 2 && text.indexOf(clean) !== -1) {
        return false;
      }
    }
  }
  return true;
}

var DEFAULT_STATE = {
  version: 3,
  updatedAt: '2026-10-22T10:52:00-03:00',
  lastRssSyncAt: 0,
  config: {
    condominioNome: 'Modern Life Residence',
    condominioCodigo: 'MODERN-LIFE',
    telefoneSuporte: 'Vida Moderna News',
    duracaoPadraoSegundos: 15,
    tempoAssinaturaSegundos: 5,
    intervaloRecadosSegundos: 10,
    rssAtivo: true,
    rssTemas: ['tecnologia', 'ciencia_saude', 'turismo', 'cultura'],
    temaPersonalizado: '',
    filtroFamiliarNivel: 'rigoroso',
    palavrasBloqueadas: '',
    apenasComFoto: true,
    limiteNoticias: 10,
    intercalarNoticias: true,
    ultimoFiltroStats: {
      analisadas: 31,
      bloqueadas: 7,
      aprovadas: 10,
      atualizadoEm: 'Automático'
    }
  },
  recados: [
    {
      id: 'rec-1',
      titulo: 'INFORMAÇÕES DO CONDOMÍNIO',
      corEtiqueta: '#2a5e35',
      texto: 'Pedimos a atenção de todos com suas crianças para não lançarem brinquedos e objetos pelas janelas e varandas, evitando acidentes.',
      ativo: true,
      condominio: 'TODOS',
      criadoEm: '2026-10-22T08:30:00-03:00'
    },
    {
      id: 'rec-2',
      titulo: 'INFORMAÇÕES DO CONDOMÍNIO',
      corEtiqueta: '#2a5e35',
      texto: 'Lembramos aos moradores que o horário permitido para mudanças e entregas de grande porte é de segunda a sexta, das 08h às 17h, e aos sábados das 08h às 12h.',
      ativo: true,
      condominio: 'TODOS',
      criadoEm: '2026-10-22T08:35:00-03:00'
    },
    {
      id: 'rec-3',
      titulo: 'MANUTENÇÃO PREVENTIVA',
      corEtiqueta: '#1468b3',
      texto: 'Nesta quinta-feira (das 09h às 11h) será realizada a limpeza periódica dos reservatórios superiores. Recomendamos economia de água durante o período.',
      ativo: true,
      condominio: 'TODOS',
      criadoEm: '2026-10-22T08:40:00-03:00'
    }
  ],
  midias: [
    {
      id: 'mid-1',
      tipo: 'cartela',
      titulo: 'Vida Moderna News - Modern Life Residence (Cartela 1280x520)',
      cliente: 'Vida Moderna News',
      url: 'assets/cartela-exemplo-1.svg',
      duracao: 15,
      assinaturaSegundos: 5,
      dimensoes: '1280x520px (72dpi)',
      ativo: true,
      condominio: 'TODOS',
      criadoEm: '2026-10-22T08:00:00-03:00'
    }
  ],
  noticias: [
    {
      id: 'not-e3ffce97',
      fonte: 'G1 • TECNOLOGIA',
      corBarra: '#0d74b8',
      titulo: 'Celular, comparação e diálogo: os desafios de educar adolescentes em uma geração hiperconectada',
      imagemUrl: 'https://s2-g1.glbimg.com/ffu1EwWcJ6skS_Y_mW4FUk5-Mno=/i.s3.glbimg.com/v1/AUTH_59edd422c0c84a879bd37670ae4f538a/internal_photos/bs/2026/8/Z/ISwY2KRVGdHAAlq1GAWg/sweetlouise-woman-3236059.jpg',
      publicadoEm: 'Thu, 22 Oct 2026 06:00:00 -0000',
      ativo: true
    },
    {
      id: 'not-3d455dc0',
      fonte: 'G1 • SAÚDE & CIÊNCIA',
      corBarra: '#2a5e35',
      titulo: "'Ciência Aberta': centro que abriga o Sirius recebe público para apresentar curiosidades e atrações da ciência",
      imagemUrl: 'https://s2-g1.glbimg.com/kKUdrY29MpZWo_veboJUOdZ1dnM=/i.s3.glbimg.com/v1/AUTH_59edd422c0c84a879bd37670ae4f538a/internal_photos/bs/2020/0/Z/0MdzrrRtyHwZFyLq5f6g/fachadasirius.creditonelsonkon.jpg',
      publicadoEm: 'Fri, 09 Aug 2024 09:49:43 -0000',
      ativo: true
    },
    {
      id: 'not-5473ffee',
      fonte: 'G1 • CULTURA & ARTE',
      corBarra: '#9333ea',
      titulo: 'Atriz Judi Dench afirma que piora da visão a impede de continuar atuando',
      imagemUrl: 'https://s2-g1.glbimg.com/E6w8SzaWelqOwm4zxccxCYoNdyE=/i.s3.glbimg.com/v1/AUTH_59edd422c0c84a879bd37670ae4f538a/internal_photos/bs/2022/s/i/g2BmTMQDO8nafBlXqMjA/judi-dench-the-crown-reuters.jpg',
      publicadoEm: 'Thu, 22 Oct 2026 12:48:56 -0000',
      ativo: true
    },
    {
      id: 'not-2d8f6670',
      fonte: 'G1 • CULTURA & ARTE',
      corBarra: '#9333ea',
      titulo: "Zélia Duncan oferece 'Pan y leche' em single no rastro do êxito da música de Maurício Pereira no show 'Agudo grave'",
      imagemUrl: 'https://s2-g1.glbimg.com/5Ba0hDdEUqYwbJjVPQYmtwGPc34=/i.s3.glbimg.com/v1/AUTH_59edd422c0c84a879bd37670ae4f538a/internal_photos/bs/2026/8/P/s5NlwLSbGaKO0UqrjyFw/zeliapanlechefoto.jpg',
      publicadoEm: 'Thu, 22 Oct 2026 10:58:05 -0000',
      ativo: true
    }
  ]
};

function VidaModernaSyncManager() {
  var self = this;
  this.listeners = [];
  this.statusListeners = [];
  this.isSyncing = false;
  this.wasOffline = !navigator.onLine;
  this.autoSyncTimer = null;
  this.themesCatalog = NEWS_THEMES_CATALOG;

  this.channel = typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('vidamoderna_realtime_channel')
    : null;

  if (this.channel) {
    this.channel.onmessage = function (ev) {
      if (ev.data && ev.data.type === 'STATE_UPDATED') {
        var state = self.getLocalState();
        self.notifyListeners(state, 'broadcast');
      }
    };
  }

  window.addEventListener('storage', function (ev) {
    if (ev.key === FALA_STORAGE_KEY && ev.newValue) {
      try {
        var parsed = JSON.parse(ev.newValue);
        self.notifyListeners(parsed, 'storage');
      } catch (e) {}
    }
  });
}

VidaModernaSyncManager.prototype.isFamilySafe = function (title, desc, level, customBlocked) {
  return isFamilySafeNews(title, desc, level, customBlocked);
};

VidaModernaSyncManager.prototype.startAutoSyncDaemon = function () {
  var self = this;
  if (this.autoSyncTimer) clearInterval(this.autoSyncTimer);

  this.syncFromServer(true);

  this.autoSyncTimer = setInterval(function () {
    var justReconnected = self.wasOffline && navigator.onLine;
    self.wasOffline = !navigator.onLine;
    self.syncFromServer(justReconnected);
  }, AUTO_SYNC_INTERVAL_MS);

  window.addEventListener('online', function () {
    self.wasOffline = false;
    self.updateServiceWorkerAutomatically();
    self.syncFromServer(true);
  });

  window.addEventListener('offline', function () {
    self.wasOffline = true;
    self.notifyStatus('offline', 'Elevador Offline (Cache Ativo)');
  });

  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn && typeof conn.addEventListener === 'function') {
    conn.addEventListener('change', function () {
      if (navigator.onLine) {
        self.updateServiceWorkerAutomatically();
        self.syncFromServer(true);
      }
    });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      self.syncFromServer(true);
    }
  });

  window.triggerWifiSync = function () {
    self.updateServiceWorkerAutomatically();
    return self.syncFromServer(true);
  };
};

VidaModernaSyncManager.prototype.updateServiceWorkerAutomatically = function () {
  if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistration) {
    navigator.serviceWorker.getRegistration().then(function (reg) {
      if (reg && reg.update) reg.update();
    }).catch(function () {});
  }
};

VidaModernaSyncManager.prototype.getDeviceConfig = function () {
  var cloudDefaults = window.VIDA_MODERNA_CLOUD || {};
  var def = {
    serverUrl: (window.location.origin && window.location.origin.indexOf('http') === 0) ? window.location.origin : '',
    supabaseUrl: cloudDefaults.supabaseUrl || '',
    supabaseAnonKey: cloudDefaults.supabaseAnonKey || '',
    githubPagesUrl: cloudDefaults.githubPagesUrl || '',
    condominioFilter: 'TODOS',
    lastWifiSync: null
  };

  try {
    var raw = localStorage.getItem(FALA_DEVICE_CFG_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      return {
        serverUrl: parsed.serverUrl || def.serverUrl,
        supabaseUrl: parsed.supabaseUrl || def.supabaseUrl,
        supabaseAnonKey: parsed.supabaseAnonKey || def.supabaseAnonKey,
        githubPagesUrl: parsed.githubPagesUrl || def.githubPagesUrl,
        condominioFilter: parsed.condominioFilter || 'TODOS',
        lastWifiSync: parsed.lastWifiSync || null
      };
    }
  } catch (e) {}
  return def;
};

VidaModernaSyncManager.prototype.saveDeviceConfig = function (cfg) {
  var current = this.getDeviceConfig();
  var merged = {
    serverUrl: cfg.serverUrl !== undefined ? cfg.serverUrl : current.serverUrl,
    supabaseUrl: cfg.supabaseUrl !== undefined ? cfg.supabaseUrl : current.supabaseUrl,
    supabaseAnonKey: cfg.supabaseAnonKey !== undefined ? cfg.supabaseAnonKey : current.supabaseAnonKey,
    githubPagesUrl: cfg.githubPagesUrl !== undefined ? cfg.githubPagesUrl : current.githubPagesUrl,
    condominioFilter: cfg.condominioFilter !== undefined ? cfg.condominioFilter : current.condominioFilter,
    lastWifiSync: cfg.lastWifiSync !== undefined ? cfg.lastWifiSync : current.lastWifiSync
  };
  localStorage.setItem(FALA_DEVICE_CFG_KEY, JSON.stringify(merged));
  return merged;
};

VidaModernaSyncManager.prototype.getLocalState = function () {
  try {
    var raw = localStorage.getItem(FALA_STORAGE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed.config && !Array.isArray(parsed.config.rssTemas)) {
        parsed.config.rssTemas = ['tecnologia', 'ciencia_saude', 'turismo', 'cultura'];
      }
      if (parsed.config && !parsed.config.filtroFamiliarNivel) {
        parsed.config.filtroFamiliarNivel = 'rigoroso';
      }
      return parsed;
    }
  } catch (e) {}
  this.saveLocalState(DEFAULT_STATE, false);
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
};

VidaModernaSyncManager.prototype.saveLocalState = function (state, broadcast) {
  try {
    localStorage.setItem(FALA_STORAGE_KEY, JSON.stringify(state));
    if (broadcast !== false && this.channel) {
      this.channel.postMessage({ type: 'STATE_UPDATED', version: state.version });
    }
  } catch (e) {}
};

VidaModernaSyncManager.prototype.onStateChange = function (cb) {
  this.listeners.push(cb);
};

VidaModernaSyncManager.prototype.onSyncStatus = function (cb) {
  this.statusListeners.push(cb);
};

VidaModernaSyncManager.prototype.notifyListeners = function (state, origin) {
  for (var i = 0; i < this.listeners.length; i++) {
    try { this.listeners[i](state, origin); } catch (e) {}
  }
};

VidaModernaSyncManager.prototype.notifyStatus = function (status, detail) {
  for (var i = 0; i < this.statusListeners.length; i++) {
    try { this.statusListeners[i](status, detail); } catch (e) {}
  }
};

VidaModernaSyncManager.prototype.cacheMediaAssetsOffline = async function (state) {
  if (!('caches' in window)) return;
  try {
    var cache = await caches.open(FALA_MEDIA_CACHE);
    var urlsToCache = [];

    var midias = state.midias || [];
    for (var i = 0; i < midias.length; i++) {
      if (midias[i].ativo && midias[i].url && midias[i].url.indexOf('data:') !== 0) {
        urlsToCache.push(midias[i].url);
      }
    }

    var noticias = state.noticias || [];
    for (var j = 0; j < noticias.length; j++) {
      if (noticias[j].ativo && noticias[j].imagemUrl && noticias[j].imagemUrl.indexOf('data:') !== 0) {
        urlsToCache.push(noticias[j].imagemUrl);
      }
    }

    for (var k = 0; k < urlsToCache.length; k++) {
      try {
        var rawUrl = urlsToCache[k];
        var cached = await cache.match(rawUrl);
        if (!cached) {
          var response = await fetch(rawUrl, { mode: 'no-cors', cache: 'reload' });
          if (response) await cache.put(rawUrl, response);
        }
      } catch (err) {}
    }
  } catch (e) {}
};

/**
 * Busca estado no Supabase via REST API (Redes Separadas / Nuvem Gratuita)
 */
VidaModernaSyncManager.prototype.fetchFromSupabase = async function (sbUrl, sbKey) {
  var cfg = this.getDeviceConfig();
  var cleanUrl = ((sbUrl || cfg.supabaseUrl) || '').replace(/\/+$/, '');
  var keyToUse = sbKey || cfg.supabaseAnonKey || '';
  if (!cleanUrl || !keyToUse) return null;

  var endpoint = cleanUrl + '/rest/v1/vidamoderna_sync?id=eq.main&select=payload';

  if (window.AndroidNative && typeof window.AndroidNative.fetchSupabaseState === 'function') {
    var rawResp = window.AndroidNative.fetchSupabaseState(endpoint, keyToUse);
    if (rawResp && rawResp.indexOf('[') === 0) {
      var rows = JSON.parse(rawResp);
      if (rows && rows.length > 0 && rows[0].payload) {
        return rows[0].payload;
      }
    }
  }

  var headers = {
    'apikey': keyToUse,
    'Accept': 'application/json'
  };
  if (keyToUse.indexOf('eyJ') === 0) {
    headers['Authorization'] = 'Bearer ' + keyToUse;
  }

  var res = await fetch(endpoint, {
    method: 'GET',
    headers: headers,
    cache: 'no-store'
  });

  if (res.ok) {
    var data = await res.json();
    if (Array.isArray(data) && data.length > 0 && data[0].payload) {
      return data[0].payload;
    }
  }
  return null;
};

/**
 * Envia o estado atualizado do Painel Administrativo para o Supabase (Redes Separadas / Nuvem)
 */
VidaModernaSyncManager.prototype.pushToSupabase = async function (sbUrlOrState, sbKey, stateObj) {
  var cfg = this.getDeviceConfig();
  var cleanUrl = '';
  var keyToUse = '';
  var payloadObj = null;

  if (typeof sbUrlOrState === 'object' && sbUrlOrState !== null) {
    cleanUrl = (cfg.supabaseUrl || '').replace(/\/+$/, '');
    keyToUse = cfg.supabaseAnonKey || '';
    payloadObj = sbUrlOrState;
  } else {
    cleanUrl = ((sbUrlOrState || cfg.supabaseUrl) || '').replace(/\/+$/, '');
    keyToUse = sbKey || cfg.supabaseAnonKey || '';
    payloadObj = stateObj;
  }

  if (!cleanUrl || !keyToUse || !payloadObj) return false;
  var endpoint = cleanUrl + '/rest/v1/vidamoderna_sync?on_conflict=id';

  var headers = {
    'apikey': keyToUse,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=minimal'
  };
  if (keyToUse.indexOf('eyJ') === 0) {
    headers['Authorization'] = 'Bearer ' + keyToUse;
  }

  var res = await fetch(endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      id: 'main',
      payload: payloadObj,
      updated_at: new Date().toISOString()
    })
  });

  return res.ok;
};

/**
 * Aplica e salva um estado remoto caso haja novidade
 */
VidaModernaSyncManager.prototype.processIncomingRemoteState = async function (remoteState, sourceLabel) {
  var localState = this.getLocalState();
  var now = Date.now();
  remoteState.lastRssSyncAt = now;

  if (Array.isArray(remoteState.noticias)) {
    var nivel = (remoteState.config && remoteState.config.filtroFamiliarNivel) ? remoteState.config.filtroFamiliarNivel : 'rigoroso';
    var customBlk = (remoteState.config && remoteState.config.palavrasBloqueadas) ? remoteState.config.palavrasBloqueadas : '';
    remoteState.noticias = remoteState.noticias.filter(function (n) {
      return isFamilySafeNews(n.titulo, '', nivel, customBlk);
    });
  }

  var hasChanges = !localState ||
    Number(remoteState.version) !== Number(localState.version) ||
    remoteState.updatedAt !== localState.updatedAt ||
    JSON.stringify(remoteState.recados) !== JSON.stringify(localState.recados) ||
    JSON.stringify(remoteState.midias) !== JSON.stringify(localState.midias) ||
    JSON.stringify(remoteState.noticias) !== JSON.stringify(localState.noticias);

  if (hasChanges) {
    this.notifyStatus('syncing', 'Baixando atualização (' + sourceLabel + ')...');
    this.saveLocalState(remoteState, false);
    await this.cacheMediaAssetsOffline(remoteState);
    this.notifyListeners(remoteState, 'cloud-sync');
  }

  var d = new Date();
  var nowStr = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  this.saveDeviceConfig({ lastWifiSync: d.toISOString() });
  this.notifyStatus('online', sourceLabel + ' (' + nowStr + ')');
  return hasChanges;
};

/**
 * Sincronização 100% automática:
 * 1. Nuvem Supabase (Redes diferentes entre PC/Celular e Aquarius STV-Plus!)
 * 2. Nuvem GitHub Pages (data/state.json)
 * 3. Servidor Local (opcional)
 * 4. Busca Direta de Notícias G1 com Filtro Familiar
 */
VidaModernaSyncManager.prototype.syncFromServer = async function (forceRssCheck) {
  if (this.isSyncing) return { synced: false, reason: 'busy' };

  if (!navigator.onLine) {
    this.notifyStatus('offline', 'Elevador Offline (Cache Local)');
    return { synced: false, reason: 'offline' };
  }

  this.isSyncing = true;
  var deviceCfg = this.getDeviceConfig();
  var localState = this.getLocalState();
  var now = Date.now();
  var rssNeedsRefresh = forceRssCheck || !localState.lastRssSyncAt || (now - Number(localState.lastRssSyncAt) > RSS_AUTO_REFRESH_MS);

  // 1. PRIORIDADE MÁXIMA: Sincronização via Nuvem SUPABASE (Funciona em redes diferentes!)
  if (deviceCfg.supabaseUrl && deviceCfg.supabaseAnonKey) {
    try {
      var sbState = await this.fetchFromSupabase(deviceCfg.supabaseUrl, deviceCfg.supabaseAnonKey);
      if (sbState && sbState.config) {
        var updatedSb = await this.processIncomingRemoteState(sbState, 'Supabase Cloud');
        // Se também já passou de 5 minutos, renova as notícias do G1 direto da internet no aparelho
        if (rssNeedsRefresh) {
          try { await this.fetchPublicRssFallback(); } catch (e) {}
        }
        this.isSyncing = false;
        return { synced: true, updated: updatedSb, state: this.getLocalState() };
      }
    } catch (sbErr) {}
  }

  // 2. SEGUNDA PRIORIDADE: GitHub Pages URL (Ex: https://usuario.github.io/repo)
  var ghUrl = (deviceCfg.githubPagesUrl || '').replace(/\/+$/, '');
  if (ghUrl && ghUrl.indexOf('http') === 0) {
    try {
      var ghStateUrl = ghUrl + '/data/state.json?t=' + now;
      var ghText = null;
      if (window.AndroidNative && typeof window.AndroidNative.fetchUrl === 'function') {
        ghText = window.AndroidNative.fetchUrl(ghStateUrl);
      } else {
        var ghRes = await fetch(ghStateUrl, { cache: 'no-store' });
        if (ghRes.ok) ghText = await ghRes.text();
      }
      if (ghText && ghText.indexOf('{') === 0) {
        var ghState = JSON.parse(ghText);
        var updatedGh = await this.processIncomingRemoteState(ghState, 'GitHub Pages');
        if (rssNeedsRefresh) {
          try { await this.fetchPublicRssFallback(); } catch (e) {}
        }
        this.isSyncing = false;
        return { synced: true, updated: updatedGh, state: this.getLocalState() };
      }
    } catch (ghErr) {}
  }

  // 3. TERCEIRA PRIORIDADE: Servidor HTTP (caso esteja usando servidor local ou VPS)
  var baseUrl = (deviceCfg.serverUrl || '').replace(/\/+$/, '');
  if (baseUrl && baseUrl.indexOf('http') === 0 && baseUrl.indexOf('github.io') === -1) {
    try {
      var syncUrl = baseUrl + '/api/state?clientVersion=' + encodeURIComponent(localState.version || 0) + '&autoRss=' + (rssNeedsRefresh ? '1' : '0') + '&t=' + now;
      var remoteJsonText = null;

      if (window.AndroidNative && typeof window.AndroidNative.fetchUrl === 'function') {
        remoteJsonText = window.AndroidNative.fetchUrl(syncUrl);
      } else {
        var res = await fetch(syncUrl, { method: 'GET', cache: 'no-store' });
        if (res.ok) remoteJsonText = await res.text();
      }

      if (remoteJsonText && remoteJsonText.indexOf('{') === 0) {
        var remoteState = JSON.parse(remoteJsonText);
        var updatedSrv = await this.processIncomingRemoteState(remoteState, 'Auto-Sync Wi-Fi');
        this.isSyncing = false;
        return { synced: true, updated: updatedSrv, state: this.getLocalState() };
      }
    } catch (srvErr) {}
  }

  // 4. BUSCA AUTOMÁTICA DIRETA DE NOTÍCIAS DO G1 PELA INTERNET COM FILTRO FAMILIAR
  if (rssNeedsRefresh) {
    try {
      var rssUpdated = await this.fetchPublicRssFallback();
      var d2 = new Date();
      var nowStr2 = ('0' + d2.getHours()).slice(-2) + ':' + ('0' + d2.getMinutes()).slice(-2);
      this.saveDeviceConfig({ lastWifiSync: d2.toISOString() });
      this.notifyStatus('online', 'Auto-Sync Internet (' + nowStr2 + ')');
      if (rssUpdated) {
        this.notifyListeners(this.getLocalState(), 'auto-rss-fallback');
      }
      this.isSyncing = false;
      return { synced: true, updated: rssUpdated, state: this.getLocalState() };
    } catch (fallbackErr) {}
  }

  var d3 = new Date();
  var nowStr3 = ('0' + d3.getHours()).slice(-2) + ':' + ('0' + d3.getMinutes()).slice(-2);
  this.notifyStatus('online', 'Auto-Sync Ativo (' + nowStr3 + ')');
  this.isSyncing = false;
  return { synced: false };
};

/**
 * Salva alterações do Painel Administrativo no Supabase (Nuvem) + Servidor Local
 */
VidaModernaSyncManager.prototype.pushStateToServer = async function (newState, refreshRssNow) {
  newState.version = (Number(newState.version) || 1) + 1;
  newState.updatedAt = new Date().toISOString();
  this.saveLocalState(newState, true);

  if (refreshRssNow) {
    try {
      await this.fetchPublicRssFallback();
      newState = this.getLocalState();
    } catch (e) {}
  }

  var deviceCfg = this.getDeviceConfig();

  // 1. Salva no Supabase Cloud (para atualizar o Aquarius STV-Plus em qualquer outra rede de internet!)
  if (deviceCfg.supabaseUrl && deviceCfg.supabaseAnonKey) {
    try {
      var sbOk = await this.pushToSupabase(deviceCfg.supabaseUrl, deviceCfg.supabaseAnonKey, newState);
      if (sbOk) {
        return { ok: true, mode: 'supabase-cloud', state: newState };
      }
    } catch (sbErr) {
      console.warn('Falha ao gravar no Supabase:', sbErr);
    }
  }

  // 2. Salva no servidor local caso esteja rodando iniciar_sistema.bat
  var baseUrl = (deviceCfg.serverUrl || '').replace(/\/+$/, '');
  if (baseUrl.indexOf('http') === 0 && baseUrl.indexOf('github.io') === -1) {
    try {
      var endpoint = baseUrl + '/api/state' + (refreshRssNow ? '?refreshRss=1' : '');
      var res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newState)
      });
      if (res.ok) {
        var updatedFromServer = await res.json();
        if (updatedFromServer && updatedFromServer.noticias) {
          this.saveLocalState(updatedFromServer, true);
          this.notifyListeners(updatedFromServer, 'server-rss-refresh');
        }
        return { ok: true, mode: 'server+local', state: updatedFromServer };
      }
    } catch (e) {}
  }

  return { ok: true, mode: 'local', state: this.getLocalState() };
};

VidaModernaSyncManager.prototype.fetchPublicRssFallback = async function () {
  var state = this.getLocalState();
  if (!state.config || !state.config.rssAtivo) return false;

  var temas = Array.isArray(state.config.rssTemas) && state.config.rssTemas.length > 0
    ? state.config.rssTemas
    : ['tecnologia', 'ciencia_saude', 'turismo', 'cultura'];

  var filtroNivel = state.config.filtroFamiliarNivel || 'rigoroso';
  var customBlocked = state.config.palavrasBloqueadas || '';
  var maxNoticias = Number(state.config.limiteNoticias) || 10;

  var totalAnalisadas = 0;
  var totalBloqueadas = 0;
  var collectedByFeed = [];

  for (var tIdx = 0; tIdx < temas.length; tIdx++) {
    var temaId = temas[tIdx];
    var temaInfo = NEWS_THEMES_CATALOG[temaId];
    if (!temaInfo) continue;

    try {
      var feedList = [];

      if (window.AndroidNative && typeof window.AndroidNative.fetchUrl === 'function') {
        var xmlText = window.AndroidNative.fetchUrl(temaInfo.url);
        if (xmlText && xmlText.indexOf('<item>') !== -1) {
          var itemRegex = /<item>([\s\S]*?)<\/item>/g;
          var match;
          while ((match = itemRegex.exec(xmlText)) !== null && feedList.length < 5) {
            totalAnalisadas++;
            var block = match[1];
            var titleMatch = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/);
            var descMatch = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/);
            var mediaMatch = block.match(/<media:content[^>]+url="([^"]+)"/i) || block.match(/<img[^>]+src="([^"]+)"/i);

            var title = titleMatch ? (titleMatch[1] || titleMatch[2] || '').trim() : '';
            var desc = descMatch ? (descMatch[1] || descMatch[2] || '') : '';
            if (!title) continue;

            if (!isFamilySafeNews(title, desc, filtroNivel, customBlocked)) {
              totalBloqueadas++;
              continue;
            }

            var imgUrl = mediaMatch ? mediaMatch[1] : '';
            if (state.config.apenasComFoto && !imgUrl) continue;

            feedList.push({
              id: 'rss-' + temaId + '-' + feedList.length + '-' + Date.now(),
              fonte: temaInfo.fonte,
              corBarra: temaInfo.cor,
              titulo: title,
              imagemUrl: imgUrl || 'assets/news-bg-default.svg',
              publicadoEm: new Date().toISOString(),
              ativo: true
            });
          }
        }
      } else {
        var apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(temaInfo.url);
        var res = await fetch(apiUrl);
        if (res.ok) {
          var data = await res.json();
          if (data && Array.isArray(data.items)) {
            for (var i = 0; i < data.items.length; i++) {
              var item = data.items[i];
              totalAnalisadas++;
              var tTitle = (item.title || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
              var tDesc = item.description || '';
              if (!tTitle) continue;

              if (!isFamilySafeNews(tTitle, tDesc, filtroNivel, customBlocked)) {
                totalBloqueadas++;
                continue;
              }

              var img = (item.enclosure && item.enclosure.link) ? item.enclosure.link : (item.thumbnail || '');
              if (!img && tDesc) {
                var m = tDesc.match(/<img[^>]+src="([^">]+)"/i);
                if (m && m[1]) img = m[1];
              }

              if (state.config.apenasComFoto && !img) continue;

              feedList.push({
                id: 'rss-' + temaId + '-' + feedList.length + '-' + Date.now(),
                fonte: temaInfo.fonte,
                corBarra: temaInfo.cor,
                titulo: tTitle,
                imagemUrl: img || 'assets/news-bg-default.svg',
                publicadoEm: item.pubDate || new Date().toISOString(),
                ativo: true
              });

              if (feedList.length >= 5) break;
            }
          }
        }
      }

      if (feedList.length > 0) collectedByFeed.push(feedList);
    } catch (e) {}
  }

  var finalNoticias = [];
  var seen = {};
  for (var r = 0; r < 5; r++) {
    for (var f = 0; f < collectedByFeed.length; f++) {
      var list = collectedByFeed[f];
      if (r < list.length && !seen[list[r].titulo]) {
        seen[list[r].titulo] = true;
        finalNoticias.push(list[r]);
        if (finalNoticias.length >= maxNoticias) break;
      }
    }
    if (finalNoticias.length >= maxNoticias) break;
  }

  state.config.ultimoFiltroStats = {
    analisadas: totalAnalisadas,
    bloqueadas: totalBloqueadas,
    aprovadas: finalNoticias.length,
    atualizadoEm: new Date().toLocaleString('pt-BR')
  };

  if (finalNoticias.length > 0) {
    state.noticias = finalNoticias;
    state.lastRssSyncAt = Date.now();
    state.version = (Number(state.version) || 1) + 1;
    state.updatedAt = new Date().toISOString();
    this.saveLocalState(state, true);
    await this.cacheMediaAssetsOffline(state);
    return true;
  }
  return false;
};

window.falaSync = new VidaModernaSyncManager();
