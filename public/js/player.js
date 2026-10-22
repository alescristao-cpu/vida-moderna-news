/**
 * Vida Moderna News - Motor do Player Android (1280x720px total | 1280x520px publicidade/notícias)
 * Compatível com TV Box Aquarius STV-Plus (Android 5.1 / 7.1+), Controle Remoto e Tablets Android.
 */

(function () {
  var stageEl = document.getElementById('fala-stage');
  var mediaStageEl = document.getElementById('media-stage');
  var progressBarEl = document.getElementById('media-progress-bar');

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

  function fitStageToScreen() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var scaleX = vw / 1280;
    var scaleY = vh / 720;
    var scale = Math.min(scaleX, scaleY);
    stageEl.style.transform = 'scale(' + scale + ')';
  }

  window.addEventListener('resize', fitStageToScreen);
  fitStageToScreen();

  function requestScreenWakeLock() {
    if ('wakeLock' in navigator && navigator.wakeLock && navigator.wakeLock.request) {
      navigator.wakeLock.request('screen').catch(function () {});
    }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      requestScreenWakeLock();
    }
  });
  requestScreenWakeLock();

  function buildTopPlaylist(state) {
    var devCfg = window.falaSync.getDeviceConfig();
    var condFilter = (devCfg.condominioFilter || 'TODOS').trim().toUpperCase();

    var midiasAtivas = (state.midias || []).filter(function (m) {
      if (!m.ativo) return false;
      var mCond = (m.condominio || 'TODOS').trim().toUpperCase();
      return condFilter === 'TODOS' || mCond === 'TODOS' || mCond === condFilter;
    });

    var noticiasAtivas = (state.config && state.config.rssAtivo)
      ? (state.noticias || []).filter(function (n) { return n.ativo !== false; })
      : [];

    var combined = [];

    if (state.config && state.config.intercalarNoticias && midiasAtivas.length > 0 && noticiasAtivas.length > 0) {
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
          titulo: '‘The Voice Brasil’ terá nova fase e técnicos revelam nome dos assistentes.',
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
        video.playsInline = true;
        video.preload = 'auto';
        slide.appendChild(video);
      } else {
        var img = document.createElement('img');
        img.className = 'cartela-img';
        img.src = m.url;
        img.alt = m.titulo || 'Cartela 1280x520';
        img.onerror = function () {
          img.src = 'assets/cartela-exemplo-1.svg';
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
        bgImg.src = 'assets/news-bg-default.svg';
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
    var startTime = Date.now();
    progressBarEl.style.width = '0%';
    progressBarEl.style.background = '#2a5e35';

    progressInterval = setInterval(function () {
      var elapsed = Date.now() - startTime;
      var pct = Math.min(100, (elapsed / totalMs) * 100);
      progressBarEl.style.width = pct + '%';

      if (totalMs - elapsed <= sigMs) {
        progressBarEl.style.background = '#f59e0b';
      }
      if (elapsed >= totalMs) {
        clearInterval(progressInterval);
      }
    }, 80);
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
    newSlideEl.classList.add('active');

    for (var i = 0; i < oldSlides.length; i++) {
      (function (old) {
        old.classList.remove('active');
        setTimeout(function () {
          if (old.parentNode === mediaStageEl) {
            mediaStageEl.removeChild(old);
          }
        }, 700);
      })(oldSlides[i]);
    }

    var videoEl = newSlideEl.querySelector('video');
    if (videoEl) {
      startProgressBar(durationSec, sigDur);
      var playPromise = videoEl.play();
      if (playPromise && playPromise.catch) playPromise.catch(function () {});
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
    var condFilter = (devCfg.condominioFilter || 'TODOS').trim().toUpperCase();

    activeRecados = (state.recados || []).filter(function (r) {
      if (!r.ativo) return false;
      var rCond = (r.condominio || 'TODOS').trim().toUpperCase();
      return condFilter === 'TODOS' || rCond === 'TODOS' || rCond === condFilter;
    });

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
      noticeTextEl.classList.remove('fade-out');
    };

    if (immediate) {
      applyRecadoContent();
    } else {
      noticeTextEl.classList.add('fade-out');
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
    inputServerUrl.value = devCfg.serverUrl || '';
    inputCondominioFilter.value = devCfg.condominioFilter || 'TODOS';

    var lastSync = devCfg.lastWifiSync
      ? new Date(devCfg.lastWifiSync).toLocaleString('pt-BR')
      : 'Sincronizando...';

    var cloudMode = (devCfg.supabaseUrl && devCfg.supabaseAnonKey)
      ? '☁️ Supabase Nuvem Ativo (Redes Diferentes / Internet)'
      : (devCfg.githubPagesUrl ? '🌐 GitHub Pages Ativo' : '📡 G1 Internet Direto / Auto-Sync');

    var cfg = currentState.config || {};
    deviceStatsBox.innerHTML =
      '<strong>Sistema:</strong> Vida Moderna News — Modern Life Residence (Aquarius STV-Plus Ready)<br>' +
      '<strong>Modo de Sincronização:</strong> ' + cloudMode + '<br>' +
      '<strong>Resolução Padrão:</strong> 1280x720px (Área de Arte/Cartela: 1280x520px @ 72dpi)<br>' +
      '<strong>Condomínio Atual:</strong> ' + (cfg.condominioNome || 'Modern Life Residence') + '<br>' +
      '<strong>Recados Ativos:</strong> ' + activeRecados.length + ' recado(s) independente(s)<br>' +
      '<strong>Itens na Grade (1280x520):</strong> ' + playlist.length + ' item(ns) (' + (cfg.duracaoPadraoSegundos || 15) + 's cada)<br>' +
      '<strong>Última Sincronização Automática:</strong> ' + lastSync;
    deviceModalEl.classList.remove('hidden');
    if (inputSupabaseUrl) inputSupabaseUrl.focus();
  }

  brandColumnEl.addEventListener('click', openDeviceModal);
  closeDeviceModalBtn.addEventListener('click', function () { deviceModalEl.classList.add('hidden'); });

  // Suporte ao Controle Remoto da TV Box Aquarius STV-Plus (Tecla Menu / Enter quando modal fechado)
  window.addEventListener('keydown', function (ev) {
    var isModalOpen = !deviceModalEl.classList.contains('hidden');
    if (!isModalOpen && (ev.keyCode === 82 || ev.key === 'ContextMenu' || ev.key === 'F1')) {
      openDeviceModal();
    } else if (isModalOpen && (ev.keyCode === 27 || ev.key === 'Escape' || ev.key === 'Back')) {
      deviceModalEl.classList.add('hidden');
    }
  });

  btnSaveDevice.addEventListener('click', function () {
    window.falaSync.saveDeviceConfig({
      supabaseUrl: inputSupabaseUrl ? inputSupabaseUrl.value.trim() : '',
      supabaseAnonKey: inputSupabaseKey ? inputSupabaseKey.value.trim() : '',
      githubPagesUrl: inputGithubUrl ? inputGithubUrl.value.trim() : '',
      serverUrl: inputServerUrl.value.trim(),
      condominioFilter: inputCondominioFilter.value.trim() || 'TODOS'
    });
    playlist = buildTopPlaylist(currentState);
    updateRecadosList(currentState);
    currentRecadoIndex = -1;
    showNextRecado(true);
    window.falaSync.syncFromServer(true);
    deviceModalEl.classList.add('hidden');
  });

  btnForceSync.addEventListener('click', async function () {
    btnForceSync.textContent = 'Sincronizando...';
    await window.falaSync.syncFromServer(true);
    btnForceSync.textContent = 'Sincronizar Nuvem Agora';
    openDeviceModal();
  });

  btnFullscreen.addEventListener('click', function () {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function () {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
    deviceModalEl.classList.add('hidden');
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
