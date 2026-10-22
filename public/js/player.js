/**
 * Vida Moderna News - Motor do Player Android (1280x720px total | 1280x520px publicidade/notícias)
 * VERSÃO 100% COMPATÍVEL COM NAVEGADORES ANTIGOS (ES5 Puro - Android 4.0 / 4.4 / 5.1 / 7.1 Aquarius STV-Plus)
 */

(function () {
  var stageEl = document.getElementById('fala-stage');
  var mediaStageEl = document.getElementById('media-stage');
  var progressBarEl = document.getElementById('media-progress-bar');
  var presentationBannerEl = document.getElementById('presentation-banner');

  var noticeBadgeEl = document.getElementById('notice-badge');
  var noticeTextEl = document.getElementById('notice-text');
  var noticeDotsEl = document.getElementById('notice-dots');
  var brandPhoneEl = document.getElementById('brand-phone');
  var brandColumnEl = document.getElementById('brand-column');

  var wifiDotEl = document.getElementById('wifi-dot');
  var syncStatusTextEl = document.getElementById('sync-status-text');

  var deviceModalEl = document.getElementById('device-modal');
  var closeDeviceModalBtn = document.getElementById('close-device-modal');
  var inputSupabaseUrl = document.getElementById('input-supabase-url');
  var inputSupabaseKey = document.getElementById('input-supabase-key');
  var inputGithubUrl = document.getElementById('input-github-url');
  var inputServerUrl = document.getElementById('input-server-url');
  var inputCondominioFilter = document.getElementById('input-condominio-filter');
  var btnSaveDevice = document.getElementById('btn-save-device');
  var btnForceSync = document.getElementById('btn-force-sync');
  var btnFullscreen = document.getElementById('btn-fullscreen');
  var deviceStatsBox = document.getElementById('device-stats-box');

  var currentState = window.falaSync.getLocalState();
  var playlist = [];
  var currentSlideIndex = -1;
  var slideTimer = null;
  var progressInterval = null;

  var activeRecados = [];
  var currentRecadoIndex = -1;
  var recadoTimer = null;
  var cursorTimer = null;

  function trimStr(str) {
    return (str || '').replace(/^\s+|\s+$/g, '');
  }

  function isCurrentlyFullscreen() {
    if (window.AndroidNative) return true;
    if (window.self !== window.top) return true;
    if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || document.webkitIsFullScreen) {
      return true;
    }
    if (window.navigator && window.navigator.standalone) return true;
    if (window.screen && window.innerHeight && (window.screen.height - window.innerHeight <= 25)) {
      return true;
    }
    return false;
  }

  function updatePresentationBanner() {
    if (!presentationBannerEl) return;
    if (isCurrentlyFullscreen()) {
      presentationBannerEl.className = 'hidden';
    } else {
      presentationBannerEl.className = '';
    }
    fitStageToScreen();
  }

  function enterPresentationFullscreen() {
    try {
      window.scrollTo(0, 1);
    } catch (e) {}

    var docEl = document.documentElement;
    try {
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
      } else if (docEl.webkitRequestFullScreen) {
        docEl.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
      } else if (docEl.mozRequestFullScreen) {
        docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
      }
    } catch (err) {
      try {
        if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();
      } catch (e2) {}
    }

    if (presentationBannerEl) {
      presentationBannerEl.className = 'hidden';
    }
    setTimeout(fitStageToScreen, 150);
    setTimeout(fitStageToScreen, 500);
  }

  function fitStageToScreen() {
    if (!stageEl) return;
    var vw = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth || 1280;
    var vh = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight || 720;
    var scaleX = vw / 1280;
    var scaleY = vh / 720;
    var scale = Math.min(scaleX, scaleY);
    var scaledW = 1280 * scale;
    var scaledH = 720 * scale;
    var leftPx = Math.max(0, Math.floor((vw - scaledW) / 2));
    var topPx = Math.max(0, Math.floor((vh - scaledH) / 2));

    stageEl.style.left = leftPx + 'px';
    stageEl.style.top = topPx + 'px';
    stageEl.style.webkitTransform = 'scale(' + scale + ')';
    stageEl.style.msTransform = 'scale(' + scale + ')';
    stageEl.style.transform = 'scale(' + scale + ')';
  }

  window.addEventListener('resize', fitStageToScreen);
  document.addEventListener('fullscreenchange', updatePresentationBanner);
  document.addEventListener('webkitfullscreenchange', updatePresentationBanner);
  fitStageToScreen();
  updatePresentationBanner();
  setTimeout(function () {
    enterPresentationFullscreen();
    updatePresentationBanner();
  }, 300);

  // Qualquer clique na tela (exceto no logo de configuração) ou botão OK do controle remoto ativa o Modo Apresentação (Tela Cheia) no Chrome!
  if (presentationBannerEl) {
    presentationBannerEl.addEventListener('click', function (ev) {
      ev.stopPropagation();
      enterPresentationFullscreen();
    });
  }
  if (mediaStageEl) {
    mediaStageEl.addEventListener('click', function () {
      if (!isCurrentlyFullscreen()) {
        enterPresentationFullscreen();
      }
    });
  }
  var noticeCardEl = document.getElementById('notice-card');
  if (noticeCardEl) {
    noticeCardEl.addEventListener('click', function () {
      if (!isCurrentlyFullscreen()) {
        enterPresentationFullscreen();
      }
    });
  }

  // Esconde a seta do mouse automaticamente após 3 segundos sem mexer
  function resetCursorTimer() {
    document.body.className = '';
    if (cursorTimer) clearTimeout(cursorTimer);
    cursorTimer = setTimeout(function () {
      if (deviceModalEl && deviceModalEl.className.indexOf('hidden') !== -1) {
        document.body.className = 'hide-cursor';
      }
    }, 3000);
  }
  window.addEventListener('mousemove', resetCursorTimer);
  resetCursorTimer();

  function buildTopPlaylist(state) {
    var devCfg = window.falaSync.getDeviceConfig();
    var condFilter = trimStr(devCfg.condominioFilter || 'TODOS').toUpperCase();

    var midiasOrig = (state && state.midias) ? state.midias : [];
    var midiasAtivas = [];
    for (var mIdx = 0; mIdx < midiasOrig.length; mIdx++) {
      var m = midiasOrig[mIdx];
      if (!m || !m.ativo) continue;
      var mCond = trimStr(m.condominio || 'TODOS').toUpperCase();
      if (condFilter === 'TODOS' || mCond === 'TODOS' || mCond === condFilter) {
        midiasAtivas.push(m);
      }
    }

    var noticiasOrig = (state && state.config && state.config.rssAtivo && state.noticias) ? state.noticias : [];
    var noticiasAtivas = [];
    for (var nIdx = 0; nIdx < noticiasOrig.length; nIdx++) {
      var n = noticiasOrig[nIdx];
      if (n && n.ativo !== false) {
        noticiasAtivas.push(n);
      }
    }

    var combined = [];

    if (state && state.config && state.config.intercalarNoticias && midiasAtivas.length > 0 && noticiasAtivas.length > 0) {
      var maxLen = Math.max(midiasAtivas.length, noticiasAtivas.length);
      for (var i = 0; i < maxLen; i++) {
        if (i < midiasAtivas.length) {
          combined.push({ kind: 'midia', data: midiasAtivas[i] });
        }
        if (i < noticiasAtivas.length) {
          combined.push({ kind: 'noticia', data: noticiasAtivas[i] });
        }
      }
    } else {
      for (var j = 0; j < midiasAtivas.length; j++) {
        combined.push({ kind: 'midia', data: midiasAtivas[j] });
      }
      for (var k = 0; k < noticiasAtivas.length; k++) {
        combined.push({ kind: 'noticia', data: noticiasAtivas[k] });
      }
    }

    if (combined.length === 0) {
      combined.push({
        kind: 'noticia',
        data: {
          id: 'fallback-news',
          fonte: 'G1 • CULTURA & ARTE',
          corBarra: '#5bb75b',
          titulo: 'Vida Moderna News — Informação em tempo real e avisos do Modern Life Residence.',
          imagemUrl: 'assets/news-bg-default.svg'
        }
      });
    }

    return combined;
  }

  function createSlideElement(item) {
    var slide = document.createElement('div');
    slide.className = 'media-slide';

    if (item.kind === 'midia') {
      var m = item.data;
      if (m.tipo === 'video') {
        var video = document.createElement('video');
        video.className = 'cartela-video';
        video.src = m.url;
        video.muted = true;
        video.setAttribute('muted', 'muted');
        video.setAttribute('playsinline', 'playsinline');
        video.setAttribute('webkit-playsinline', 'webkit-playsinline');
        video.preload = 'auto';
        slide.appendChild(video);
      } else {
        var img = document.createElement('img');
        img.className = 'cartela-img';
        img.src = m.url;
        img.alt = m.titulo || 'Cartela 1280x520';
        img.onerror = function () {
          if (img.src.indexOf('cartela-exemplo-1.svg') === -1) {
            img.src = 'assets/cartela-exemplo-1.svg';
          }
        };
        slide.appendChild(img);
      }
    } else if (item.kind === 'noticia') {
      var n = item.data;
      var container = document.createElement('div');
      container.className = 'news-slide-container';

      var bgImg = document.createElement('img');
      bgImg.className = 'news-bg-image';
      bgImg.src = n.imagemUrl || 'assets/news-bg-default.svg';
      bgImg.alt = n.fonte || 'G1';
      bgImg.onerror = function () {
        if (bgImg.src.indexOf('https://s2-g1.glbimg.com/') === 0 && !bgImg.getAttribute('data-tried-http')) {
          bgImg.setAttribute('data-tried-http', '1');
          bgImg.src = bgImg.src.replace('https://', 'http://');
        } else if (bgImg.src.indexOf('news-bg-default.svg') === -1) {
          bgImg.src = 'assets/news-bg-default.svg';
        }
      };

      var overlay = document.createElement('div');
      overlay.className = 'news-gradient-overlay';

      var tag = document.createElement('div');
      tag.className = 'news-source-tag';
      tag.style.borderLeftColor = n.corBarra || '#5bb75b';
      var tagText = document.createElement('span');
      tagText.textContent = n.fonte || 'G1';
      tag.appendChild(tagText);

      var headline = document.createElement('div');
      headline.className = 'news-headline';
      headline.textContent = n.titulo || '';

      overlay.appendChild(tag);
      overlay.appendChild(headline);
      container.appendChild(bgImg);
      container.appendChild(overlay);
      slide.appendChild(container);
    }

    return slide;
  }

  function startProgressBar(durationSeconds, signatureSeconds) {
    if (progressInterval) clearInterval(progressInterval);
    var totalMs = durationSeconds * 1000;
    var sigMs = (signatureSeconds || 5) * 1000;
    var startTime = new Date().getTime();
    progressBarEl.style.width = '0%';
    progressBarEl.style.backgroundColor = '#2a5e35';

    progressInterval = setInterval(function () {
      var elapsed = new Date().getTime() - startTime;
      var pct = Math.min(100, (elapsed / totalMs) * 100);
      progressBarEl.style.width = pct + '%';

      if (totalMs - elapsed <= sigMs) {
        progressBarEl.style.backgroundColor = '#f59e0b';
      }
      if (elapsed >= totalMs) {
        clearInterval(progressInterval);
      }
    }, 100);
  }

  function showNextSlide() {
    if (slideTimer) clearTimeout(slideTimer);
    if (!playlist || playlist.length === 0) {
      playlist = buildTopPlaylist(currentState);
    }

    currentSlideIndex = (currentSlideIndex + 1) % playlist.length;
    var item = playlist[currentSlideIndex];
    var cfg = currentState.config || {};
    var defaultDur = Number(cfg.duracaoPadraoSegundos) || 15;
    var sigDur = Number(cfg.tempoAssinaturaSegundos) || 5;
    var durationSec = (item.data && Number(item.data.duracao)) ? Number(item.data.duracao) : defaultDur;

    var oldSlides = mediaStageEl.querySelectorAll('.media-slide');
    var newSlideEl = createSlideElement(item);

    mediaStageEl.insertBefore(newSlideEl, document.getElementById('media-progress-track'));

    void newSlideEl.offsetWidth;
    newSlideEl.className = 'media-slide active';

    for (var i = 0; i < oldSlides.length; i++) {
      (function (old) {
        old.className = 'media-slide';
        setTimeout(function () {
          if (old && old.parentNode === mediaStageEl) {
            mediaStageEl.removeChild(old);
          }
        }, 700);
      })(oldSlides[i]);
    }

    var videoEl = newSlideEl.querySelector('video');
    if (videoEl) {
      startProgressBar(durationSec, sigDur);
      try {
        var playPromise = videoEl.play();
        if (playPromise && playPromise['catch']) playPromise['catch'](function () {});
      } catch (e) {}
      videoEl.onended = function () {
        showNextSlide();
      };
      slideTimer = setTimeout(showNextSlide, (durationSec + 1) * 1000);
    } else {
      startProgressBar(durationSec, sigDur);
      slideTimer = setTimeout(showNextSlide, durationSec * 1000);
    }
  }

  function updateRecadosList(state) {
    var devCfg = window.falaSync.getDeviceConfig();
    var condFilter = trimStr(devCfg.condominioFilter || 'TODOS').toUpperCase();

    var orig = (state && state.recados) ? state.recados : [];
    activeRecados = [];
    for (var i = 0; i < orig.length; i++) {
      var r = orig[i];
      if (!r || !r.ativo) continue;
      var rCond = trimStr(r.condominio || 'TODOS').toUpperCase();
      if (condFilter === 'TODOS' || rCond === 'TODOS' || rCond === condFilter) {
        activeRecados.push(r);
      }
    }

    if (activeRecados.length === 0) {
      activeRecados = [
        {
          id: 'default-recado',
          titulo: 'INFORMAÇÕES DO CONDOMÍNIO',
          corEtiqueta: '#2a5e35',
          texto: 'Pedimos a atenção de todos com suas crianças para não lançarem brinquedos e objetos pelas janelas e varandas, evitando acidentes.'
        }
      ];
    }

    renderNoticeDots();
  }

  function renderNoticeDots() {
    noticeDotsEl.innerHTML = '';
    if (activeRecados.length <= 1) return;
    for (var idx = 0; idx < activeRecados.length; idx++) {
      var dot = document.createElement('span');
      dot.className = 'notice-dot' + (idx === currentRecadoIndex ? ' active' : '');
      noticeDotsEl.appendChild(dot);
    }
  }

  function showNextRecado(immediate) {
    if (recadoTimer) clearTimeout(recadoTimer);
    if (!activeRecados || activeRecados.length === 0) {
      updateRecadosList(currentState);
    }

    currentRecadoIndex = (currentRecadoIndex + 1) % activeRecados.length;
    var recado = activeRecados[currentRecadoIndex];

    var applyRecadoContent = function () {
      noticeBadgeEl.textContent = recado.titulo || 'INFORMAÇÕES DO CONDOMÍNIO';
      noticeBadgeEl.style.backgroundColor = recado.corEtiqueta || '#2a5e35';
      noticeTextEl.textContent = recado.texto || '';
      renderNoticeDots();
      noticeTextEl.className = '';
    };

    if (immediate) {
      applyRecadoContent();
    } else {
      noticeTextEl.className = 'fade-out';
      setTimeout(applyRecadoContent, 320);
    }

    var cfg = currentState.config || {};
    var intervalSec = Number(cfg.intervaloRecadosSegundos) || 10;
    if (activeRecados.length > 1) {
      recadoTimer = setTimeout(function () { showNextRecado(false); }, intervalSec * 1000);
    }
  }

  function applyStateUpdate(newState) {
    var prevRecadosJson = JSON.stringify(currentState.recados);
    var nextRecadosJson = JSON.stringify(newState.recados);

    var oldCfg = currentState.config || {};
    var newCfg = newState.config || {};

    var prevMidiasJson = JSON.stringify({
      m: currentState.midias,
      n: currentState.noticias,
      c: oldCfg.rssAtivo,
      i: oldCfg.intercalarNoticias
    });
    var nextMidiasJson = JSON.stringify({
      m: newState.midias,
      n: newState.noticias,
      c: newCfg.rssAtivo,
      i: newCfg.intercalarNoticias
    });

    currentState = newState;

    if (currentState.config && currentState.config.telefoneSuporte) {
      brandPhoneEl.textContent = currentState.config.telefoneSuporte;
    }

    if (prevRecadosJson !== nextRecadosJson) {
      updateRecadosList(currentState);
      currentRecadoIndex = -1;
      showNextRecado(true);
    }

    if (prevMidiasJson !== nextMidiasJson || playlist.length === 0) {
      playlist = buildTopPlaylist(currentState);
    }
  }

  window.falaSync.onSyncStatus(function (status, detail) {
    wifiDotEl.className = 'wifi-dot ' + status;
    syncStatusTextEl.textContent = detail || status;
  });

  window.falaSync.onStateChange(function (newState) {
    applyStateUpdate(newState);
  });

  function openDeviceModal() {
    var devCfg = window.falaSync.getDeviceConfig();
    if (inputSupabaseUrl) inputSupabaseUrl.value = devCfg.supabaseUrl || '';
    if (inputSupabaseKey) inputSupabaseKey.value = devCfg.supabaseAnonKey || '';
    if (inputGithubUrl) inputGithubUrl.value = devCfg.githubPagesUrl || '';
    if (inputServerUrl) inputServerUrl.value = devCfg.serverUrl || '';
    if (inputCondominioFilter) inputCondominioFilter.value = devCfg.condominioFilter || 'TODOS';

    var lastSync = devCfg.lastWifiSync
      ? devCfg.lastWifiSync
      : 'Sincronizando...';

    var cloudMode = (devCfg.supabaseUrl && devCfg.supabaseAnonKey)
      ? 'Supabase Nuvem Ativo (Redes Diferentes / Internet)'
      : (devCfg.githubPagesUrl ? 'GitHub Pages Ativo' : 'G1 Internet Direto');

    var cfg = currentState.config || {};
    deviceStatsBox.innerHTML =
      '<strong>Sistema:</strong> Vida Moderna News — Modern Life Residence (Aquarius STV-Plus)<br>' +
      '<strong>Modo de Sincronização:</strong> ' + cloudMode + '<br>' +
      '<strong>Resolução Padrão:</strong> 1280x720px (Área Superior: 1280x520px @ 72dpi)<br>' +
      '<strong>Condomínio Atual:</strong> ' + (cfg.condominioNome || 'Modern Life Residence') + '<br>' +
      '<strong>Recados Ativos:</strong> ' + activeRecados.length + ' recado(s) independente(s)<br>' +
      '<strong>Itens na Grade (1280x520):</strong> ' + playlist.length + ' item(ns) (' + (cfg.duracaoPadraoSegundos || 15) + 's cada)<br>' +
      '<strong>Última Sincronização:</strong> ' + lastSync;
    deviceModalEl.className = '';
  }

  brandColumnEl.addEventListener('click', openDeviceModal);
  closeDeviceModalBtn.addEventListener('click', function () { deviceModalEl.className = 'hidden'; });

  window.addEventListener('keydown', function (ev) {
    var isModalOpen = deviceModalEl.className.indexOf('hidden') === -1;
    if (!isModalOpen) {
      if (ev.keyCode === 82 || ev.key === 'ContextMenu' || ev.key === 'F1') {
        openDeviceModal();
      } else if (!isCurrentlyFullscreen()) {
        enterPresentationFullscreen();
      }
    } else if (isModalOpen && (ev.keyCode === 27 || ev.key === 'Escape' || ev.key === 'Back')) {
      deviceModalEl.className = 'hidden';
    }
  });

  btnSaveDevice.addEventListener('click', function () {
    window.falaSync.saveDeviceConfig({
      supabaseUrl: inputSupabaseUrl ? trimStr(inputSupabaseUrl.value) : '',
      supabaseAnonKey: inputSupabaseKey ? trimStr(inputSupabaseKey.value) : '',
      githubPagesUrl: inputGithubUrl ? trimStr(inputGithubUrl.value) : '',
      serverUrl: inputServerUrl ? trimStr(inputServerUrl.value) : '',
      condominioFilter: (inputCondominioFilter && trimStr(inputCondominioFilter.value)) ? trimStr(inputCondominioFilter.value) : 'TODOS'
    });
    playlist = buildTopPlaylist(currentState);
    updateRecadosList(currentState);
    currentRecadoIndex = -1;
    showNextRecado(true);
    window.falaSync.syncFromServer(true);
    deviceModalEl.className = 'hidden';
  });

  btnForceSync.addEventListener('click', function () {
    btnForceSync.textContent = 'Sincronizando...';
    window.falaSync.syncFromServer(true).then(function () {
      btnForceSync.textContent = 'Sincronizar Nuvem Agora';
      openDeviceModal();
    });
  });

  btnFullscreen.addEventListener('click', function () {
    enterPresentationFullscreen();
    deviceModalEl.className = 'hidden';
  });

  if (currentState.config && currentState.config.telefoneSuporte) {
    brandPhoneEl.textContent = currentState.config.telefoneSuporte;
  }
  playlist = buildTopPlaylist(currentState);
  updateRecadosList(currentState);
  showNextSlide();
  showNextRecado(true);

  window.falaSync.startAutoSyncDaemon();
})();
