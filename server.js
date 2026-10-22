/**
 * Vida Moderna News - Servidor Node.js
 * - Sincronização 100% Automática via Wi-Fi
 * - Busca Automática de Notícias por Temas de Interesse (G1 + Google News RSS)
 * - Filtro de Classificação Familiar Rigoroso (Livre para todos os públicos / Elevador)
 */

const http = require('http');
const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_FILE = path.join(__dirname, 'data', 'state.json');
let lastRssSyncTime = 0;

const THEME_CATALOG = {
  tecnologia:    { url: 'https://g1.globo.com/rss/g1/tecnologia/',       fonte: 'G1 • TECNOLOGIA',      cor: '#0d74b8' },
  ciencia_saude: { url: 'https://g1.globo.com/rss/g1/ciencia-e-saude/',  fonte: 'G1 • SAÚDE & CIÊNCIA', cor: '#2a5e35' },
  bemestar:      { url: 'https://g1.globo.com/rss/g1/bemestar/',         fonte: 'G1 • BEM-ESTAR',       cor: '#16a34a' },
  turismo:       { url: 'https://g1.globo.com/rss/g1/turismo-e-viagem/', fonte: 'G1 • TURISMO',         cor: '#0284c7' },
  natureza:      { url: 'https://g1.globo.com/rss/g1/natureza/',         fonte: 'G1 • NATUREZA',        cor: '#15803d' },
  economia:      { url: 'https://g1.globo.com/rss/g1/economia/',         fonte: 'G1 • ECONOMIA',        cor: '#d97706' },
  educacao:      { url: 'https://g1.globo.com/rss/g1/educacao/',         fonte: 'G1 • EDUCAÇÃO',        cor: '#4f46e5' },
  cultura:       { url: 'https://g1.globo.com/rss/g1/pop-arte/',         fonte: 'G1 • CULTURA & ARTE',  cor: '#9333ea' },
  carros:        { url: 'https://g1.globo.com/rss/g1/carros/',           fonte: 'G1 • AUTOMÓVEIS',      cor: '#0f766e' },
  geral:         { url: 'https://g1.globo.com/rss/g1/',                  fonte: 'G1 • BRASIL',          cor: '#5bb75b' }
};

const STRICT_FAMILY_BLOCKED_TERMS = [
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

const MODERATE_FAMILY_BLOCKED_TERMS = [
  'assassin', 'homicid', 'homicíd', 'feminicid', 'feminicíd', 'chacina', 'massacre',
  'estupr', 'pedofil', 'porn', 'sexo', 'sexual', 'nudez', 'erotic', 'erótic', 'prostitui',
  'suicid', 'suicíd', 'se matou', 'tortura', 'decapit', 'esquartej'
];

function isFamilySafeNews(title, description, filterLevel = 'rigoroso', customBlockedCsv = '') {
  if (filterLevel === 'desativado') return true;
  const text = `${title || ''} ${description || ''}`.toLowerCase();
  const terms = filterLevel === 'moderado' ? MODERATE_FAMILY_BLOCKED_TERMS : STRICT_FAMILY_BLOCKED_TERMS;
  for (const term of terms) {
    if (text.includes(term)) return false;
  }
  if (customBlockedCsv && customBlockedCsv.trim()) {
    const customList = customBlockedCsv.split(/[,;\n]+/);
    for (const raw of customList) {
      const clean = raw.trim().toLowerCase();
      if (clean.length >= 2 && text.includes(clean)) return false;
    }
  }
  return true;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

function fetchUrlUtf8(urlStr) {
  return new Promise((resolve, reject) => {
    const client = urlStr.startsWith('https') ? https : http;
    client.get(urlStr, { headers: { 'User-Agent': 'VidaModernaNews/2.0', 'Accept-Encoding': 'gzip, deflate' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrlUtf8(res.headers.location));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
          zlib.gunzip(buffer, (err, decoded) => {
            if (err) return reject(err);
            resolve(decoded.toString('utf8'));
          });
        } else {
          resolve(buffer.toString('utf8'));
        }
      });
    }).on('error', reject);
  });
}

async function syncG1Rss() {
  const state = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!state.config || !state.config.rssAtivo) return state;

  const temas = Array.isArray(state.config.rssTemas) && state.config.rssTemas.length > 0
    ? state.config.rssTemas
    : ['tecnologia', 'ciencia_saude', 'turismo', 'cultura'];

  const filtroNivel = state.config.filtroFamiliarNivel || 'rigoroso';
  const customBlocked = state.config.palavrasBloqueadas || '';
  const apenasComFoto = state.config.apenasComFoto !== false;
  const maxNoticias = Number(state.config.limiteNoticias) || 10;

  const feedsToFetch = temas.map((t) => THEME_CATALOG[t]).filter(Boolean);
  if (state.config.temaPersonalizado && state.config.temaPersonalizado.trim()) {
    const q = encodeURIComponent(state.config.temaPersonalizado.trim());
    feedsToFetch.push({
      url: `https://news.google.com/rss/search?q=${q}&hl=pt-BR&gl=BR&ceid=BR:pt-419`,
      fonte: `NEWS • ${state.config.temaPersonalizado.trim().toUpperCase()}`,
      cor: '#2a5e35'
    });
  }

  let totalAnalisadas = 0;
  let totalBloqueadas = 0;
  const collectedByFeed = [];

  for (const feedInfo of feedsToFetch) {
    try {
      const xml = await fetchUrlUtf8(feedInfo.url);
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      const feedItems = [];

      while ((match = itemRegex.exec(xml)) !== null && feedItems.length < 6) {
        totalAnalisadas++;
        const block = match[1];
        const titleMatch = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/);
        const descMatch = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/);
        const mediaMatch = block.match(/<media:content[^>]+url="([^"]+)"/i) || block.match(/<img[^>]+src="([^"]+)"/i);

        const titulo = titleMatch ? (titleMatch[1] || titleMatch[2] || '').trim() : '';
        const desc = descMatch ? (descMatch[1] || descMatch[2] || '') : '';
        if (!titulo) continue;

        if (!isFamilySafeNews(titulo, desc, filtroNivel, customBlocked)) {
          totalBloqueadas++;
          continue;
        }

        const imagemUrl = mediaMatch ? mediaMatch[1] : '';
        if (apenasComFoto && !imagemUrl && !feedInfo.url.includes('news.google.com')) continue;

        feedItems.push({
          id: `not-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          fonte: feedInfo.fonte,
          corBarra: feedInfo.cor,
          titulo,
          imagemUrl: imagemUrl || 'assets/news-bg-default.svg',
          publicadoEm: new Date().toISOString(),
          ativo: true
        });
      }
      if (feedItems.length > 0) collectedByFeed.push(feedItems);
    } catch (e) {}
  }

  const finalNoticias = [];
  const seen = new Set();
  for (let r = 0; r < 6; r++) {
    for (const list of collectedByFeed) {
      if (r < list.length && !seen.has(list[r].titulo)) {
        seen.add(list[r].titulo);
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
    state.version = (Number(state.version) || 1) + 1;
    state.updatedAt = new Date().toISOString();
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
    lastRssSyncTime = Date.now();
  }
  return state;
}

syncG1Rss().catch(() => {});
setInterval(() => {
  syncG1Rss().catch(() => {});
}, 5 * 60 * 1000);

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (pathname === '/api/state' && req.method === 'GET') {
    if (Date.now() - lastRssSyncTime > 5 * 60 * 1000) {
      try { await syncG1Rss(); } catch (e) {}
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(fs.readFileSync(DATA_FILE, 'utf8'));
  }

  if (pathname === '/api/state' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      fs.writeFileSync(DATA_FILE, body, 'utf8');
      if (parsedUrl.searchParams.get('refreshRss') === '1') {
        try { await syncG1Rss(); } catch (e) {}
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(fs.readFileSync(DATA_FILE, 'utf8'));
    });
    return;
  }

  if (pathname === '/api/sync-rss') {
    try {
      const updated = await syncG1Rss();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(updated));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  }

  const relPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(path.join(PUBLIC_DIR, relPath));

  if (!safePath.startsWith(PUBLIC_DIR) || !fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('404 - Não encontrado');
  }

  const ext = path.extname(safePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
  fs.createReadStream(safePath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Vida Moderna News (Auto-RSS + Filtro Familiar) rodando em http://localhost:${PORT}`);
});
