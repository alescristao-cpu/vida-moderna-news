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

var SEASONAL_THEMES_CATALOG = {
  padrao: {
    id: 'padrao',
    nome: 'Padrão Modern Life Residence',
    icone: '🌿',
    periodo: 'Ano todo',
    corPrimaria: '#2a5e35',
    corSecundaria: '#14532d',
    corDestaque: '#dcfce7',
    corTextoDestaque: '#166534',
    footerBg: 'linear-gradient(180deg, #f3f6f9 0%, #e6ecf2 100%)',
    seloTexto: '',
    assuntoBusca: 'Arquitetura Decoração Condomínio',
    recadoTitulo: 'INFORMAÇÕES DO CONDOMÍNIO',
    recadoTexto: 'Desejamos a todos os moradores do Modern Life Residence uma excelente semana com muita paz, harmonia e boa convivência!',
    cartelaCategoria: 'COMUNICAÇÃO INTERNA',
    cartelaTitulo: 'Bem-vindo ao Nosso Condomínio',
    cartelaSubtitulo: 'Qualidade de vida, segurança e boa convivência para toda a sua família.',
    cartelaDicaBranca: '🌿 Dica de Convivência: Gentileza, respeito aos horários de silêncio e cuidado com as áreas comuns fazem a diferença!'
  },
  ano_novo: {
    id: 'ano_novo',
    nome: 'Réveillon & Ano Novo',
    icone: '🥂',
    periodo: '26/Dez a 10/Jan',
    corPrimaria: '#b45309',
    corSecundaria: '#78350f',
    corDestaque: '#fef3c7',
    corTextoDestaque: '#92400e',
    footerBg: 'linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%)',
    seloTexto: '🥂 FELIZ ANO NOVO • PAZ E PROSPERIDADE',
    assuntoBusca: 'Ano Novo Réveillon Turismo Boas Energias',
    recadoTitulo: '🥂 FELIZ ANO NOVO • MODERN LIFE',
    recadoTexto: 'Que o Novo Ano traga muita saúde, paz, conquistas e momentos felizes para todas as famílias do Modern Life Residence!',
    cartelaCategoria: '🥂 CELEBRAÇÃO DE ANO NOVO',
    cartelaTitulo: 'Feliz Ano Novo!',
    cartelaSubtitulo: 'Desejamos um novo ciclo repleto de saúde, união, alegria e prosperidade a todos os moradores.',
    cartelaDicaBranca: '✨ Comece o ano cultivando hábitos saudáveis, metas positivas e momentos especiais ao lado de quem você ama!'
  },
  verao_ferias: {
    id: 'verao_ferias',
    nome: 'Verão & Férias no Condomínio',
    icone: '☀️',
    periodo: 'Janeiro',
    corPrimaria: '#0284c7',
    corSecundaria: '#0369a1',
    corDestaque: '#e0f2fe',
    corTextoDestaque: '#075985',
    footerBg: 'linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%)',
    seloTexto: '☀️ VERÃO & FÉRIAS • LAZER COM SEGURANÇA',
    assuntoBusca: 'Verão Turismo Praias Hidratação Saúde',
    recadoTitulo: '☀️ FÉRIAS & LAZER NO CONDOMÍNIO',
    recadoTexto: 'Aproveite o verão e as áreas de lazer com sua família! Lembramos da importância de acompanhar as crianças na piscina e nas áreas comuns.',
    cartelaCategoria: '☀️ TEMPORADA DE VERÃO & FÉRIAS',
    cartelaTitulo: 'Férias com Alegria e Segurança',
    cartelaSubtitulo: 'Aproveite a piscina e os espaços de lazer respeitando as normas de convivência.',
    cartelaDicaBranca: '💧 Dica de Verão: Beba bastante água, use protetor solar diariamente e supervisione sempre as crianças na piscina.'
  },
  carnaval: {
    id: 'carnaval',
    nome: 'Carnaval com Alegria e Paz',
    icone: '🎭',
    periodo: 'Fevereiro',
    corPrimaria: '#7e22ce',
    corSecundaria: '#581c87',
    corDestaque: '#f3e8ff',
    corTextoDestaque: '#6b21a8',
    footerBg: 'linear-gradient(180deg, #faf5ff 0%, #f3e8ff 100%)',
    seloTexto: '🎭 BOM CARNAVAL • ALEGRIA E BOA CONVIVÊNCIA',
    assuntoBusca: 'Carnaval Cultura Turismo Viagem',
    recadoTitulo: '🎭 FERIADO DE CARNAVAL',
    recadoTexto: 'Desejamos um ótimo feriado de Carnaval a todos! Para quem vai viajar ou descansar no condomínio, contem com nossa atenção à segurança e ao sossego.',
    cartelaCategoria: '🎭 FERIADO DE CARNAVAL',
    cartelaTitulo: 'Bom Carnaval a Todos!',
    cartelaSubtitulo: 'Seja descansando ou festejando, desejamos dias de muita alegria, paz e segurança para sua família.',
    cartelaDicaBranca: '🎉 Dica para o Feriado: Hidrate-se bem, cuide da segurança ao viajar e aproveite os dias de descanso com responsabilidade.'
  },
  dia_mulher: {
    id: 'dia_mulher',
    nome: 'Dia Internacional da Mulher',
    icone: '🌷',
    periodo: '01 a 12 de Março',
    corPrimaria: '#be185d',
    corSecundaria: '#831843',
    corDestaque: '#fce7f3',
    corTextoDestaque: '#9d174d',
    footerBg: 'linear-gradient(180deg, #fdf2f8 0%, #fce7f3 100%)',
    seloTexto: '🌷 8 DE MARÇO • DIA INTERNACIONAL DA MULHER',
    assuntoBusca: 'Dia Internacional da Mulher Saúde Bem-Estar',
    recadoTitulo: '🌷 HOMENAGEM ÀS MULHERES',
    recadoTexto: 'Nossa homenagem e carinho a todas as moradoras e colaboradoras do Modern Life Residence pelo Dia Internacional da Mulher!',
    cartelaCategoria: '🌷 8 DE MARÇO • HOMENAGEM ESPECIAL',
    cartelaTitulo: 'Feliz Dia Internacional da Mulher',
    cartelaSubtitulo: 'Parabéns a todas as mulheres que transformam nossa comunidade com força, delicadeza e sabedoria.',
    cartelaDicaBranca: '🌷 Valorizar, respeitar e apoiar as mulheres todos os dias constrói uma sociedade mais justa e acolhedora.'
  },
  pascoa: {
    id: 'pascoa',
    nome: 'Feliz Páscoa em Família',
    icone: '🐰',
    periodo: 'Março / Abril',
    corPrimaria: '#92400e',
    corSecundaria: '#78350f',
    corDestaque: '#fef3c7',
    corTextoDestaque: '#78350f',
    footerBg: 'linear-gradient(180deg, #fffbeb 0%, #fde68a 100%)',
    seloTexto: '🐰 FELIZ PÁSCOA • UNIÃO, PAZ E RENOVAÇÃO',
    assuntoBusca: 'Páscoa Gastronomia Chocolate Família',
    recadoTitulo: '🐰 FELIZ PÁSCOA ÀS FAMÍLIAS',
    recadoTexto: 'Que o domingo de Páscoa renove o amor, a paz e a esperança no lar de cada família do Modern Life Residence!',
    cartelaCategoria: '🐰 CELEBRAÇÃO DE PÁSCOA',
    cartelaTitulo: 'Feliz e Abençoada Páscoa!',
    cartelaSubtitulo: 'Um tempo de renovação, esperança, doçura e união para todas as famílias.',
    cartelaDicaBranca: '🕊️ Que a Páscoa fortaleça os laços familiares, o perdão, a gratidão e a partilha em cada lar!'
  },
  dia_maes: {
    id: 'dia_maes',
    nome: 'Especial Dia das Mães',
    icone: '💐',
    periodo: '01 a 15 de Maio',
    corPrimaria: '#e11d48',
    corSecundaria: '#9f1239',
    corDestaque: '#ffe4e6',
    corTextoDestaque: '#9f1239',
    footerBg: 'linear-gradient(180deg, #fff1f2 0%, #ffe4e6 100%)',
    seloTexto: '💐 HOMENAGEM ESPECIAL • FELIZ DIA DAS MÃES',
    assuntoBusca: 'Dia das Mães Família Gastronomia Homenagem',
    recadoTitulo: '💐 FELIZ DIA DAS MÃES',
    recadoTexto: 'A todas as mães do Modern Life Residence, nossa admiração e carinho por todo o amor e dedicação às suas famílias. Feliz Dia das Mães!',
    cartelaCategoria: '💐 HOMENAGEM DIA DAS MÃES',
    cartelaTitulo: 'Feliz Dia das Mães!',
    cartelaSubtitulo: 'Todo o nosso carinho às mães que enchem cada lar de amor, cuidado e inspiração.',
    cartelaDicaBranca: '💐 Demonstre seu amor hoje e sempre com presença, afeto, escuta e gratidão por quem sempre cuidou de você!'
  },
  sao_joao: {
    id: 'sao_joao',
    nome: 'Festas Juninas & São João',
    icone: '🌽',
    periodo: 'Junho',
    corPrimaria: '#c2410c',
    corSecundaria: '#9a3412',
    corDestaque: '#ffedd5',
    corTextoDestaque: '#9a3412',
    footerBg: 'linear-gradient(180deg, #fff7ed 0%, #fed7aa 100%)',
    seloTexto: '🌽 VIVA SÃO JOÃO • FESTAS JUNINAS E TRADIÇÃO',
    assuntoBusca: 'São João Festas Juninas Culinária Nordeste Cultura',
    recadoTitulo: '🌽 BOAS FESTAS JUNINAS • SÃO JOÃO',
    recadoTexto: 'Viva São João! Aproveite as delícias e tradições juninas com sua família. Lembramos que não é permitido soltar fogos nas áreas do condomínio.',
    cartelaCategoria: '🌽 TRADIÇÃO NORDESTINA • SÃO JOÃO',
    cartelaTitulo: 'Viva São João!',
    cartelaSubtitulo: 'Mês de alegria, milho verde, canjica, forró e confraternização entre as famílias!',
    cartelaDicaBranca: '🪗 Celebre as tradições juninas com segurança: evite fogos de artifício e proteja crianças, idosos e animais de estimação.'
  },
  dia_pais: {
    id: 'dia_pais',
    nome: 'Especial Dia dos Pais',
    icone: '👔',
    periodo: '01 a 15 de Agosto',
    corPrimaria: '#1e3a8a',
    corSecundaria: '#172554',
    corDestaque: '#dbeafe',
    corTextoDestaque: '#1e40af',
    footerBg: 'linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)',
    seloTexto: '👔 HOMENAGEM ESPECIAL • FELIZ DIA DOS PAIS',
    assuntoBusca: 'Dia dos Pais Família Esportes Lazer',
    recadoTitulo: '👔 FELIZ DIA DOS PAIS',
    recadoTexto: 'Parabéns a todos os pais do Modern Life Residence pelo exemplo, dedicação e companheirismo com seus filhos e famílias!',
    cartelaCategoria: '👔 HOMENAGEM DIA DOS PAIS',
    cartelaTitulo: 'Feliz Dia dos Pais!',
    cartelaSubtitulo: 'Nossa homenagem a todos os pais que constroem histórias de amor, proteção e parceria todos os dias.',
    cartelaDicaBranca: '👔 Ser pai é ensinar pelo exemplo, caminhar junto e dedicar tempo de qualidade aos filhos todos os dias!'
  },
  independencia: {
    id: 'independencia',
    nome: 'Semana da Pátria / 7 de Setembro',
    icone: '🇧🇷',
    periodo: '01 a 10 de Setembro',
    corPrimaria: '#15803d',
    corSecundaria: '#14532d',
    corDestaque: '#fef08a',
    corTextoDestaque: '#166534',
    footerBg: 'linear-gradient(180deg, #f0fdf4 0%, #fef9c3 100%)',
    seloTexto: '🇧🇷 7 DE SETEMBRO • SEMANA DA PÁTRIA',
    assuntoBusca: 'Brasil Turismo Cultura História',
    recadoTitulo: '🇧🇷 FERIADO DE 7 DE SETEMBRO',
    recadoTexto: 'Desejamos a todos os moradores um excelente feriado da Independência do Brasil com descanso, segurança e harmonia!',
    cartelaCategoria: '🇧🇷 7 DE SETEMBRO • SEMANA DA PÁTRIA',
    cartelaTitulo: 'Bom Feriado da Independência!',
    cartelaSubtitulo: 'Que a cidadania, o respeito e a união estejam sempre presentes em nossa comunidade.',
    cartelaDicaBranca: '🇧🇷 Cidadania começa no dia a dia com respeito ao próximo, preservação do espaço coletivo e solidariedade.'
  },
  primavera: {
    id: 'primavera',
    nome: 'Estação Primavera & Meio Ambiente',
    icone: '🌸',
    periodo: '21 a 30 de Setembro',
    corPrimaria: '#059669',
    corSecundaria: '#065f46',
    corDestaque: '#d1fae5',
    corTextoDestaque: '#065f46',
    footerBg: 'linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%)',
    seloTexto: '🌸 BEM-VINDA PRIMAVERA • PRESERVE NOSSOS JARDINS',
    assuntoBusca: 'Primavera Jardinagem Natureza Flores Meio Ambiente',
    recadoTitulo: '🌸 CHEGADA DA PRIMAVERA',
    recadoTexto: 'A estação das flores chegou! Colabore com a preservação dos jardins e áreas verdes do Modern Life Residence.',
    cartelaCategoria: '🌸 ESTAÇÃO DAS FLORES • PRIMAVERA',
    cartelaTitulo: 'Bem-vinda, Primavera!',
    cartelaSubtitulo: 'Cuidar das plantas e áreas verdes deixa nosso ambiente ainda mais bonito e acolhedor.',
    cartelaDicaBranca: '🌱 Dica Sustentável: Economize água, separe materiais recicláveis e ajude a preservar nossos jardins e canteiros.'
  },
  dia_criancas: {
    id: 'dia_criancas',
    nome: 'Semana das Crianças',
    icone: '🧸',
    periodo: '01 a 12 de Outubro',
    corPrimaria: '#0284c7',
    corSecundaria: '#0369a1',
    corDestaque: '#fef08a',
    corTextoDestaque: '#0369a1',
    footerBg: 'linear-gradient(180deg, #f0f9ff 0%, #fef9c3 100%)',
    seloTexto: '🧸 12 DE OUTUBRO • FELIZ DIA DAS CRIANÇAS',
    assuntoBusca: 'Dia das Crianças Educação Brincadeiras Família',
    recadoTitulo: '🧸 FELIZ DIA DAS CRIANÇAS',
    recadoTexto: 'Que a alegria e a pureza das crianças iluminem sempre o nosso condomínio! Feliz Dia das Crianças a todos os pequenos moradores!',
    cartelaCategoria: '🧸 12 DE OUTUBRO • MÊS DAS CRIANÇAS',
    cartelaTitulo: 'Feliz Dia das Crianças!',
    cartelaSubtitulo: 'Brincar, sorrir e aprender com segurança: nosso carinho especial a todas as crianças!',
    cartelaDicaBranca: '🧸 Incentive brincadeiras ao ar livre, leitura e convivência segura entre as crianças nas áreas de lazer!'
  },
  outubro_rosa: {
    id: 'outubro_rosa',
    nome: 'Outubro Rosa (Prevenção)',
    icone: '🎀',
    periodo: 'Outubro (13 a 31)',
    corPrimaria: '#db2777',
    corSecundaria: '#9d174d',
    corDestaque: '#fce7f3',
    corTextoDestaque: '#9d174d',
    footerBg: 'linear-gradient(180deg, #fdf2f8 0%, #fce7f3 100%)',
    seloTexto: '🎀 OUTUBRO ROSA • PREVENÇÃO É AMOR À VIDA',
    assuntoBusca: 'Outubro Rosa Saúde da Mulher Prevenção Bem-Estar',
    recadoTitulo: '🎀 CAMPANHA OUTUBRO ROSA',
    recadoTexto: 'O Modern Life Residence apoia o Outubro Rosa! O diagnóstico precoce e o cuidado com a saúde salvam vidas. Cuide-se!',
    cartelaCategoria: '🎀 CONSCIENTIZAÇÃO • OUTUBRO ROSA',
    cartelaTitulo: 'Outubro Rosa: Cuide de Você',
    cartelaSubtitulo: 'Um gesto de autocuidado e prevenção pela saúde e bem-estar de todas as mulheres.',
    cartelaDicaBranca: '🩺 Dica de Saúde da Mulher: Realize seus exames preventivos regularmente, conheça seu corpo e pratique hábitos saudáveis.'
  },
  novembro_azul: {
    id: 'novembro_azul',
    nome: 'Novembro Azul (Saúde & Prevenção)',
    icone: '💙',
    periodo: 'Novembro',
    corPrimaria: '#1d4ed8',
    corSecundaria: '#1e3a8a',
    corDestaque: '#dbeafe',
    corTextoDestaque: '#1e40af',
    footerBg: 'linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)',
    seloTexto: '💙 NOVEMBRO AZUL • CUIDAR DA SAÚDE É VIVER MELHOR',
    assuntoBusca: 'Novembro Azul Saúde Prevenção Qualidade de Vida',
    recadoTitulo: '💙 CAMPANHA NOVEMBRO AZUL',
    recadoTexto: 'O Modern Life Residence apoia o Novembro Azul! Manter os exames em dia e cuidar da saúde é uma atitude de coragem pela sua família.',
    cartelaCategoria: '💙 CONSCIENTIZAÇÃO • NOVEMBRO AZUL',
    cartelaTitulo: 'Novembro Azul: Prevenção é Vida',
    cartelaSubtitulo: 'Incentivamos todos os moradores a cuidarem da saúde com hábitos saudáveis e acompanhamento preventivo.',
    cartelaDicaBranca: '🩺 Cuide da saúde do homem: consulte o urologista regularmente, mantenha os exames em dia e pratique atividades físicas.'
  },
  natal: {
    id: 'natal',
    nome: 'Natal & Boas Festas',
    icone: '🎄',
    periodo: '01 a 25 de Dezembro',
    corPrimaria: '#b91c1c',
    corSecundaria: '#7f1d1d',
    corDestaque: '#fef3c7',
    corTextoDestaque: '#991b1b',
    footerBg: 'linear-gradient(180deg, #fef2f2 0%, #fef3c7 100%)',
    seloTexto: '🎄 FELIZ NATAL • PAZ, AMOR E UNIÃO NAS FAMÍLIAS',
    assuntoBusca: 'Natal Ceia Decoração Solidariedade Boas Festas',
    recadoTitulo: '🎄 FELIZ NATAL • MODERN LIFE',
    recadoTexto: 'Desejamos um Feliz e Abençoado Natal a todos os moradores e colaboradores do Modern Life Residence, com muita paz, amor e união!',
    cartelaCategoria: '🎄 ESPECIAL DE NATAL • BOAS FESTAS',
    cartelaTitulo: 'Feliz Natal e Boas Festas!',
    cartelaSubtitulo: 'Que o espírito natalino ilumine cada lar do nosso condomínio com amor, fraternidade e esperança.',
    cartelaDicaBranca: '🎄 Que a solidariedade, a paz e a harmonia estejam presentes em todas as famílias neste Natal e durante todo o ano!'
  }
};

function resolveActiveSeasonalTheme(temaConfigurado) {
  var key = temaConfigurado || 'padrao';
  if (key === 'auto_calendario') {
    var now = new Date();
    var m = now.getMonth() + 1; // 1..12
    var d = now.getDate();
    if ((m === 12 && d >= 26) || (m === 1 && d <= 10)) {
      key = 'ano_novo';
    } else if (m === 1) {
      key = 'verao_ferias';
    } else if (m === 2) {
      key = 'carnaval';
    } else if (m === 3 && d <= 12) {
      key = 'dia_mulher';
    } else if (m === 3 || m === 4) {
      key = 'pascoa';
    } else if (m === 5 && d <= 15) {
      key = 'dia_maes';
    } else if (m === 6) {
      key = 'sao_joao';
    } else if (m === 8 && d <= 15) {
      key = 'dia_pais';
    } else if (m === 9 && d <= 10) {
      key = 'independencia';
    } else if (m === 9 && d >= 21) {
      key = 'primavera';
    } else if (m === 10 && d <= 12) {
      key = 'dia_criancas';
    } else if (m === 10) {
      key = 'outubro_rosa';
    } else if (m === 11) {
      key = 'novembro_azul';
    } else if (m === 12) {
      key = 'natal';
    } else {
      key = 'padrao';
    }
  }
  return SEASONAL_THEMES_CATALOG[key] || SEASONAL_THEMES_CATALOG.padrao;
}

var AMBIENT_MUSIC_CATALOG = {
  gospel_piano: {
    id: 'gospel_piano',
    nome: 'Melodias Gospel: Piano & Adoração Suave',
    icone: '🕊️',
    categoria: 'Gospel & Evangélica Instrumental (100% Offline)',
    cor: '#0369a1',
    descricao: 'Arranjos suaves de piano inspirados em hinos clássicos ("Grandioso És Tu", "Sublime Graça") e louvores de paz para o condomínio.',
    tipo: 'synth',
    preset: 'gospel_piano'
  },
  gospel_harpa_violao: {
    id: 'gospel_harpa_violao',
    nome: 'Harpa Cristã & Violão Acústico Evangélico',
    icone: '🙏',
    categoria: 'Gospel & Evangélica Instrumental (100% Offline)',
    cor: '#0d9488',
    descricao: 'Melodias serenas em violão e harpa inspiradas nos hinos tradicionais ("Porque Ele Vive", "Mais Perto Quero Estar").',
    tipo: 'synth',
    preset: 'gospel_harpa_violao'
  },
  gospel_cordas_paz: {
    id: 'gospel_cordas_paz',
    nome: 'Louvor Instrumental & Cordas Celestiais',
    icone: '✨',
    categoria: 'Gospel & Evangélica Instrumental (100% Offline)',
    cor: '#4f46e5',
    descricao: 'Harmonia orquestral suave com cordas e melodia contemplativa transmitindo paz, fé e comunhão no ambiente.',
    tipo: 'synth',
    preset: 'gospel_cordas_paz'
  },
  radio_gospel_instrumental: {
    id: 'radio_gospel_instrumental',
    nome: 'Rádio Gospel: Hinos Instrumentais 24h',
    icone: '📻',
    categoria: 'Rádio Evangélica Online 24h (Internet)',
    cor: '#0284c7',
    descricao: 'Transmissão online 24h de hinos cristãos e melodias evangélicas instrumentais em piano, harpa e violão.',
    tipo: 'stream',
    streamUrl: 'https://s2.ssl-stream.com/listen/abiding_radio/instrumental.mp3',
    fallbackPreset: 'gospel_piano'
  },
  radio_gospel_louvor: {
    id: 'radio_gospel_louvor',
    nome: 'Rádio Evangélica: Louvor & Adoração Suave 24h',
    icone: '🙌',
    categoria: 'Rádio Evangélica Online 24h (Internet)',
    cor: '#2563eb',
    descricao: 'Programação cristã online 24h com hinos sacros, corais suaves e louvores edificantes para a família.',
    tipo: 'stream',
    streamUrl: 'https://s2.ssl-stream.com/listen/abiding_radio/sacred.mp3',
    fallbackPreset: 'gospel_harpa_violao'
  },
  piano_lounge: {
    id: 'piano_lounge',
    nome: 'Piano Lounge & Recepção',
    icone: '🎹',
    categoria: 'Instrumental Integrado (100% Offline)',
    cor: '#1e40af',
    descricao: 'Acordes suaves de piano elétrico e melodia relaxante ideal para recepção, hall e elevadores.',
    tipo: 'synth',
    preset: 'piano_lounge'
  },
  bossa_jazz: {
    id: 'bossa_jazz',
    nome: 'Bossa Nova & Jazz Suave',
    icone: '🎷',
    categoria: 'Instrumental Integrado (100% Offline)',
    cor: '#b45309',
    descricao: 'Harmonia acolhedora com cadência leve de Bossa Nova e Jazz Lounge para ambientes elegantes.',
    tipo: 'synth',
    preset: 'bossa_jazz'
  },
  violao_acustico: {
    id: 'violao_acustico',
    nome: 'Violão & Harpa Acústica',
    icone: '🎸',
    categoria: 'Instrumental Integrado (100% Offline)',
    cor: '#15803d',
    descricao: 'Dedilhado acústico sereno e aconchegante para uma atmosfera tranquila no condomínio.',
    tipo: 'synth',
    preset: 'violao_acustico'
  },
  spa_zen: {
    id: 'spa_zen',
    nome: 'Spa, Zen & Bem-Estar',
    icone: '🌿',
    categoria: 'Instrumental Integrado (100% Offline)',
    cor: '#0f766e',
    descricao: 'Texturas sonoras relaxantes e acordes flutuantes que transmitem paz e tranquilidade.',
    tipo: 'synth',
    preset: 'spa_zen'
  },
  classico_suave: {
    id: 'classico_suave',
    nome: 'Clássico & Cordas Suaves',
    icone: '🎻',
    categoria: 'Instrumental Integrado (100% Offline)',
    cor: '#6d28d9',
    descricao: 'Arranjo suave inspirado em música clássica de câmara para um ambiente sofisticado.',
    tipo: 'synth',
    preset: 'classico_suave'
  },
  radio_lounge: {
    id: 'radio_lounge',
    nome: 'Rádio Online: Lounge & Bossa 24h',
    icone: '📻',
    categoria: 'Rádio Online 24h (Internet)',
    cor: '#0284c7',
    descricao: 'Transmissão contínua 24h de música Lounge, Bossa e Instrumental via internet.',
    tipo: 'stream',
    streamUrl: 'https://ice1.somafm.com/illstreet-128-mp3',
    fallbackPreset: 'bossa_jazz'
  },
  radio_chill: {
    id: 'radio_chill',
    nome: 'Rádio Online: Ambient Chillout 24h',
    icone: '☁️',
    categoria: 'Rádio Online 24h (Internet)',
    cor: '#4f46e5',
    descricao: 'Rádio online 24h de música ambiente downtempo e instrumental relaxante.',
    tipo: 'stream',
    streamUrl: 'https://ice1.somafm.com/groovesalad-128-mp3',
    fallbackPreset: 'piano_lounge'
  },
  radio_lush: {
    id: 'radio_lush',
    nome: 'Rádio Online: Melodias Calmas 24h',
    icone: '🎶',
    categoria: 'Rádio Online 24h (Internet)',
    cor: '#be185d',
    descricao: 'Seleção suave de músicas calmas e relaxantes via streaming online 24h.',
    tipo: 'stream',
    streamUrl: 'https://ice1.somafm.com/lush-128-mp3',
    fallbackPreset: 'spa_zen'
  },
  custom_mp3: {
    id: 'custom_mp3',
    nome: 'Minhas Músicas MP3 / Rádio Personalizada',
    icone: '💿',
    categoria: 'Playlist Personalizada do Condomínio',
    cor: '#2a5e35',
    descricao: 'Toca em sequência as músicas MP3 ou links de rádio que você cadastrar na lista abaixo.',
    tipo: 'custom',
    fallbackPreset: 'piano_lounge'
  }
};

function VidaModernaAmbientAudio() {
  this.ctx = null;
  this.masterGain = null;
  this.filterNode = null;
  this.isPlaying = false;
  this.currentStyleId = 'piano_lounge';
  this.volumePct = 30;
  this.synthTimer = null;
  this.stepIndex = 0;
  this.audioEl = null;
  this.customTracks = [];
  this.customTrackIdx = 0;
  this.statusCallback = null;
}

VidaModernaAmbientAudio.prototype.onStatusChange = function (cb) {
  this.statusCallback = cb;
};

VidaModernaAmbientAudio.prototype.notifyStatus = function (playing, label) {
  if (this.statusCallback) {
    try { this.statusCallback(playing, label); } catch (e) {}
  }
};

VidaModernaAmbientAudio.prototype.ensureContext = function () {
  if (!this.ctx) {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    this.ctx = new AudioCtx();
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = 1150;
    this.filterNode.Q.value = 0.7;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = (this.volumePct / 100) * 0.28;

    this.filterNode.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
  }
  if (this.ctx && this.ctx.state === 'suspended' && this.ctx.resume) {
    try { this.ctx.resume(); } catch (e) {}
  }
  return this.ctx;
};

VidaModernaAmbientAudio.prototype.ensureAudioElement = function () {
  if (!this.audioEl) {
    this.audioEl = document.createElement('audio');
    this.audioEl.preload = 'auto';
    this.audioEl.style.display = 'none';
    if (document.body) {
      document.body.appendChild(this.audioEl);
    }
    var self = this;
    this.audioEl.onended = function () {
      if (self.isPlaying && self.currentStyleId === 'custom_mp3') {
        self.customTrackIdx = (self.customTrackIdx + 1) % Math.max(1, self.customTracks.length);
        self.playCustomTrack();
      }
    };
    this.audioEl.onerror = function () {
      if (!self.isPlaying) return;
      var st = AMBIENT_MUSIC_CATALOG[self.currentStyleId];
      if (self.currentStyleId === 'custom_mp3' && self.customTracks.length > 1) {
        self.customTrackIdx = (self.customTrackIdx + 1) % self.customTracks.length;
        setTimeout(function () {
          if (self.isPlaying) self.playCustomTrack();
        }, 1200);
      } else {
        self.startSynthLoop((st && st.fallbackPreset) ? st.fallbackPreset : 'piano_lounge');
      }
    };
  }
  this.audioEl.volume = Math.max(0, Math.min(1, this.volumePct / 100));
  return this.audioEl;
};

VidaModernaAmbientAudio.prototype.setVolume = function (pct) {
  var v = Number(pct);
  if (isNaN(v)) v = 30;
  this.volumePct = Math.max(0, Math.min(100, v));
  if (this.masterGain && this.ctx) {
    try {
      this.masterGain.gain.setTargetAtTime((this.volumePct / 100) * 0.28, this.ctx.currentTime, 0.08);
    } catch (e) {
      this.masterGain.gain.value = (this.volumePct / 100) * 0.28;
    }
  }
  if (this.audioEl) {
    this.audioEl.volume = Math.max(0, Math.min(1, this.volumePct / 100));
  }
};

VidaModernaAmbientAudio.prototype.playTone = function (freq, durationSec, delaySec, waveType, gainMult, attackSec) {
  var ctx = this.ensureContext();
  if (!ctx || !this.filterNode) return;
  try {
    var now = ctx.currentTime + (delaySec || 0);
    var osc = ctx.createOscillator();
    var noteGain = ctx.createGain();

    osc.type = waveType || 'sine';
    osc.frequency.setValueAtTime(freq, now);

    var peak = (gainMult || 0.22);
    var atk = attackSec || 0.18;
    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.linearRampToValueAtTime(peak, now + atk);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(noteGain);
    noteGain.connect(this.filterNode);

    osc.start(now);
    osc.stop(now + durationSec + 0.05);
  } catch (e) {}
};

var SYNTH_PROGRESSIONS = {
  gospel_piano: {
    stepMs: 3600,
    wave: 'sine',
    melodyWave: 'triangle',
    attack: 0.18,
    chords: [
      // "Sublime Graça" (Amazing Grace) & "Grandioso És Tu" (How Great Thou Art) em Dó Maior
      { notes: [130.81, 196.00, 261.63, 329.63], melody: [392.00, 523.25, 659.25, 523.25] }, // C
      { notes: [130.81, 196.00, 246.94, 329.63], melody: [659.25, 587.33, 523.25, 440.00] }, // Cmaj7
      { notes: [174.61, 220.00, 261.63, 349.23], melody: [392.00, 329.63, 392.00, 523.25] }, // Fmaj7
      { notes: [196.00, 246.94, 293.66, 392.00], melody: [659.25, 587.33, 783.99, 659.25] }, // G
      { notes: [130.81, 196.00, 261.63, 329.63], melody: [392.00, 523.25, 659.25, 698.46] }, // C ("Então minh'alma...")
      { notes: [174.61, 220.00, 261.63, 349.23], melody: [587.33, 698.46, 659.25, 587.33] }, // F
      { notes: [146.83, 220.00, 293.66, 349.23], melody: [523.25, 493.88, 587.33, 493.88] }, // Dm7 -> G
      { notes: [130.81, 196.00, 261.63, 329.63], melody: [523.25, 392.00, 329.63, 523.25] }  // C
    ]
  },
  gospel_harpa_violao: {
    stepMs: 3200,
    wave: 'triangle',
    melodyWave: 'triangle',
    attack: 0.08,
    chords: [
      // "Porque Ele Vive" (Because He Lives) em Sol Maior
      { notes: [196.00, 246.94, 293.66, 392.00], melody: [293.66, 392.00, 440.00, 493.88] }, // G
      { notes: [130.81, 196.00, 261.63, 329.63], melody: [523.25, 659.25, 587.33, 523.25] }, // C
      { notes: [146.83, 196.00, 246.94, 392.00], melody: [493.88, 392.00, 493.88, 587.33] }, // G/D
      { notes: [146.83, 220.00, 293.66, 369.99], melody: [440.00, 493.88, 440.00, 392.00] }, // D7
      { notes: [196.00, 246.94, 293.66, 392.00], melody: [493.88, 587.33, 783.99, 587.33] }, // G
      { notes: [130.81, 196.00, 261.63, 329.63], melody: [659.25, 783.99, 659.25, 523.25] }, // C
      { notes: [146.83, 196.00, 246.94, 369.99], melody: [587.33, 493.88, 440.00, 493.88] }, // G/D -> D7
      { notes: [196.00, 246.94, 293.66, 392.00], melody: [392.00, 493.88, 587.33, 392.00] }  // G
    ]
  },
  gospel_cordas_paz: {
    stepMs: 4000,
    wave: 'sine',
    melodyWave: 'sine',
    attack: 0.55,
    chords: [
      // "Mais Perto Quero Estar" & "Bondoso Amigo" em Fá Maior
      { notes: [174.61, 220.00, 261.63, 349.23], melody: [440.00, 392.00, 349.23, 349.23] }, // Fmaj7
      { notes: [116.54, 174.61, 233.08, 293.66], melody: [293.66, 349.23, 466.16, 440.00] }, // Bb
      { notes: [130.81, 196.00, 261.63, 349.23], melody: [392.00, 440.00, 392.00, 349.23] }, // C7sus4
      { notes: [174.61, 220.00, 261.63, 349.23], melody: [523.25, 587.33, 523.25, 440.00] }, // Fmaj7
      { notes: [116.54, 174.61, 233.08, 293.66], melody: [349.23, 293.66, 349.23, 440.00] }, // Bb
      { notes: [130.81, 174.61, 220.00, 349.23], melody: [392.00, 349.23, 392.00, 440.00] }  // F
    ]
  },
  piano_lounge: {
    stepMs: 3600,
    wave: 'sine',
    melodyWave: 'triangle',
    attack: 0.16,
    chords: [
      { notes: [130.81, 196.00, 246.94, 293.66, 329.63], melody: [523.25, 493.88, 392.00, 440.00] }, // Cmaj9
      { notes: [110.00, 164.81, 220.00, 246.94, 261.63], melody: [440.00, 392.00, 329.63, 392.00] }, // Am9
      { notes: [146.83, 220.00, 261.63, 329.63, 349.23], melody: [440.00, 523.25, 493.88, 440.00] }, // Dm9
      { notes: [98.00, 196.00, 246.94, 293.66, 329.63], melody: [392.00, 440.00, 493.88, 392.00] }   // G13
    ]
  },
  bossa_jazz: {
    stepMs: 3200,
    wave: 'triangle',
    melodyWave: 'sine',
    attack: 0.12,
    chords: [
      { notes: [174.61, 220.00, 261.63, 329.63, 392.00], melody: [523.25, 440.00, 392.00, 349.23] }, // Fmaj9
      { notes: [164.81, 246.94, 293.66, 349.23, 392.00], melody: [493.88, 392.00, 329.63, 392.00] }, // Em7
      { notes: [146.83, 220.00, 261.63, 329.63, 349.23], melody: [440.00, 349.23, 329.63, 293.66] }, // Dm9
      { notes: [130.81, 196.00, 246.94, 293.66, 329.63], melody: [392.00, 440.00, 523.25, 493.88] }  // Cmaj9
    ]
  },
  violao_acustico: {
    stepMs: 3000,
    wave: 'triangle',
    melodyWave: 'triangle',
    attack: 0.06,
    chords: [
      { notes: [196.00, 246.94, 293.66, 392.00], melody: [587.33, 493.88, 392.00, 440.00] }, // G
      { notes: [164.81, 246.94, 329.63, 392.00], melody: [493.88, 440.00, 392.00, 329.63] }, // Em7
      { notes: [130.81, 196.00, 261.63, 329.63], melody: [523.25, 392.00, 329.63, 392.00] }, // Cadd9
      { notes: [146.83, 220.00, 293.66, 369.99], melody: [440.00, 369.99, 293.66, 329.63] }  // D
    ]
  },
  spa_zen: {
    stepMs: 4800,
    wave: 'sine',
    melodyWave: 'sine',
    attack: 0.85,
    chords: [
      { notes: [130.81, 196.00, 261.63, 329.63, 392.00], melody: [523.25, 659.25, 587.33] },
      { notes: [174.61, 261.63, 329.63, 440.00], melody: [523.25, 440.00, 392.00] },
      { notes: [110.00, 220.00, 261.63, 329.63, 392.00], melody: [440.00, 523.25, 392.00] },
      { notes: [146.83, 220.00, 293.66, 392.00], melody: [493.88, 440.00, 392.00] }
    ]
  },
  classico_suave: {
    stepMs: 3800,
    wave: 'triangle',
    melodyWave: 'sine',
    attack: 0.45,
    chords: [
      { notes: [130.81, 196.00, 261.63, 329.63], melody: [523.25, 493.88, 523.25, 659.25] }, // C
      { notes: [98.00, 196.00, 246.94, 293.66], melody: [587.33, 493.88, 440.00, 392.00] },  // G
      { notes: [110.00, 164.81, 220.00, 261.63], melody: [440.00, 392.00, 440.00, 523.25] }, // Am
      { notes: [174.61, 220.00, 261.63, 349.23], melody: [440.00, 392.00, 349.23, 329.63] }  // F
    ]
  }
};

VidaModernaAmbientAudio.prototype.startSynthLoop = function (presetKey) {
  if (this.synthTimer) {
    clearInterval(this.synthTimer);
    this.synthTimer = null;
  }
  var preset = SYNTH_PROGRESSIONS[presetKey] || SYNTH_PROGRESSIONS.piano_lounge;
  var self = this;

  function triggerStep() {
    if (!self.isPlaying) return;
    var chordObj = preset.chords[self.stepIndex % preset.chords.length];
    self.stepIndex++;

    var durSec = (preset.stepMs / 1000) * 1.15;
    for (var i = 0; i < chordObj.notes.length; i++) {
      var arpDelay = (presetKey === 'violao_acustico' || presetKey === 'gospel_harpa_violao') ? (i * 0.22) : (i * 0.08);
      self.playTone(chordObj.notes[i], durSec, arpDelay, preset.wave, 0.16, preset.attack);
    }

    if (chordObj.melody && chordObj.melody.length) {
      var mCount = chordObj.melody.length;
      var stepSec = (preset.stepMs / 1000) / mCount;
      for (var m = 0; m < mCount; m++) {
        self.playTone(chordObj.melody[m], stepSec * 1.25, m * stepSec + 0.15, preset.melodyWave, 0.12, preset.attack * 0.8);
      }
    }
  }

  triggerStep();
  this.synthTimer = setInterval(triggerStep, preset.stepMs);
};

VidaModernaAmbientAudio.prototype.playCustomTrack = function () {
  if (!this.customTracks || !this.customTracks.length) {
    this.startSynthLoop('piano_lounge');
    return;
  }
  var track = this.customTracks[this.customTrackIdx % this.customTracks.length];
  if (!track || !track.url) {
    this.startSynthLoop('piano_lounge');
    return;
  }
  var audio = this.ensureAudioElement();
  try {
    if (audio.src !== track.url) {
      audio.src = track.url;
    }
    var p = audio.play();
    if (p && p['catch']) {
      var self = this;
      p['catch'](function () {
        self.startSynthLoop('piano_lounge');
      });
    }
  } catch (e) {
    this.startSynthLoop('piano_lounge');
  }
};

VidaModernaAmbientAudio.prototype.start = function (styleId, volumePct, customTracksList) {
  this.stop();
  this.currentStyleId = styleId || 'piano_lounge';
  this.setVolume(volumePct !== undefined ? volumePct : this.volumePct);

  var activeCustom = [];
  if (customTracksList && customTracksList.length) {
    for (var i = 0; i < customTracksList.length; i++) {
      if (customTracksList[i] && customTracksList[i].url && customTracksList[i].ativo !== false) {
        activeCustom.push(customTracksList[i]);
      }
    }
  }
  this.customTracks = activeCustom;
  this.isPlaying = true;

  var styleObj = AMBIENT_MUSIC_CATALOG[this.currentStyleId] || AMBIENT_MUSIC_CATALOG.piano_lounge;
  this.notifyStatus(true, styleObj.icone + ' ' + styleObj.nome);

  if (styleObj.tipo === 'stream' && styleObj.streamUrl) {
    var audio = this.ensureAudioElement();
    try {
      audio.src = styleObj.streamUrl;
      var p = audio.play();
      if (p && p['catch']) {
        var self = this;
        p['catch'](function () {
          if (self.isPlaying) {
            self.startSynthLoop(styleObj.fallbackPreset || 'piano_lounge');
          }
        });
      }
    } catch (e) {
      this.startSynthLoop(styleObj.fallbackPreset || 'piano_lounge');
    }
  } else if (styleObj.tipo === 'custom') {
    this.playCustomTrack();
  } else {
    this.startSynthLoop(styleObj.preset || 'piano_lounge');
  }
};

VidaModernaAmbientAudio.prototype.stop = function () {
  this.isPlaying = false;
  if (this.synthTimer) {
    clearInterval(this.synthTimer);
    this.synthTimer = null;
  }
  if (this.audioEl) {
    try {
      this.audioEl.pause();
      this.audioEl.removeAttribute('src');
    } catch (e) {}
  }
  this.notifyStatus(false, 'Música Ambiente Desativada');
};

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
    temaSazonal: 'padrao',
    musicaAtiva: false,
    musicaEstilo: 'piano_lounge',
    musicaVolume: 30,
    musicaHorarioInicio: '07:00',
    musicaHorarioFim: '22:00',
    musicaCustomList: [],
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
  this.seasonalCatalog = SEASONAL_THEMES_CATALOG;
  this.resolveSeasonalTheme = resolveActiveSeasonalTheme;
  this.ambientCatalog = AMBIENT_MUSIC_CATALOG;
  this.ambientPlayer = new VidaModernaAmbientAudio();
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
    this.saveLocalState(remoteState, true);
    this.notifyListeners(remoteState, 'cloud-sync');
  }

  var d = new Date();
  this.saveDeviceConfig({ lastWifiSync: d.toISOString() });
  this.notifyStatus('online', 'Online');
  return hasChanges;
};

/**
 * Sincronização sob comando (Supabase Nuvem como fonte única da verdade) sem loop automático!
 */
VidaModernaSyncManager.prototype.syncFromServer = function (forceRssCheck) {
  var self = this;
  return es5Async(function (resolve) {
    if (self.isSyncing || self.isPushing) {
      resolve({ synced: false, reason: 'busy' });
      return;
    }

    if (navigator.onLine === false) {
      self.notifyStatus('offline', 'Offline');
      resolve({ synced: false, reason: 'offline' });
      return;
    }

    self.isSyncing = true;
    var deviceCfg = self.getDeviceConfig();

    function finishSync(synced, updated) {
      self.isSyncing = false;
      resolve({ synced: synced, updated: updated, state: self.getLocalState() });
    }

    function stepRssManual() {
      if (!forceRssCheck) {
        self.notifyStatus('online', 'Pronto');
        finishSync(false, false);
        return;
      }
      self.fetchPublicRssFallback().then(function (rssUpdated) {
        var d2 = new Date();
        self.saveDeviceConfig({ lastWifiSync: d2.toISOString() });
        self.notifyStatus('online', 'Atualizado');
        if (rssUpdated) {
          self.notifyListeners(self.getLocalState(), 'manual-rss');
        }
        finishSync(true, rssUpdated);
      });
    }

    // Busca no Supabase Nuvem apenas quando chamado (abertura ou comando do usuário)
    if (deviceCfg.supabaseUrl && deviceCfg.supabaseAnonKey) {
      self.fetchFromSupabase(deviceCfg.supabaseUrl, deviceCfg.supabaseAnonKey).then(function (sbState) {
        if (sbState && sbState.config) {
          var updatedSb = self.processIncomingRemoteState(sbState, 'Online');
          if (forceRssCheck) {
            self.fetchPublicRssFallback().then(function () {
              finishSync(true, true);
            });
          } else {
            finishSync(true, updatedSb);
          }
        } else {
          self.notifyStatus('online', 'Pronto');
          finishSync(false, false);
        }
      });
    } else {
      stepRssManual();
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

function parseRssXmlItems(xmlText, fontePadrao, corPadrao, filtroNivel, customBlocked, apenasComFoto, statsObj) {
  var results = [];
  if (!xmlText || xmlText.indexOf('<item') === -1) return results;
  var itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  var match;
  while ((match = itemRegex.exec(xmlText)) !== null && results.length < 8) {
    if (statsObj) statsObj.analisadas++;
    var block = match[1];
    var titleMatch = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title[^>]*>([\s\S]*?)<\/title>/i);
    var descMatch = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description[^>]*>([\s\S]*?)<\/description>/i);
    var mediaMatch = block.match(/<media:content[^>]+url="([^"]+)"/i) ||
                     block.match(/<enclosure[^>]+url="([^"]+)"/i) ||
                     block.match(/<img[^>]+src="([^"]+)"/i);
    var sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);

    var rawTitle = titleMatch ? (titleMatch[1] || titleMatch[2] || '') : '';
    var title = rawTitle
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/^\s+|\s+$/g, '');
    var desc = descMatch ? (descMatch[1] || descMatch[2] || '') : '';
    if (!title) continue;

    if (!isFamilySafeNews(title, desc, filtroNivel, customBlocked)) {
      if (statsObj) statsObj.bloqueadas++;
      continue;
    }

    var imgUrl = mediaMatch ? mediaMatch[1] : '';
    if (!imgUrl && desc) {
      var mImg = desc.match(/src=["'](https?:\/\/[^"'>\s]+)["']/i);
      if (mImg && mImg[1]) imgUrl = mImg[1];
    }

    if (apenasComFoto && !imgUrl) continue;

    var fonteLabel = fontePadrao;
    if (sourceMatch && sourceMatch[1]) {
      var cleanSrc = sourceMatch[1].replace(/<[^>]+>/g, '').replace(/^\s+|\s+$/g, '').toUpperCase();
      if (cleanSrc) fonteLabel = cleanSrc + ' • ' + fontePadrao.replace('G1 • ', '');
    }

    results.push({
      id: 'rss-' + new Date().getTime() + '-' + Math.floor(Math.random() * 100000),
      fonte: fonteLabel,
      corBarra: corPadrao || '#2a5e35',
      titulo: title,
      imagemUrl: imgUrl || 'assets/news-bg-default.svg',
      publicadoEm: new Date().toISOString(),
      ativo: true
    });
  }
  return results;
}

function fetchRssFeedMultiProxy(feedUrl, fonteLabel, corBarra, filtroNivel, customBlocked, apenasComFoto, statsObj, cb) {
  // 1. Tenta AllOrigins XML Proxy (sem bloqueio Cloudflare)
  var allOriginsUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(feedUrl);
  xhrRequest('GET', allOriginsUrl, null, null, function (ok, status, text) {
    if (ok && text && text.indexOf('{') === 0) {
      try {
        var parsed = JSON.parse(text);
        if (parsed && parsed.contents && parsed.contents.indexOf('<item') !== -1) {
          var list = parseRssXmlItems(parsed.contents, fonteLabel, corBarra, filtroNivel, customBlocked, apenasComFoto, statsObj);
          if (list.length > 0) {
            cb(list);
            return;
          }
        }
      } catch (e) {}
    }

    // 2. Fallback: tenta rss2json
    var apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feedUrl);
    xhrRequest('GET', apiUrl, null, null, function (ok2, status2, text2) {
      var feedList = [];
      if (ok2 && text2 && text2.indexOf('{') === 0) {
        try {
          var data = JSON.parse(text2);
          if (data && data.items && data.items.length) {
            for (var i = 0; i < data.items.length; i++) {
              var item = data.items[i];
              if (statsObj) statsObj.analisadas++;
              var tTitle = (item.title || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/^\s+|\s+$/g, '');
              var tDesc = item.description || '';
              if (!tTitle) continue;
              if (!isFamilySafeNews(tTitle, tDesc, filtroNivel, customBlocked)) {
                if (statsObj) statsObj.bloqueadas++;
                continue;
              }
              var img = (item.enclosure && item.enclosure.link) ? item.enclosure.link : (item.thumbnail || '');
              if (!img && tDesc) {
                var m = tDesc.match(/<img[^>]+src="([^">]+)"/i);
                if (m && m[1]) img = m[1];
              }
              if (apenasComFoto && !img) continue;
              feedList.push({
                id: 'rss-' + new Date().getTime() + '-' + i,
                fonte: fonteLabel,
                corBarra: corBarra || '#2a5e35',
                titulo: tTitle,
                imagemUrl: img || 'assets/news-bg-default.svg',
                publicadoEm: item.pubDate || new Date().toISOString(),
                ativo: true
              });
              if (feedList.length >= 6) break;
            }
          }
        } catch (e2) {}
      }
      cb(feedList);
    });
  });
}

function fetchIbgeNewsByQuery(queryStr, etiquetaAssunto, corBarra, filtroNivel, customBlocked, statsObj, cb) {
  var qParam = queryStr ? ('&busca=' + encodeURIComponent(queryStr)) : '';
  var ibgeUrl = 'https://servicodados.ibge.gov.br/api/v3/noticias/?qtd=12' + qParam;
  xhrRequest('GET', ibgeUrl, null, null, function (ok, status, text) {
    var list = [];
    if (ok && text && text.indexOf('{') === 0) {
      try {
        var data = JSON.parse(text);
        if (data && data.items && data.items.length) {
          for (var i = 0; i < data.items.length; i++) {
            var it = data.items[i];
            if (statsObj) statsObj.analisadas++;
            var titulo = (it.titulo || '').replace(/^\s+|\s+$/g, '');
            var intro = it.introducao || '';
            if (!titulo) continue;
            if (!isFamilySafeNews(titulo, intro, filtroNivel, customBlocked)) {
              if (statsObj) statsObj.bloqueadas++;
              continue;
            }
            var imgUrl = 'assets/news-bg-default.svg';
            if (it.imagens) {
              try {
                var imgsObj = typeof it.imagens === 'string' ? JSON.parse(it.imagens) : it.imagens;
                var relPath = imgsObj.image_fulltext || imgsObj.image_intro || '';
                if (relPath) {
                  imgUrl = 'https://agenciadenoticias.ibge.gov.br/' + relPath.replace(/^\/+/, '');
                }
              } catch (eImg) {}
            }
            list.push({
              id: 'ibge-' + (it.id || i) + '-' + new Date().getTime(),
              fonte: 'AGÊNCIA IBGE • ' + (etiquetaAssunto || 'BRASIL').toUpperCase(),
              corBarra: corBarra || '#0d74b8',
              titulo: titulo,
              imagemUrl: imgUrl,
              publicadoEm: it.data_publicacao || new Date().toISOString(),
              ativo: true
            });
            if (list.length >= 8) break;
          }
        }
      } catch (e) {}
    }
    cb(list);
  });
}

/**
 * Busca notícias por Assunto ou Palavra-Chave (em G1, Google News Brasil e Agência IBGE)
 * Se toPendingQueue=true, envia os resultados para state.noticiasPendentes para o usuário aprovar!
 */
VidaModernaSyncManager.prototype.searchNewsByAssunto = function (assuntoQuery, fontePreferida, toPendingQueue) {
  var self = this;
  return es5Async(function (resolve) {
    var state = self.getLocalState();
    var cfg = state.config || {};
    var filtroNivel = cfg.filtroFamiliarNivel || 'rigoroso';
    var customBlocked = cfg.palavrasBloqueadas || '';
    var statsObj = { analisadas: 0, bloqueadas: 0 };
    var cleanQuery = (assuntoQuery || cfg.temaPersonalizado || 'Brasil').replace(/^\s+|\s+$/g, '');
    var fonteMode = fontePreferida || 'todas';

    var collected = [];

    function finishSearch() {
      var latestState = self.getLocalState();
      var excluidas = latestState.noticiasExcluidas || [];
      var excluidasMap = {};
      for (var eIdx = 0; eIdx < excluidas.length; eIdx++) {
        excluidasMap[excluidas[eIdx]] = true;
      }

      var seen = {};
      var existing = latestState.noticias || [];
      for (var exIdx = 0; exIdx < existing.length; exIdx++) {
        if (existing[exIdx] && existing[exIdx].titulo) {
          seen[existing[exIdx].titulo] = true;
        }
      }

      var uniqueResults = [];
      for (var cIdx = 0; cIdx < collected.length; cIdx++) {
        var item = collected[cIdx];
        if (item && item.titulo && !seen[item.titulo] && !excluidasMap[item.titulo] && !excluidasMap[item.id]) {
          seen[item.titulo] = true;
          uniqueResults.push(item);
        }
      }

      latestState.config.ultimoFiltroStats = {
        analisadas: statsObj.analisadas,
        bloqueadas: statsObj.bloqueadas,
        aprovadas: uniqueResults.length,
        atualizadoEm: new Date().toLocaleTimeString ? new Date().toLocaleTimeString() : 'Busca por Assunto'
      };

      if (toPendingQueue) {
        var currentPending = latestState.noticiasPendentes || [];
        var mergedPending = uniqueResults.concat(currentPending).slice(0, 25);
        latestState.noticiasPendentes = mergedPending;
        self.saveLocalState(latestState, true);
        resolve({ ok: true, count: uniqueResults.length, mode: 'pending', state: latestState });
      } else {
        var maxN = Number(latestState.config.limiteNoticias) || 10;
        var mergedActive = uniqueResults.concat(latestState.noticias || []).slice(0, maxN);
        latestState.noticias = mergedActive;
        latestState.version = new Date().getTime();
        latestState.updatedAt = new Date().toISOString();
        self.saveLocalState(latestState, true);
        resolve({ ok: true, count: uniqueResults.length, mode: 'active', state: latestState });
      }
    }

    // Passo 1: Busca na API Oficial IBGE Notícias (com fotos em alta resolução)
    if (fonteMode === 'todas' || fonteMode === 'ibge') {
      fetchIbgeNewsByQuery(cleanQuery, cleanQuery, '#2a5e35', filtroNivel, customBlocked, statsObj, function (ibgeItems) {
        collected = collected.concat(ibgeItems);
        if (fonteMode === 'ibge') {
          finishSearch();
          return;
        }
        // Passo 2: Busca também no Google News Brasil por assunto
        var gNewsUrl = 'https://news.google.com/rss/search?q=' + encodeURIComponent(cleanQuery) + '&hl=pt-BR&gl=BR&ceid=BR:pt-419';
        fetchRssFeedMultiProxy(gNewsUrl, cleanQuery.toUpperCase(), '#0d74b8', filtroNivel, customBlocked, false, statsObj, function (gnItems) {
          collected = collected.concat(gnItems);
          finishSearch();
        });
      });
    } else {
      var gNewsUrl2 = 'https://news.google.com/rss/search?q=' + encodeURIComponent(cleanQuery) + '&hl=pt-BR&gl=BR&ceid=BR:pt-419';
      fetchRssFeedMultiProxy(gNewsUrl2, cleanQuery.toUpperCase(), '#0d74b8', filtroNivel, customBlocked, false, statsObj, function (gnItems2) {
        collected = collected.concat(gnItems2);
        finishSearch();
      });
    }
  });
};

VidaModernaSyncManager.prototype.fetchPublicRssFallback = function (toPendingQueue) {
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
    var temaPersonalizado = (initialState.config.temaPersonalizado || '').replace(/^\s+|\s+$/g, '');
    var sendToPending = toPendingQueue === true || initialState.config.modoAprovacaoNoticias === 'manual';

    var statsObj = { analisadas: 0, bloqueadas: 0 };
    var collectedByFeed = [];
    var currentIdx = 0;

    function finalizeRss() {
      var latestState = self.getLocalState();
      var excluidas = latestState.noticiasExcluidas || [];
      var excluidasMap = {};
      for (var eIdx = 0; eIdx < excluidas.length; eIdx++) {
        excluidasMap[excluidas[eIdx]] = true;
      }

      var finalNoticias = [];
      var seen = {};

      if (!sendToPending) {
        // Preserva notícias criadas ou editadas manualmente no Painel Admin
        var currentList = latestState.noticias || [];
        for (var cIdx = 0; cIdx < currentList.length; cIdx++) {
          var cn = currentList[cIdx];
          if (cn && (cn.custom || cn.editada || (cn.id && cn.id.indexOf('not-') === 0 && cn.id.indexOf('rss-') !== 0))) {
            if (!excluidasMap[cn.id] && !excluidasMap[cn.titulo]) {
              seen[cn.titulo] = true;
              if (cn.tituloOriginal) seen[cn.tituloOriginal] = true;
              finalNoticias.push(cn);
            }
          }
        }
      } else {
        var activeList = latestState.noticias || [];
        for (var aIdx = 0; aIdx < activeList.length; aIdx++) {
          if (activeList[aIdx] && activeList[aIdx].titulo) {
            seen[activeList[aIdx].titulo] = true;
          }
        }
      }

      for (var r = 0; r < 6; r++) {
        for (var f = 0; f < collectedByFeed.length; f++) {
          var list = collectedByFeed[f];
          if (r < list.length) {
            var candidate = list[r];
            if (!seen[candidate.titulo] && !excluidasMap[candidate.id] && !excluidasMap[candidate.titulo]) {
              seen[candidate.titulo] = true;
              finalNoticias.push(candidate);
              if (!sendToPending && finalNoticias.length >= maxNoticias) break;
              if (sendToPending && finalNoticias.length >= 20) break;
            }
          }
        }
        if (!sendToPending && finalNoticias.length >= maxNoticias) break;
        if (sendToPending && finalNoticias.length >= 20) break;
      }

      if (finalNoticias.length > 0) {
        latestState.config.ultimoFiltroStats = {
          analisadas: statsObj.analisadas,
          bloqueadas: statsObj.bloqueadas,
          aprovadas: finalNoticias.length,
          atualizadoEm: new Date().toLocaleTimeString ? new Date().toLocaleTimeString() : 'Manual'
        };
        if (sendToPending) {
          var prevPending = latestState.noticiasPendentes || [];
          latestState.noticiasPendentes = finalNoticias.concat(prevPending).slice(0, 25);
        } else {
          latestState.noticias = finalNoticias;
        }
        latestState.lastRssSyncAt = new Date().getTime();
        latestState.version = new Date().getTime();
        latestState.updatedAt = new Date().toISOString();
        self.saveLocalState(latestState, true);
        resolve(true);
      } else {
        resolve(false);
      }
    }

    function checkCustomThemeAndFinalize() {
      if (temaPersonalizado) {
        fetchIbgeNewsByQuery(temaPersonalizado, temaPersonalizado, '#2a5e35', filtroNivel, customBlocked, statsObj, function (ibgeList) {
          if (ibgeList && ibgeList.length > 0) {
            collectedByFeed.unshift(ibgeList);
          }
          finalizeRss();
        });
      } else {
        // Também inclui notícias gerais com foto HD da Agência IBGE como reforço caso algum feed RSS oscile
        fetchIbgeNewsByQuery('', 'ATUALIDADES', '#2a5e35', filtroNivel, customBlocked, statsObj, function (ibgeFallback) {
          if (ibgeFallback && ibgeFallback.length > 0) {
            collectedByFeed.push(ibgeFallback);
          }
          finalizeRss();
        });
      }
    }

    function processNextTheme() {
      if (currentIdx >= temas.length) {
        checkCustomThemeAndFinalize();
        return;
      }

      var temaId = temas[currentIdx++];
      var temaInfo = NEWS_THEMES_CATALOG[temaId];
      if (!temaInfo) {
        processNextTheme();
        return;
      }

      fetchRssFeedMultiProxy(
        temaInfo.url,
        temaInfo.fonte,
        temaInfo.cor,
        filtroNivel,
        customBlocked,
        initialState.config.apenasComFoto !== false,
        statsObj,
        function (feedList) {
          if (feedList && feedList.length > 0) {
            collectedByFeed.push(feedList);
          }
          processNextTheme();
        }
      );
    }

    processNextTheme();
  });
};

VidaModernaSyncManager.prototype.startAutoSyncDaemon = function () {
  var self = this;

  if (this.autoSyncTimer) {
    clearInterval(this.autoSyncTimer);
    this.autoSyncTimer = null;
  }

  // Se estiver dentro do iframe de preview do Painel Admin, recebe estado direto do Admin
  if (window.self !== window.top) {
    self.notifyStatus('online', 'Preview');
    return;
  }

  window.triggerWifiSync = function () {
    self.notifyStatus('syncing', 'Atualizando...');
    self.syncFromServer(false);
  };

  // Carrega da nuvem apenas 1 vez ao abrir a página; depois só atualiza quando o usuário mandar!
  this.syncFromServer(false);
};

window.falaSync = new VidaModernaSyncManager();
