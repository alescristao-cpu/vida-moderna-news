/**
 * Vida Moderna News - Camada Offline-First & Sincronização 100% Automática via Nuvem (Supabase + GitHub Pages)
 * VERSÃO 100% COMPATÍVEL COM NAVEGADORES ANTIGOS (ES5 Puro + XMLHttpRequest - Android 4.0 / 4.4 / 5.1 / 7.1 Aquarius STV-Plus)
 */

var FALA_STORAGE_KEY = 'vidamoderna_state_v3';
var FALA_DEVICE_CFG_KEY = 'vidamoderna_device_cfg_v1';
var AUTO_SYNC_INTERVAL_MS = 5000;
var RSS_AUTO_REFRESH_MS = 10 * 60 * 1000;

/**
 * Mini-Promise compatível com ES5 (para navegadores antigos que não possuem window.Promise)
 */
function es5Resolve(val) {
  if (typeof Promise !== 'undefined') {
    return Promise.resolve(val);
  }
  return {
    then: function (cb) {
      if (cb) {
        try { return es5Resolve(cb(val)); } catch (e) { return es5Resolve(null); }
      }
      return this;
    },
    'catch': function () { return this; }
  };
}

function es5Async(executor) {
  if (typeof Promise !== 'undefined') {
    return new Promise(function (resolve) {
      try {
        executor(resolve);
      } catch (e) {
        resolve(null);
      }
    });
  }
  var callbacks = [];
  var isDone = false;
  var resultVal = null;

  function resolve(val) {
    if (isDone) return;
    isDone = true;
    resultVal = val;
    for (var i = 0; i < callbacks.length; i++) {
      try { callbacks[i](val); } catch (e) {}
    }
  }

  var thenable = {
    then: function (cb) {
      if (!cb) return thenable;
      if (isDone) {
        try { cb(resultVal); } catch (e) {}
      } else {
        callbacks.push(cb);
      }
      return thenable;
    },
    'catch': function () { return thenable; }
  };

  try {
    executor(resolve);
  } catch (err) {
    resolve(null);
  }
  return thenable;
}

/**
 * Requisição HTTP/HTTPS universal via XMLHttpRequest (funciona desde o Android 2.3 / Chrome 1.0)
 */
function xhrRequest(method, url, headers, bodyStr, callback) {
  var called = false;
  function finish(ok, status, text) {
    if (called) return;
    called = true;
    callback(ok, status, text);
  }
  try {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.timeout = 15000;
    if (headers) {
      for (var k in headers) {
        if (Object.prototype.hasOwnProperty.call(headers, k)) {
          xhr.setRequestHeader(k, headers[k]);
        }
      }
    }
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        var ok = xhr.status >= 200 && xhr.status < 300;
        finish(ok, xhr.status, xhr.responseText || '');
      }
    };
    xhr.onerror = function () {
      finish(false, 0, '');
    };
    xhr.ontimeout = function () {
      finish(false, 0, '');
    };
    xhr.send(bodyStr || null);
  } catch (e) {
    finish(false, 0, '');
  }
}

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

  if (customBlockedCsv && customBlockedCsv.replace(/^\s+|\s+$/g, '')) {
    var customList = customBlockedCsv.split(/[,;\n]+/);
    for (var j = 0; j < customList.length; j++) {
      var clean = customList[j].replace(/^\s+|\s+$/g, '').toLowerCase();
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
      imagemUrl: 'http://s2-g1.glbimg.com/ffu1EwWcJ6skS_Y_mW4FUk5-Mno=/i.s3.glbimg.com/v1/AUTH_59edd422c0c84a879bd37670ae4f538a/internal_photos/bs/2026/8/Z/ISwY2KRVGdHAAlq1GAWg/sweetlouise-woman-3236059.jpg',
      publicadoEm: 'Thu, 22 Oct 2026 06:00:00 -0000',
      ativo: true
    },
    {
      id: 'not-3d455dc0',
      fonte: 'G1 • SAÚDE & CIÊNCIA',
      corBarra: '#2a5e35',
      titulo: "'Ciência Aberta': centro que abriga o Sirius recebe público para apresentar curiosidades e atrações da ciência",
      imagemUrl: 'http://s2-g1.glbimg.com/kKUdrY29MpZWo_veboJUOdZ1dnM=/i.s3.glbimg.com/v1/AUTH_59edd422c0c84a879bd37670ae4f538a/internal_photos/bs/2020/0/Z/0MdzrrRtyHwZFyLq5f6g/fachadasirius.creditonelsonkon.jpg',
      publicadoEm: 'Fri, 09 Aug 2024 09:49:43 -0000',
      ativo: true
    },
    {
      id: 'not-5473ffee',
      fonte: 'G1 • CULTURA & ARTE',
      corBarra: '#9333ea',
      titulo: 'Atriz Judi Dench afirma que piora da visão a impede de continuar atuando',
      imagemUrl: 'http://s2-g1.glbimg.com/E6w8SzaWelqOwm4zxccxCYoNdyE=/i.s3.glbimg.com/v1/AUTH_59edd422c0c84a879bd37670ae4f538a/internal_photos/bs/2022/s/i/g2BmTMQDO8nafBlXqMjA/judi-dench-the-crown-reuters.jpg',
      publicadoEm: 'Thu, 22 Oct 2026 12:48:56 -0000',
      ativo: true
    },
    {
      id: 'not-2d8f6670',
      fonte: 'G1 • CULTURA & ARTE',
      corBarra: '#9333ea',
      titulo: "Zélia Duncan oferece 'Pan y leche' em single no rastro do êxito da música de Maurício Pereira no show 'Agudo grave'",
      imagemUrl: 'http://s2-g1.glbimg.com/5Ba0hDdEUqYwbJjVPQYmtwGPc34=/i.s3.glbimg.com/v1/AUTH_59edd422c0c84a879bd37670ae4f538a/internal_photos/bs/2026/8/P/s5NlwLSbGaKO0UqrjyFw/zeliapanlechefoto.jpg',
      publicadoEm: 'Thu, 22 Oct 2026 10:58:05 -0000',
      ativo: true
    }
  ]
};

function sanitizeLegacyRecados(recadosList) {
  if (!recadosList || !recadosList.length) return [];
  var cleaned = [];
  for (var i = 0; i < recadosList.length; i++) {
    var r = recadosList[i];
    if (!r) continue;
    var t = (r.titulo || '').toUpperCase();
    var tx = (r.texto || '').toLowerCase();
    if (r.id === 'rec-3' || t.indexOf('MANUTENÇÃO PREVENTIVA') !== -1 || t.indexOf('MANUTENCAO PREVENTIVA') !== -1 || tx.indexOf('reservatórios superiores') !== -1) {
      continue;
    }
    cleaned.push(r);
  }
  return cleaned;
}

function VidaModernaSyncManager() {
  this.listeners = [];
  this.statusListeners = [];
  this.isSyncing = false;
  this.isPushing = false;
  this.lastLocalPushAt = 0;
  this.wasOffline = false;
  this.autoSyncTimer = null;
  this.themesCatalog = NEWS_THEMES_CATALOG;
  this.channel = null;

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      var self = this;
      this.channel = new BroadcastChannel('vidamoderna_realtime_channel');
      this.channel.onmessage = function (ev) {
        if (ev && ev.data && ev.data.type === 'STATE_UPDATED') {
          self.notifyListeners(self.getLocalState(), 'broadcast');
        }
      };
    }
  } catch (e) {}

  var selfRef = this;
  window.addEventListener('storage', function (ev) {
    if (ev && ev.key === FALA_STORAGE_KEY && ev.newValue) {
      try {
        selfRef.notifyListeners(JSON.parse(ev.newValue), 'storage');
      } catch (e) {}
    }
  });

  window.addEventListener('message', function (ev) {
    if (ev && ev.data && ev.data.type === 'VIDAMODERNA_STATE' && ev.data.state) {
      selfRef.notifyListeners(ev.data.state, 'postMessage');
    }
  });
}

VidaModernaSyncManager.prototype.isFamilySafe = function (title, desc, level, customBlocked) {
  return isFamilySafeNews(title, desc, level, customBlocked);
};

VidaModernaSyncManager.prototype.getDeviceConfig = function () {
  var cloudDefaults = window.VIDA_MODERNA_CLOUD || {};
  var def = {
    serverUrl: (window.location && window.location.origin && window.location.origin.indexOf('http') === 0) ? window.location.origin : '',
    supabaseUrl: cloudDefaults.supabaseUrl || 'https://buzjnfppicexlpgyllvp.supabase.co',
    supabaseAnonKey: cloudDefaults.supabaseAnonKey || 'sb_publishable_0bT5VXIuYk2XomaxkrO_hA_AoD-DcFO',
    githubPagesUrl: cloudDefaults.githubPagesUrl || 'https://alescristao-cpu.github.io/vida-moderna-news',
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
  try {
    localStorage.setItem(FALA_DEVICE_CFG_KEY, JSON.stringify(merged));
  } catch (e) {}
  return merged;
};

VidaModernaSyncManager.prototype.getLocalState = function () {
  try {
    var raw = localStorage.getItem(FALA_STORAGE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.config) {
        if (!parsed.config.rssTemas || !parsed.config.rssTemas.length) {
          parsed.config.rssTemas = ['tecnologia', 'ciencia_saude', 'turismo', 'cultura'];
        }
        if (!parsed.config.filtroFamiliarNivel) {
          parsed.config.filtroFamiliarNivel = 'rigoroso';
        }
        parsed.recados = sanitizeLegacyRecados(parsed.recados);
        return parsed;
      }
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

VidaModernaSyncManager.prototype.notifyListeners = function (state, source) {
  for (var i = 0; i < this.listeners.length; i++) {
    try { this.listeners[i](state, source); } catch (e) {}
  }
};

VidaModernaSyncManager.prototype.notifyStatus = function (status, detail) {
  for (var i = 0; i < this.statusListeners.length; i++) {
    try { this.statusListeners[i](status, detail); } catch (e) {}
  }
};

/**
 * Busca estado no Supabase via XMLHttpRequest ou Ponte Nativa Java (100% compatível com navegadores antigos)
 */
VidaModernaSyncManager.prototype.fetchFromSupabase = function (sbUrl, sbKey) {
  var self = this;
  return es5Async(function (resolve) {
    var cfg = self.getDeviceConfig();
    var cleanUrl = ((sbUrl || cfg.supabaseUrl) || '').replace(/\/+$/, '');
    var keyToUse = sbKey || cfg.supabaseAnonKey || '';
    if (!cleanUrl || !keyToUse) {
      resolve(null);
      return;
    }

    var endpoint = cleanUrl + '/rest/v1/vidamoderna_sync?id=eq.main&id=neq.cb_' + new Date().getTime() + '&select=payload';

    if (window.AndroidNative && typeof window.AndroidNative.fetchSupabaseState === 'function') {
      try {
        var rawResp = window.AndroidNative.fetchSupabaseState(endpoint, keyToUse);
        if (rawResp && rawResp.indexOf('[') === 0) {
          var rows = JSON.parse(rawResp);
          if (rows && rows.length > 0 && rows[0].payload) {
            resolve(rows[0].payload);
            return;
          }
        }
      } catch (e) {}
    }

    var headers = {
      'apikey': keyToUse,
      'Accept': 'application/json'
    };
    if (keyToUse.indexOf('eyJ') === 0) {
      headers['Authorization'] = 'Bearer ' + keyToUse;
    }

    xhrRequest('GET', endpoint, headers, null, function (ok, status, text) {
      if (ok && text && text.indexOf('[') === 0) {
        try {
          var data = JSON.parse(text);
          if (data && data.length > 0 && data[0].payload) {
            resolve(data[0].payload);
            return;
          }
        } catch (err) {}
      }
      resolve(null);
    });
  });
};

/**
 * Envia estado do Painel Administrativo para o Supabase via XMLHttpRequest
 */
VidaModernaSyncManager.prototype.pushToSupabase = function (sbUrlOrState, sbKey, stateObj) {
  var self = this;
  return es5Async(function (resolve) {
    var cfg = self.getDeviceConfig();
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

    if (!cleanUrl || !keyToUse || !payloadObj) {
      resolve(false);
      return;
    }

    var endpoint = cleanUrl + '/rest/v1/vidamoderna_sync?on_conflict=id';
    var headers = {
      'apikey': keyToUse,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    };
    if (keyToUse.indexOf('eyJ') === 0) {
      headers['Authorization'] = 'Bearer ' + keyToUse;
    }

    var body = JSON.stringify({
      id: 'main',
      payload: payloadObj,
      updated_at: new Date().toISOString()
    });

    xhrRequest('POST', endpoint, headers, body, function (ok) {
      resolve(ok);
    });
  });
};

VidaModernaSyncManager.prototype.processIncomingRemoteState = function (remoteState, sourceLabel) {
  if (this.isPushing || (new Date().getTime() - this.lastLocalPushAt < 4000)) {
    return false;
  }

  var localState = this.getLocalState();
  remoteState.lastRssSyncAt = new Date().getTime();
  remoteState.recados = sanitizeLegacyRecados(remoteState.recados);

  if (remoteState.noticias && remoteState.noticias.length) {
    var nivel = (remoteState.config && remoteState.config.filtroFamiliarNivel) ? remoteState.config.filtroFamiliarNivel : 'rigoroso';
    var customBlk = (remoteState.config && remoteState.config.palavrasBloqueadas) ? remoteState.config.palavrasBloqueadas : '';
    var filtered = [];
    for (var i = 0; i < remoteState.noticias.length; i++) {
      var n = remoteState.noticias[i];
      if (n && (n.custom || n.editada || isFamilySafeNews(n.titulo, '', nivel, customBlk))) {
        filtered.push(n);
      }
    }
    remoteState.noticias = filtered;
  }

  var hasChanges = !localState ||
    Number(remoteState.version) !== Number(localState.version) ||
    remoteState.updatedAt !== localState.updatedAt ||
    JSON.stringify(remoteState.config) !== JSON.stringify(localState.config) ||
    JSON.stringify(remoteState.recados) !== JSON.stringify(localState.recados) ||
    JSON.stringify(remoteState.midias) !== JSON.stringify(localState.midias) ||
    JSON.stringify(remoteState.noticias) !== JSON.stringify(localState.noticias);

  if (hasChanges) {
    this.notifyStatus('syncing', 'Atualizando (' + sourceLabel + ')...');
    this.saveLocalState(remoteState, true);
    this.notifyListeners(remoteState, 'cloud-sync');
  }

  var d = new Date();
  var nowStr = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  this.saveDeviceConfig({ lastWifiSync: d.toISOString() });
  this.notifyStatus('online', sourceLabel + ' (' + nowStr + ')');
  return hasChanges;
};

/**
 * Sincronização Automática (Supabase Nuvem como fonte única da verdade) sem usar async/await!
 */
VidaModernaSyncManager.prototype.syncFromServer = function (forceRssCheck) {
  var self = this;
  return es5Async(function (resolve) {
    if (self.isSyncing || self.isPushing) {
      resolve({ synced: false, reason: 'busy' });
      return;
    }

    if (navigator.onLine === false) {
      self.notifyStatus('offline', 'Offline (Cache Local)');
      resolve({ synced: false, reason: 'offline' });
      return;
    }

    self.isSyncing = true;
    var deviceCfg = self.getDeviceConfig();
    var localState = self.getLocalState();
    var now = new Date().getTime();
    var rssNeedsRefresh = forceRssCheck || !localState.lastRssSyncAt || (now - Number(localState.lastRssSyncAt) > RSS_AUTO_REFRESH_MS);

    function finishSync(synced, updated) {
      self.isSyncing = false;
      resolve({ synced: synced, updated: updated, state: self.getLocalState() });
    }

    function stepRssFallback() {
      if (!rssNeedsRefresh) {
        var d3 = new Date();
        var nowStr3 = ('0' + d3.getHours()).slice(-2) + ':' + ('0' + d3.getMinutes()).slice(-2);
        self.notifyStatus('online', 'Auto-Sync (' + nowStr3 + ')');
        finishSync(false, false);
        return;
      }
      self.fetchPublicRssFallback().then(function (rssUpdated) {
        var d2 = new Date();
        var nowStr2 = ('0' + d2.getHours()).slice(-2) + ':' + ('0' + d2.getMinutes()).slice(-2);
        self.saveDeviceConfig({ lastWifiSync: d2.toISOString() });
        self.notifyStatus('online', 'Sincronizado (' + nowStr2 + ')');
        if (rssUpdated) {
          self.notifyListeners(self.getLocalState(), 'auto-rss-fallback');
        }
        finishSync(true, rssUpdated);
      });
    }

    // 1. Tenta Supabase Nuvem primeiro (Fonte Oficial da Verdade)
    if (deviceCfg.supabaseUrl && deviceCfg.supabaseAnonKey) {
      self.fetchFromSupabase(deviceCfg.supabaseUrl, deviceCfg.supabaseAnonKey).then(function (sbState) {
        if (sbState && sbState.config) {
          var updatedSb = self.processIncomingRemoteState(sbState, 'Supabase Nuvem');
          if (!sbState.noticias || sbState.noticias.length === 0) {
            self.fetchPublicRssFallback().then(function () {
              finishSync(true, updatedSb);
            });
          } else {
            finishSync(true, updatedSb);
          }
        } else {
          // Não sobrescreve com state.json estático caso a internet oscile
          var dErr = new Date();
          var nowErr = ('0' + dErr.getHours()).slice(-2) + ':' + ('0' + dErr.getMinutes()).slice(-2);
          self.notifyStatus('online', 'Cache Ativo (' + nowErr + ')');
          finishSync(false, false);
        }
      });
    } else {
      stepRssFallback();
    }
  });
};

VidaModernaSyncManager.prototype.pushStateToServer = function (newState, refreshRssNow) {
  var self = this;
  return es5Async(function (resolve) {
    self.isPushing = true;
    self.lastLocalPushAt = new Date().getTime();
    newState.version = new Date().getTime();
    newState.updatedAt = new Date().toISOString();
    newState.recados = sanitizeLegacyRecados(newState.recados);
    self.saveLocalState(newState, true);
    self.notifyListeners(newState, 'local-push');

    function sendToCloud(stateToSend) {
      var deviceCfg = self.getDeviceConfig();
      if (deviceCfg.supabaseUrl && deviceCfg.supabaseAnonKey) {
        self.pushToSupabase(deviceCfg.supabaseUrl, deviceCfg.supabaseAnonKey, stateToSend).then(function (sbOk) {
          self.isPushing = false;
          self.lastLocalPushAt = new Date().getTime();
          resolve({ ok: sbOk, mode: sbOk ? 'supabase-cloud' : 'local', state: stateToSend });
        });
      } else {
        self.isPushing = false;
        resolve({ ok: true, mode: 'local', state: stateToSend });
      }
    }

    if (refreshRssNow) {
      self.fetchPublicRssFallback().then(function () {
        var updatedAfterRss = self.getLocalState();
        updatedAfterRss.version = new Date().getTime();
        updatedAfterRss.updatedAt = new Date().toISOString();
        self.saveLocalState(updatedAfterRss, true);
        sendToCloud(updatedAfterRss);
      });
    } else {
      sendToCloud(newState);
    }
  });
};

VidaModernaSyncManager.prototype.fetchPublicRssFallback = function () {
  var self = this;
  return es5Async(function (resolve) {
    var initialState = self.getLocalState();
    if (!initialState.config || !initialState.config.rssAtivo) {
      resolve(false);
      return;
    }

    var temas = (initialState.config.rssTemas && initialState.config.rssTemas.length > 0)
      ? initialState.config.rssTemas
      : ['tecnologia', 'ciencia_saude', 'turismo', 'cultura'];

    var filtroNivel = initialState.config.filtroFamiliarNivel || 'rigoroso';
    var customBlocked = initialState.config.palavrasBloqueadas || '';
    var maxNoticias = Number(initialState.config.limiteNoticias) || 10;

    var totalAnalisadas = 0;
    var totalBloqueadas = 0;
    var collectedByFeed = [];
    var currentIdx = 0;

    function normalizeImgUrlForLegacy(url) {
      if (!url) return 'assets/news-bg-default.svg';
      if (window.location && window.location.protocol !== 'https:' && url.indexOf('https://s2-g1.glbimg.com/') === 0) {
        return url.replace('https://', 'http://');
      }
      return url;
    }

    function finalizeRss() {
      var latestState = self.getLocalState();
      var excluidas = latestState.noticiasExcluidas || [];
      var excluidasMap = {};
      for (var eIdx = 0; eIdx < excluidas.length; eIdx++) {
        excluidasMap[excluidas[eIdx]] = true;
      }

      var finalNoticias = [];
      var seen = {};

      // Preserva notícias criadas ou editadas manualmente no Painel Admin
      var currentList = latestState.noticias || [];
      for (var cIdx = 0; cIdx < currentList.length; cIdx++) {
        var cn = currentList[cIdx];
        if (cn && (cn.custom || cn.editada || (cn.id && cn.id.indexOf('not-') === 0 && !cn.id.indexOf('rss-') === 0))) {
          if (!excluidasMap[cn.id] && !excluidasMap[cn.titulo]) {
            seen[cn.titulo] = true;
            if (cn.tituloOriginal) seen[cn.tituloOriginal] = true;
            finalNoticias.push(cn);
          }
        }
      }

      for (var r = 0; r < 5; r++) {
        for (var f = 0; f < collectedByFeed.length; f++) {
          var list = collectedByFeed[f];
          if (r < list.length) {
            var candidate = list[r];
            if (!seen[candidate.titulo] && !excluidasMap[candidate.id] && !excluidasMap[candidate.titulo]) {
              seen[candidate.titulo] = true;
              finalNoticias.push(candidate);
              if (finalNoticias.length >= maxNoticias) break;
            }
          }
        }
        if (finalNoticias.length >= maxNoticias) break;
      }

      if (finalNoticias.length > 0) {
        latestState.config.ultimoFiltroStats = {
          analisadas: totalAnalisadas,
          bloqueadas: totalBloqueadas,
          aprovadas: finalNoticias.length,
          atualizadoEm: new Date().toLocaleTimeString ? new Date().toLocaleTimeString() : 'Automático'
        };
        latestState.noticias = finalNoticias;
        latestState.lastRssSyncAt = new Date().getTime();
        latestState.version = new Date().getTime();
        latestState.updatedAt = new Date().toISOString();
        self.saveLocalState(latestState, true);
        resolve(true);
      } else {
        resolve(false);
      }
    }

    function processNextTheme() {
      if (currentIdx >= temas.length) {
        finalizeRss();
        return;
      }

      var temaId = temas[currentIdx++];
      var temaInfo = NEWS_THEMES_CATALOG[temaId];
      if (!temaInfo) {
        processNextTheme();
        return;
      }

      var feedList = [];

      if (window.AndroidNative && typeof window.AndroidNative.fetchUrl === 'function') {
        try {
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

              var title = titleMatch ? (titleMatch[1] || titleMatch[2] || '').replace(/^\s+|\s+$/g, '') : '';
              var desc = descMatch ? (descMatch[1] || descMatch[2] || '') : '';
              if (!title) continue;

              if (!isFamilySafeNews(title, desc, filtroNivel, customBlocked)) {
                totalBloqueadas++;
                continue;
              }

              var imgUrl = mediaMatch ? mediaMatch[1] : '';
              if (initialState.config.apenasComFoto && !imgUrl) continue;

              feedList.push({
                id: 'rss-' + temaId + '-' + feedList.length + '-' + new Date().getTime(),
                fonte: temaInfo.fonte,
                corBarra: temaInfo.cor,
                titulo: title,
                imagemUrl: normalizeImgUrlForLegacy(imgUrl),
                publicadoEm: new Date().toISOString(),
                ativo: true
              });
            }
          }
        } catch (e) {}

        if (feedList.length > 0) collectedByFeed.push(feedList);
        processNextTheme();
        return;
      }

      var apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(temaInfo.url);
      xhrRequest('GET', apiUrl, null, null, function (ok, status, text) {
        if (ok && text && text.indexOf('{') === 0) {
          try {
            var data = JSON.parse(text);
            if (data && data.items && data.items.length) {
              for (var i = 0; i < data.items.length; i++) {
                var item = data.items[i];
                totalAnalisadas++;
                var tTitle = (item.title || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/^\s+|\s+$/g, '');
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

                if (initialState.config.apenasComFoto && !img) continue;

                feedList.push({
                  id: 'rss-' + temaId + '-' + feedList.length + '-' + new Date().getTime(),
                  fonte: temaInfo.fonte,
                  corBarra: temaInfo.cor,
                  titulo: tTitle,
                  imagemUrl: normalizeImgUrlForLegacy(img),
                  publicadoEm: item.pubDate || new Date().toISOString(),
                  ativo: true
                });

                if (feedList.length >= 5) break;
              }
            }
          } catch (e) {}
        }
        if (feedList.length > 0) collectedByFeed.push(feedList);
        processNextTheme();
      });
    }

    processNextTheme();
  });
};

VidaModernaSyncManager.prototype.startAutoSyncDaemon = function () {
  var self = this;

  // Se estiver dentro do iframe de preview do Painel Admin, não roda polling concorrente (recebe estado direto do Admin)
  if (window.self !== window.top) {
    self.notifyStatus('online', 'Preview Ao Vivo');
    return;
  }

  window.triggerWifiSync = function () {
    self.notifyStatus('syncing', 'Wi-Fi Conectado...');
    self.syncFromServer(true);
  };

  window.addEventListener('online', function () {
    self.wasOffline = false;
    self.notifyStatus('syncing', 'Sinal Wi-Fi Detectado...');
    self.syncFromServer(true);
  });

  window.addEventListener('offline', function () {
    self.wasOffline = true;
    self.notifyStatus('offline', 'Offline (Cache Local)');
  });

  this.syncFromServer(false);

  if (this.autoSyncTimer) clearInterval(this.autoSyncTimer);
  this.autoSyncTimer = setInterval(function () {
    self.syncFromServer(false);
  }, AUTO_SYNC_INTERVAL_MS);
};

window.falaSync = new VidaModernaSyncManager();
