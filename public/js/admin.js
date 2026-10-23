/**
 * Vida Moderna News - Painel Administrativo Web
 * - Gestão de Recados Independentes
 * - Busca Automática de Notícias por Temas de Interesse + Filtro de Classificação Familiar [Livre]
 * - Gestão e Criação de Cartelas/Vídeos 1280x520px (72dpi)
 */

(function () {
  let state = window.falaSync.getLocalState();

  const toastEl = document.getElementById('toast');
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  // Escala o iframe de preview 1280x720 para caber perfeitamente no card lateral
  const previewWrapper = document.getElementById('preview-wrapper');
  const previewIframe = document.getElementById('preview-iframe');
  function scalePreviewIframe() {
    if (!previewWrapper || !previewIframe) return;
    const w = previewWrapper.clientWidth;
    const scale = w / 1280;
    previewIframe.style.transform = `scale(${scale})`;
  }
  window.addEventListener('resize', scalePreviewIframe);
  setTimeout(scalePreviewIframe, 100);

  // Navegação por Abas
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
      if (btn.dataset.tab === 'tab-criador') {
        renderCartelaGeneratorPreview();
      }
    });
  });

  function resizeImageFileTo1280x520(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 1280;
          canvas.height = 520;
          const ctx = canvas.getContext('2d');

          ctx.fillStyle = '#0b131e';
          ctx.fillRect(0, 0, 1280, 520);

          const targetRatio = 1280 / 520;
          const imgRatio = img.width / img.height;
          let drawW = 1280;
          let drawH = 520;
          let offsetX = 0;
          let offsetY = 0;

          if (imgRatio > targetRatio) {
            drawH = 520;
            drawW = img.width * (520 / img.height);
            offsetX = (1280 - drawW) / 2;
          } else {
            drawW = 1280;
            drawH = img.height * (1280 / img.width);
            offsetY = (520 - drawH) / 2;
          }

          ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
          resolve(canvas.toDataURL('image/jpeg', 0.88));
        };
        img.onerror = reject;
        img.src = ev.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * 1. GESTÃO DE RECADOS INDEPENDENTES DA ARTE (COM OPÇÃO DE EDITAR)
   */
  const listaRecadosEl = document.getElementById('lista-recados');
  const formRecado = document.getElementById('form-recado');
  const headingFormRecado = document.getElementById('heading-form-recado');
  const btnSubmitRecado = document.getElementById('btn-submit-recado');
  const btnCancelRecado = document.getElementById('btn-cancel-recado');
  const cardFormRecado = document.getElementById('card-form-recado');
  let editingRecadoId = null;

  function cancelEditRecado() {
    editingRecadoId = null;
    formRecado.reset();
    document.getElementById('recado-titulo').value = 'INFORMAÇÕES DO CONDOMÍNIO';
    document.getElementById('recado-cor').value = '#2a5e35';
    document.getElementById('recado-condominio').value = 'TODOS';
    document.getElementById('recado-texto').value = '';
    if (headingFormRecado) headingFormRecado.textContent = 'Postar Novo Recado do Condomínio';
    if (btnSubmitRecado) btnSubmitRecado.textContent = '✅ Publicar Recado Independente';
    if (btnCancelRecado) btnCancelRecado.style.display = 'none';
    if (cardFormRecado) cardFormRecado.style.borderColor = '';
  }

  if (btnCancelRecado) {
    btnCancelRecado.addEventListener('click', cancelEditRecado);
  }

  function startEditRecado(rec) {
    editingRecadoId = rec.id;
    document.getElementById('recado-titulo').value = rec.titulo || 'INFORMAÇÕES DO CONDOMÍNIO';
    document.getElementById('recado-cor').value = rec.corEtiqueta || '#2a5e35';
    document.getElementById('recado-condominio').value = rec.condominio || 'TODOS';
    document.getElementById('recado-texto').value = rec.texto || '';
    if (headingFormRecado) headingFormRecado.textContent = '✏️ Editando Recado do Condomínio';
    if (btnSubmitRecado) btnSubmitRecado.textContent = '💾 Salvar Alterações do Recado';
    if (btnCancelRecado) btnCancelRecado.style.display = 'inline-flex';
    if (cardFormRecado) {
      cardFormRecado.style.borderColor = '#2a5e35';
      cardFormRecado.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    document.getElementById('recado-texto').focus();
  }

  function renderRecados() {
    listaRecadosEl.innerHTML = '';
    const recados = state.recados || [];
    if (recados.length === 0) {
      listaRecadosEl.innerHTML = '<p style="color:#64748b; font-size:14px;">Nenhum recado cadastrado.</p>';
      return;
    }

    recados.forEach((rec) => {
      const div = document.createElement('div');
      div.className = 'list-item' + (rec.ativo ? '' : ' inactive');

      const content = document.createElement('div');
      content.className = 'item-content';
      content.innerHTML = `
        <span class="item-badge" style="background:${rec.corEtiqueta || '#2a5e35'}">${rec.titulo}</span>
        <span class="item-badge" style="background:#475569;">Condomínio: ${rec.condominio || 'TODOS'}</span>
        <div class="item-title" style="margin-top:4px;">${rec.texto}</div>
      `;

      const actions = document.createElement('div');
      actions.className = 'item-actions';

      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn btn-sm btn-primary';
      btnEdit.textContent = '✏️ Editar';
      btnEdit.onclick = () => startEditRecado(rec);

      const btnToggle = document.createElement('button');
      btnToggle.className = 'btn btn-sm ' + (rec.ativo ? 'btn-warning' : 'btn-success');
      btnToggle.textContent = rec.ativo ? 'Pausar' : 'Ativar';
      btnToggle.onclick = async () => {
        rec.ativo = !rec.ativo;
        await window.falaSync.pushStateToServer(state);
        renderRecados();
        showToast('Status do recado atualizado de forma independente!');
      };

      const btnDel = document.createElement('button');
      btnDel.className = 'btn btn-sm btn-danger';
      btnDel.textContent = 'Excluir';
      btnDel.onclick = async () => {
        if (editingRecadoId === rec.id) cancelEditRecado();
        state.recados = state.recados.filter((r) => r.id !== rec.id);
        await window.falaSync.pushStateToServer(state);
        renderRecados();
        showToast('Recado removido!');
      };

      actions.appendChild(btnEdit);
      actions.appendChild(btnToggle);
      actions.appendChild(btnDel);
      div.appendChild(content);
      div.appendChild(actions);
      listaRecadosEl.appendChild(div);
    });
  }

  formRecado.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tituloVal = document.getElementById('recado-titulo').value.trim().toUpperCase();
    const corVal = document.getElementById('recado-cor').value;
    const condVal = document.getElementById('recado-condominio').value.trim().toUpperCase() || 'TODOS';
    const textoVal = document.getElementById('recado-texto').value.trim();

    if (editingRecadoId) {
      state.recados = (state.recados || []).map((r) => {
        if (r.id === editingRecadoId) {
          return {
            ...r,
            titulo: tituloVal,
            corEtiqueta: corVal,
            condominio: condVal,
            texto: textoVal,
            atualizadoEm: new Date().toISOString()
          };
        }
        return r;
      });
      await window.falaSync.pushStateToServer(state);
      cancelEditRecado();
      renderRecados();
      showToast('Recado editado e sincronizado na nuvem!');
      return;
    }

    const novoRecado = {
      id: 'rec-' + Date.now(),
      titulo: tituloVal,
      corEtiqueta: corVal,
      condominio: condVal,
      texto: textoVal,
      ativo: true,
      criadoEm: new Date().toISOString()
    };

    state.recados = [novoRecado, ...(state.recados || [])];
    await window.falaSync.pushStateToServer(state);
    document.getElementById('recado-texto').value = '';
    renderRecados();
    showToast('Recado publicado imediatamente (independente da arte)!');
  });

  /**
   * 2. SELETOR DE TEMAS DE INTERESSE + FILTRO DE CLASSIFICAÇÃO FAMILIAR + EDIÇÃO DE NOTÍCIAS
   */
  const themesGridEl = document.getElementById('themes-selector-grid');
  const inputTemaPersonalizado = document.getElementById('input-tema-personalizado');
  const inputLimiteNoticias = document.getElementById('input-limite-noticias');
  const selectFiltroFamiliar = document.getElementById('select-filtro-familiar');
  const inputPalavrasBloqueadas = document.getElementById('input-palavras-bloqueadas');
  const checkApenasFoto = document.getElementById('check-apenas-foto');
  const familyFilterStatsEl = document.getElementById('family-filter-stats');
  const btnSaveThemesAndFetch = document.getElementById('btn-save-themes-and-fetch');
  const listaNoticiasEl = document.getElementById('lista-noticias');
  const formNoticia = document.getElementById('form-noticia');
  const headingFormNoticia = document.getElementById('heading-form-noticia');
  const btnSubmitNoticia = document.getElementById('btn-submit-noticia');
  const btnCancelNoticia = document.getElementById('btn-cancel-noticia');
  const cardFormNoticia = document.getElementById('card-form-noticia');
  let editingNoticiaId = null;

  function cancelEditNoticia() {
    editingNoticiaId = null;
    formNoticia.reset();
    document.getElementById('noticia-fonte').value = 'VIDA MODERNA NEWS';
    document.getElementById('noticia-cor').value = '#2a5e35';
    document.getElementById('noticia-titulo').value = '';
    if (headingFormNoticia) headingFormNoticia.textContent = 'Adicionar ou Editar Comunicado / Notícia (1280x520px)';
    if (btnSubmitNoticia) btnSubmitNoticia.textContent = '➕ Adicionar Notícia à Grade';
    if (btnCancelNoticia) btnCancelNoticia.style.display = 'none';
    if (cardFormNoticia) cardFormNoticia.style.borderColor = '';
  }

  if (btnCancelNoticia) {
    btnCancelNoticia.addEventListener('click', cancelEditNoticia);
  }

  function startEditNoticia(n) {
    editingNoticiaId = n.id;
    document.getElementById('noticia-fonte').value = n.fonte || 'VIDA MODERNA NEWS';
    document.getElementById('noticia-cor').value = n.corBarra || '#2a5e35';
    document.getElementById('noticia-titulo').value = n.titulo || '';
    if (headingFormNoticia) headingFormNoticia.textContent = '✏️ Editando Manchete / Notícia (1280x520px)';
    if (btnSubmitNoticia) btnSubmitNoticia.textContent = '💾 Salvar Alterações da Notícia';
    if (btnCancelNoticia) btnCancelNoticia.style.display = 'inline-flex';
    if (cardFormNoticia) {
      cardFormNoticia.style.borderColor = '#2a5e35';
      cardFormNoticia.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    document.getElementById('noticia-titulo').focus();
  }

  function renderThemesSelector() {
    if (!themesGridEl) return;
    themesGridEl.innerHTML = '';
    const catalog = window.falaSync.themesCatalog || {};
    const selectedList = Array.isArray(state.config?.rssTemas)
      ? state.config.rssTemas
      : ['tecnologia', 'ciencia_saude', 'turismo', 'cultura'];

    Object.values(catalog).forEach((tema) => {
      const isSelected = selectedList.includes(tema.id);
      const label = document.createElement('label');
      label.className = 'theme-chip' + (isSelected ? ' selected' : '');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = tema.id;
      checkbox.checked = isSelected;

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          label.classList.add('selected');
        } else {
          label.classList.remove('selected');
        }
      });

      const span = document.createElement('span');
      span.textContent = `${tema.icone} ${tema.nome}`;

      label.appendChild(checkbox);
      label.appendChild(span);
      themesGridEl.appendChild(label);
    });

    if (inputTemaPersonalizado) inputTemaPersonalizado.value = state.config?.temaPersonalizado || '';
    if (inputLimiteNoticias) inputLimiteNoticias.value = String(state.config?.limiteNoticias || 10);
    if (selectFiltroFamiliar) selectFiltroFamiliar.value = state.config?.filtroFamiliarNivel || 'rigoroso';
    if (inputPalavrasBloqueadas) inputPalavrasBloqueadas.value = state.config?.palavrasBloqueadas || '';
    if (checkApenasFoto) checkApenasFoto.checked = state.config?.apenasComFoto !== false;

    renderFilterStats();
  }

  function renderFilterStats() {
    if (!familyFilterStatsEl) return;
    const stats = state.config?.ultimoFiltroStats || {};
    const temasAtivos = (state.config?.rssTemas || []).length;
    const nivelLabel = state.config?.filtroFamiliarNivel === 'rigoroso'
      ? 'Rigoroso (Livre p/ Família e Crianças)'
      : state.config?.filtroFamiliarNivel === 'moderado'
        ? 'Moderado'
        : 'Desativado';

    familyFilterStatsEl.innerHTML = `
      <span><strong>Temas Ativos:</strong> ${temasAtivos} tema(s)</span>
      <span>•</span>
      <span><strong>Classificação:</strong> ${nivelLabel}</span>
      <span>•</span>
      <span><strong>Notícias Analisadas:</strong> ${stats.analisadas || 0}</span>
      <span>•</span>
      <span style="color:#dc2626; font-weight:700;">🚫 Bloqueadas pelo Filtro Familiar: ${stats.bloqueadas || 0}</span>
      <span>•</span>
      <span style="color:#16a34a; font-weight:700;">✅ Aprovadas em Exibição: ${(state.noticias || []).length}</span>
    `;
  }

  async function saveThemesAndTriggerAutoFetch() {
    const checkedBoxes = themesGridEl.querySelectorAll('input[type="checkbox"]:checked');
    const selectedThemes = Array.from(checkedBoxes).map((cb) => cb.value);

    if (selectedThemes.length === 0 && !inputTemaPersonalizado.value.trim()) {
      showToast('Selecione pelo menos 1 tema de interesse!');
      return;
    }

    btnSaveThemesAndFetch.textContent = '⏳ Buscando notícias seguras pelos temas escolhidos...';

    state.config = {
      ...state.config,
      rssTemas: selectedThemes,
      temaPersonalizado: inputTemaPersonalizado.value.trim(),
      limiteNoticias: Number(inputLimiteNoticias.value) || 10,
      filtroFamiliarNivel: selectFiltroFamiliar.value || 'rigoroso',
      palavrasBloqueadas: inputPalavrasBloqueadas.value.trim(),
      apenasComFoto: checkApenasFoto.checked
    };

    const result = await window.falaSync.pushStateToServer(state, true);
    if (result && result.state) {
      state = result.state;
    } else {
      state = window.falaSync.getLocalState();
    }

    renderFilterStats();
    renderNoticias();
    btnSaveThemesAndFetch.textContent = '✅ Salvar Temas & Buscar Notícias Agora';
    showToast('Notícias atualizadas sob seu comando!');
  }

  if (btnSaveThemesAndFetch) {
    btnSaveThemesAndFetch.addEventListener('click', saveThemesAndTriggerAutoFetch);
  }

  function renderNoticias() {
    listaNoticiasEl.innerHTML = '';
    const noticias = state.noticias || [];
    if (noticias.length === 0) {
      listaNoticiasEl.innerHTML = '<p style="color:#64748b; font-size:14px;">Nenhuma notícia em cache.</p>';
      return;
    }

    noticias.forEach((n) => {
      const div = document.createElement('div');
      div.className = 'list-item' + (n.ativo !== false ? '' : ' inactive');

      const img = document.createElement('img');
      img.className = 'item-thumb';
      img.src = n.imagemUrl || 'assets/news-bg-default.svg';
      img.onerror = () => { img.src = 'assets/news-bg-default.svg'; };

      const content = document.createElement('div');
      content.className = 'item-content';
      content.innerHTML = `
        <span class="item-badge" style="background:${n.corBarra || '#2a5e35'}">${n.fonte || 'G1'}</span>
        <span class="item-badge" style="background:#16a34a;">[L] Familiar Aprovada</span>
        <div class="item-title">${n.titulo}</div>
      `;

      const actions = document.createElement('div');
      actions.className = 'item-actions';

      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn btn-sm btn-primary';
      btnEdit.textContent = '✏️ Editar';
      btnEdit.onclick = () => startEditNoticia(n);

      const btnToggle = document.createElement('button');
      const isAtivo = n.ativo !== false;
      btnToggle.className = 'btn btn-sm ' + (isAtivo ? 'btn-warning' : 'btn-success');
      btnToggle.textContent = isAtivo ? 'Pausar' : 'Ativar';
      btnToggle.onclick = async () => {
        n.ativo = !isAtivo;
        await window.falaSync.pushStateToServer(state, false);
        renderNoticias();
        showToast('Status da notícia atualizado!');
      };

      const btnDel = document.createElement('button');
      btnDel.className = 'btn btn-sm btn-danger';
      btnDel.textContent = 'Remover';
      btnDel.onclick = async () => {
        if (editingNoticiaId === n.id) cancelEditNoticia();
        if (!Array.isArray(state.noticiasExcluidas)) state.noticiasExcluidas = [];
        if (n.id) state.noticiasExcluidas.push(n.id);
        if (n.titulo) state.noticiasExcluidas.push(n.titulo);
        if (n.tituloOriginal) state.noticiasExcluidas.push(n.tituloOriginal);
        state.noticias = state.noticias.filter((item) => item.id !== n.id);
        await window.falaSync.pushStateToServer(state, false);
        renderNoticias();
        renderFilterStats();
        showToast('Notícia removida e sincronizada no Player!');
      };

      actions.appendChild(btnEdit);
      actions.appendChild(btnToggle);
      actions.appendChild(btnDel);
      div.appendChild(img);
      div.appendChild(content);
      div.appendChild(actions);
      listaNoticiasEl.appendChild(div);
    });
  }

  formNoticia.addEventListener('submit', async (e) => {
    e.preventDefault();
    const titulo = document.getElementById('noticia-titulo').value.trim();
    const fonteVal = document.getElementById('noticia-fonte').value.trim() || 'VIDA MODERNA NEWS';
    const corVal = document.getElementById('noticia-cor').value;
    const nivel = state.config?.filtroFamiliarNivel || 'rigoroso';
    const customBlk = state.config?.palavrasBloqueadas || '';

    if (!window.falaSync.isFamilySafe(titulo, '', nivel, customBlk)) {
      alert('Atenção: Esta manchete contém termos bloqueados pelo Filtro de Classificação Familiar do condomínio.');
      return;
    }

    const imgFileInput = document.getElementById('noticia-img-file');
    let uploadedImgUrl = null;
    if (imgFileInput.files && imgFileInput.files[0]) {
      uploadedImgUrl = await resizeImageFileTo1280x520(imgFileInput.files[0]);
    }

    if (editingNoticiaId) {
      state.noticias = (state.noticias || []).map((n) => {
        if (n.id === editingNoticiaId) {
          return {
            ...n,
            fonte: fonteVal,
            corBarra: corVal,
            titulo: titulo,
            tituloOriginal: n.tituloOriginal || n.titulo,
            editada: true,
            imagemUrl: uploadedImgUrl || n.imagemUrl || 'assets/news-bg-default.svg'
          };
        }
        return n;
      });
      await window.falaSync.pushStateToServer(state, false);
      cancelEditNoticia();
      renderNoticias();
      showToast('Notícia editada e sincronizada no Player!');
      return;
    }

    const novaNoticia = {
      id: 'not-' + Date.now(),
      fonte: fonteVal,
      corBarra: corVal,
      titulo: titulo,
      custom: true,
      editada: true,
      imagemUrl: uploadedImgUrl || 'assets/news-bg-default.svg',
      publicadoEm: new Date().toISOString(),
      ativo: true
    };

    state.noticias = [novaNoticia, ...(state.noticias || [])];
    await window.falaSync.pushStateToServer(state, false);
    cancelEditNoticia();
    renderNoticias();
    renderFilterStats();
    showToast('Notícia adicionada e sincronizada no Player!');
  });

  /**
   * 3. GESTÃO DE CARTELAS E VÍDEOS (1280x520px @ 72dpi — COM OPÇÃO DE EDITAR)
   */
  const listaMidiasEl = document.getElementById('lista-midias');
  const formMidia = document.getElementById('form-midia');
  const headingFormMidia = document.getElementById('heading-form-midia');
  const btnSubmitMidia = document.getElementById('btn-submit-midia');
  const btnCancelMidia = document.getElementById('btn-cancel-midia');
  const cardFormMidia = document.getElementById('card-form-midia');
  let editingMidiaId = null;

  function cancelEditMidia() {
    editingMidiaId = null;
    formMidia.reset();
    document.getElementById('midia-duracao').value = 15;
    document.getElementById('midia-assinatura').value = 5;
    document.getElementById('midia-condominio').value = 'TODOS';
    if (headingFormMidia) headingFormMidia.textContent = 'Adicionar Cartela ou Vídeo Publicitário (1280x520px)';
    if (btnSubmitMidia) btnSubmitMidia.textContent = '📤 Publicar Cartela / Vídeo (1280x520px)';
    if (btnCancelMidia) btnCancelMidia.style.display = 'none';
    if (cardFormMidia) cardFormMidia.style.borderColor = '';
  }

  if (btnCancelMidia) {
    btnCancelMidia.addEventListener('click', cancelEditMidia);
  }

  function startEditMidia(m) {
    editingMidiaId = m.id;
    document.getElementById('midia-titulo').value = m.titulo || '';
    document.getElementById('midia-cliente').value = m.cliente || '';
    document.getElementById('midia-tipo').value = m.tipo || 'cartela';
    document.getElementById('midia-url').value = (m.url && !m.url.startsWith('data:')) ? m.url : '';
    document.getElementById('midia-duracao').value = m.duracao || 15;
    document.getElementById('midia-assinatura').value = m.assinaturaSegundos || 5;
    document.getElementById('midia-condominio').value = m.condominio || 'TODOS';
    if (headingFormMidia) headingFormMidia.textContent = '✏️ Editando Cartela / Vídeo (1280x520px)';
    if (btnSubmitMidia) btnSubmitMidia.textContent = '💾 Salvar Alterações da Cartela / Vídeo';
    if (btnCancelMidia) btnCancelMidia.style.display = 'inline-flex';
    if (cardFormMidia) {
      cardFormMidia.style.borderColor = '#2a5e35';
      cardFormMidia.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    document.getElementById('midia-titulo').focus();
  }

  function renderMidias() {
    listaMidiasEl.innerHTML = '';
    const midias = state.midias || [];
    if (midias.length === 0) {
      listaMidiasEl.innerHTML = '<p style="color:#64748b; font-size:14px;">Nenhuma cartela ou vídeo cadastrado.</p>';
      return;
    }

    midias.forEach((m) => {
      const div = document.createElement('div');
      div.className = 'list-item' + (m.ativo ? '' : ' inactive');

      let thumbEl;
      if (m.tipo === 'video') {
        thumbEl = document.createElement('video');
        thumbEl.className = 'item-thumb';
        thumbEl.src = m.url;
        thumbEl.muted = true;
      } else {
        thumbEl = document.createElement('img');
        thumbEl.className = 'item-thumb';
        thumbEl.src = m.url;
        thumbEl.alt = m.titulo;
      }

      const content = document.createElement('div');
      content.className = 'item-content';
      content.innerHTML = `
        <span class="item-badge">${m.tipo === 'video' ? 'VÍDEO 1280x520' : 'CARTELA 1280x520 (72dpi)'}</span>
        <span class="item-badge" style="background:#0f766e;">${m.duracao || 15}" (Assinatura: ${m.assinaturaSegundos || 5}")</span>
        <div class="item-title">${m.titulo}</div>
        <div class="item-meta">Cliente: ${m.cliente || 'Não informado'} • Condomínio: ${m.condominio || 'TODOS'}</div>
      `;

      const actions = document.createElement('div');
      actions.className = 'item-actions';

      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn btn-sm btn-primary';
      btnEdit.textContent = '✏️ Editar';
      btnEdit.onclick = () => startEditMidia(m);

      const btnToggle = document.createElement('button');
      btnToggle.className = 'btn btn-sm ' + (m.ativo ? 'btn-warning' : 'btn-success');
      btnToggle.textContent = m.ativo ? 'Pausar' : 'Ativar';
      btnToggle.onclick = async () => {
        m.ativo = !m.ativo;
        await window.falaSync.pushStateToServer(state, false);
        renderMidias();
        showToast('Grade de cartelas 1280x520 atualizada!');
      };

      const btnDel = document.createElement('button');
      btnDel.className = 'btn btn-sm btn-danger';
      btnDel.textContent = 'Excluir';
      btnDel.onclick = async () => {
        if (editingMidiaId === m.id) cancelEditMidia();
        state.midias = state.midias.filter((item) => item.id !== m.id);
        await window.falaSync.pushStateToServer(state, false);
        renderMidias();
        showToast('Mídia removida da programação!');
      };

      actions.appendChild(btnEdit);
      actions.appendChild(btnToggle);
      actions.appendChild(btnDel);

      div.appendChild(thumbEl);
      div.appendChild(content);
      div.appendChild(actions);
      listaMidiasEl.appendChild(div);
    });
  }

  formMidia.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('midia-arquivo');
    const urlInput = document.getElementById('midia-url');
    const tipo = document.getElementById('midia-tipo').value;
    const tituloVal = document.getElementById('midia-titulo').value.trim();
    const clienteVal = document.getElementById('midia-cliente').value.trim();
    const duracaoVal = Number(document.getElementById('midia-duracao').value) || 15;
    const assinaturaVal = Number(document.getElementById('midia-assinatura').value) || 5;
    const condVal = document.getElementById('midia-condominio').value.trim().toUpperCase() || 'TODOS';

    let finalUrl = urlInput.value.trim();

    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      if (tipo === 'cartela' && file.type.startsWith('image/')) {
        finalUrl = await resizeImageFileTo1280x520(file);
      } else {
        finalUrl = await readFileAsDataUrl(file);
      }
    }

    if (editingMidiaId) {
      state.midias = (state.midias || []).map((m) => {
        if (m.id === editingMidiaId) {
          return {
            ...m,
            tipo: tipo,
            titulo: tituloVal,
            cliente: clienteVal,
            url: finalUrl || m.url,
            duracao: duracaoVal,
            assinaturaSegundos: assinaturaVal,
            condominio: condVal
          };
        }
        return m;
      });
      await window.falaSync.pushStateToServer(state, false);
      cancelEditMidia();
      renderMidias();
      showToast('Cartela/Vídeo editado e sincronizado na nuvem!');
      return;
    }

    if (!finalUrl) {
      alert('Selecione um arquivo de imagem/vídeo ou informe uma URL.');
      return;
    }

    const novaMidia = {
      id: 'mid-' + Date.now(),
      tipo: tipo,
      titulo: tituloVal,
      cliente: clienteVal,
      url: finalUrl,
      duracao: duracaoVal,
      assinaturaSegundos: assinaturaVal,
      dimensoes: '1280x520px (72dpi)',
      condominio: condVal,
      ativo: true,
      criadoEm: new Date().toISOString()
    };

    state.midias = [...(state.midias || []), novaMidia];
    await window.falaSync.pushStateToServer(state, false);
    cancelEditMidia();
    renderMidias();
    showToast('Cartela/Vídeo 1280x520px publicado com sucesso!');
  });

  /**
   * 4. GERADOR RÁPIDO DE CARTELA 1280x520px (72dpi)
   */
  const canvasCartela = document.getElementById('canvas-cartela');
  const formGeradorCartela = document.getElementById('form-gerador-cartela');

  function renderCartelaGeneratorPreview() {
    if (!canvasCartela) return;
    const ctx = canvasCartela.getContext('2d');
    const cliente = document.getElementById('gen-cliente').value || 'Anunciante';
    const categoria = document.getElementById('gen-categoria').value || 'VIDA MODERNA NEWS';
    const tema = document.getElementById('gen-tema').value || 'green';
    const produto = document.getElementById('gen-produto').value || '';
    const telefone = document.getElementById('gen-telefone').value || '';
    const site = document.getElementById('gen-site').value || '';
    const endereco = document.getElementById('gen-endereco').value || '';

    const palettes = {
      green: { c1: '#14331b', c2: '#2a5e35', badge: '#f59e0b' },
      blue: { c1: '#06233b', c2: '#0d68a8', badge: '#ff7b00' },
      dark: { c1: '#111827', c2: '#1f2937', badge: '#eab308' },
      red: { c1: '#450a0a', c2: '#991b1b', badge: '#f59e0b' }
    };
    const pal = palettes[tema] || palettes.green;

    const grad = ctx.createLinearGradient(0, 0, 1280, 520);
    grad.addColorStop(0, pal.c1);
    grad.addColorStop(1, pal.c2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1280, 520);

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.arc(1120, 100, 240, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pal.badge;
    ctx.beginPath();
    ctx.roundRect(65, 42, Math.min(650, categoria.length * 16 + 48), 44, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 21px "Segoe UI", Arial, sans-serif';
    ctx.fillText(categoria.toUpperCase(), 85, 71);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 50px "Segoe UI", Arial, sans-serif';
    const words = produto.split(' ');
    let line1 = '';
    let line2 = '';
    words.forEach((w) => {
      if ((line1 + w).length < 34) {
        line1 += (line1 ? ' ' : '') + w;
      } else {
        line2 += (line2 ? ' ' : '') + w;
      }
    });
    ctx.fillText(line1, 65, 160);
    if (line2) {
      ctx.fillStyle = '#bbf7d0';
      ctx.fillText(line2, 65, 222);
    }

    ctx.fillStyle = '#f1f5f9';
    ctx.font = '600 26px "Segoe UI", Arial, sans-serif';
    if (site) ctx.fillText('🌐 ' + site, 65, 295);
    if (endereco) ctx.fillText('📍 ' + endereco, 65, 338);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(65, 382, 1150, 96, 14);
    ctx.fill();

    ctx.fillStyle = pal.c1;
    ctx.font = '900 38px "Segoe UI", Arial, sans-serif';
    ctx.fillText(cliente, 95, 444);

    ctx.fillStyle = '#2a5e35';
    ctx.font = '800 36px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('📞 ' + telefone, 1185, 444);
    ctx.textAlign = 'left';
  }

  ['gen-cliente', 'gen-categoria', 'gen-tema', 'gen-produto', 'gen-telefone', 'gen-site', 'gen-endereco'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', renderCartelaGeneratorPreview);
  });

  document.getElementById('btn-preview-cartela').addEventListener('click', renderCartelaGeneratorPreview);

  formGeradorCartela.addEventListener('submit', async (e) => {
    e.preventDefault();
    renderCartelaGeneratorPreview();
    const dataUrl = canvasCartela.toDataURL('image/png');
    const cliente = document.getElementById('gen-cliente').value.trim();
    const produto = document.getElementById('gen-produto').value.trim();

    const novaCartela = {
      id: 'mid-' + Date.now(),
      tipo: 'cartela',
      titulo: `${cliente} - ${produto.slice(0, 32)}`,
      cliente: cliente,
      url: dataUrl,
      duracao: 15,
      assinaturaSegundos: 5,
      dimensoes: '1280x520px (72dpi)',
      condominio: 'TODOS',
      ativo: true,
      criadoEm: new Date().toISOString()
    };

    state.midias = [...(state.midias || []), novaCartela];
    await window.falaSync.pushStateToServer(state, false);
    renderMidias();
    showToast('Cartela 1280x520px criada e publicada na programação!');
  });

  document.getElementById('btn-download-cartela').addEventListener('click', () => {
    renderCartelaGeneratorPreview();
    const link = document.createElement('a');
    link.download = 'cartela-vidamodernanews-1280x520.png';
    link.href = canvasCartela.toDataURL('image/png');
    link.click();
  });

  /**
   * 5. CONFIGURAÇÕES GERAIS E NUVEM GRATUITA (SUPABASE + GITHUB PAGES)
   */
  const formCloudConfig = document.getElementById('form-cloud-config');
  const cloudSupabaseUrlEl = document.getElementById('cloud-supabase-url');
  const cloudSupabaseKeyEl = document.getElementById('cloud-supabase-key');
  const cloudGithubUrlEl = document.getElementById('cloud-github-url');
  const cloudStatusBadgeEl = document.getElementById('cloud-status-badge');
  const btnTestSupabase = document.getElementById('btn-test-supabase');
  const btnDownloadCloudConfig = document.getElementById('btn-download-cloud-config');
  const btnDownloadStateJson = document.getElementById('btn-download-state-json');

  function loadCloudForm() {
    const devCfg = window.falaSync.getDeviceConfig();
    if (cloudSupabaseUrlEl) cloudSupabaseUrlEl.value = devCfg.supabaseUrl || '';
    if (cloudSupabaseKeyEl) cloudSupabaseKeyEl.value = devCfg.supabaseAnonKey || '';
    if (cloudGithubUrlEl) cloudGithubUrlEl.value = devCfg.githubPagesUrl || '';

    if (cloudStatusBadgeEl) {
      if (devCfg.supabaseUrl && devCfg.supabaseAnonKey) {
        cloudStatusBadgeEl.textContent = '☁️ Supabase Nuvem Conectado';
      } else if (devCfg.githubPagesUrl) {
        cloudStatusBadgeEl.textContent = '🌐 GitHub Pages Configurado';
      } else {
        cloudStatusBadgeEl.textContent = 'Configure seu Supabase Gratuito abaixo';
      }
    }
  }

  if (formCloudConfig) {
    formCloudConfig.addEventListener('submit', async (e) => {
      e.preventDefault();
      window.falaSync.saveDeviceConfig({
        supabaseUrl: cloudSupabaseUrlEl.value.trim(),
        supabaseAnonKey: cloudSupabaseKeyEl.value.trim(),
        githubPagesUrl: cloudGithubUrlEl.value.trim()
      });
      loadCloudForm();
      await window.falaSync.pushStateToServer(state, false);
      showToast('Configuração de Nuvem (Supabase + GitHub) salva e sincronizada!');
    });
  }

  if (btnTestSupabase) {
    btnTestSupabase.addEventListener('click', async () => {
      window.falaSync.saveDeviceConfig({
        supabaseUrl: cloudSupabaseUrlEl.value.trim(),
        supabaseAnonKey: cloudSupabaseKeyEl.value.trim(),
        githubPagesUrl: cloudGithubUrlEl.value.trim()
      });
      loadCloudForm();
      btnTestSupabase.textContent = '⏳ Testando Supabase...';
      const remote = await window.falaSync.fetchFromSupabase();
      btnTestSupabase.textContent = '🔌 Testar Conexão Supabase';
      if (remote) {
        alert('✅ Conexão com o Supabase funcionando perfeitamente! Os dados na nuvem foram encontrados e sincronizados.');
      } else {
        const pushed = await window.falaSync.pushToSupabase(state);
        if (pushed) {
          alert('✅ Conexão com o Supabase estabelecida e estado inicial gravado na nuvem com sucesso!');
        } else {
          alert('⚠️ Não foi possível conectar ao Supabase. Verifique se você executou o arquivo supabase_setup.sql no SQL Editor do Supabase e se a Project URL e Anon Key estão corretas.');
        }
      }
    });
  }

  if (btnDownloadCloudConfig) {
    btnDownloadCloudConfig.addEventListener('click', () => {
      const supUrl = (cloudSupabaseUrlEl.value || '').trim();
      const supKey = (cloudSupabaseKeyEl.value || '').trim();
      const ghUrl = (cloudGithubUrlEl.value || '').trim();
      const fileContent = [
        '/**',
        ' * Vida Moderna News — Configuração de Nuvem Gratuita (Supabase + GitHub Pages)',
        ' */',
        'window.VIDA_MODERNA_CLOUD = {',
        '  supabaseUrl: ' + JSON.stringify(supUrl) + ',',
        '  supabaseAnonKey: ' + JSON.stringify(supKey) + ',',
        '  githubPagesUrl: ' + JSON.stringify(ghUrl),
        '};',
        ''
      ].join('\n');

      const blob = new Blob([fileContent], { type: 'application/javascript;charset=utf-8' });
      const link = document.createElement('a');
      link.download = 'cloud-config.js';
      link.href = URL.createObjectURL(blob);
      link.click();
      showToast('Arquivo cloud-config.js baixado! Substitua em public/js/cloud-config.js');
    });
  }

  if (btnDownloadStateJson) {
    btnDownloadStateJson.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json;charset=utf-8' });
      const link = document.createElement('a');
      link.download = 'state.json';
      link.href = URL.createObjectURL(blob);
      link.click();
      showToast('state.json baixado! Você pode subir em public/data/state.json no GitHub.');
    });
  }

  const formConfig = document.getElementById('form-config');
  function loadConfigForm() {
    const cfg = state.config || {};
    document.getElementById('cfg-condominio').value = cfg.condominioNome || 'Modern Life Residence';
    document.getElementById('cfg-telefone').value = cfg.telefoneSuporte || 'Vida Moderna News';
    document.getElementById('cfg-duracao').value = cfg.duracaoPadraoSegundos || 15;
    document.getElementById('cfg-assinatura').value = cfg.tempoAssinaturaSegundos || 5;
    document.getElementById('cfg-intervalo-recados').value = cfg.intervaloRecadosSegundos || 10;
    document.getElementById('cfg-rss-ativo').checked = cfg.rssAtivo !== false;
    document.getElementById('cfg-intercalar').checked = cfg.intercalarNoticias !== false;
    loadCloudForm();
  }

  formConfig.addEventListener('submit', async (e) => {
    e.preventDefault();
    state.config = {
      ...state.config,
      condominioNome: document.getElementById('cfg-condominio').value.trim(),
      telefoneSuporte: document.getElementById('cfg-telefone').value.trim(),
      duracaoPadraoSegundos: Number(document.getElementById('cfg-duracao').value) || 15,
      tempoAssinaturaSegundos: Number(document.getElementById('cfg-assinatura').value) || 5,
      intervaloRecadosSegundos: Number(document.getElementById('cfg-intervalo-recados').value) || 10,
      rssAtivo: document.getElementById('cfg-rss-ativo').checked,
      intercalarNoticias: document.getElementById('cfg-intercalar').checked
    };
    await window.falaSync.pushStateToServer(state, false);
    showToast('Configurações do Vida Moderna News salvas!');
  });

  function notifyPreviewIframe(currentSt) {
    try {
      if (previewIframe && previewIframe.contentWindow) {
        previewIframe.contentWindow.postMessage({
          type: 'VIDAMODERNA_STATE',
          state: currentSt
        }, '*');
      }
    } catch (e) {}
  }

  document.getElementById('btn-sync-now').addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-now');
    btn.textContent = '⏳ Sincronizando Player...';
    await window.falaSync.pushStateToServer(state, false);
    state = window.falaSync.getLocalState();
    notifyPreviewIframe(state);
    renderRecados();
    renderThemesSelector();
    renderMidias();
    renderNoticias();
    loadConfigForm();
    btn.textContent = '🔄 Sincronizar Player na Nuvem';
    showToast('Página do Player sincronizada na nuvem com sucesso!');
  });

  window.falaSync.onStateChange((newState) => {
    state = newState;
    notifyPreviewIframe(state);
    renderRecados();
    renderThemesSelector();
    renderMidias();
    renderNoticias();
  });

  // Inicializa telas e busca o estado mais recente salvo no Supabase
  renderRecados();
  renderThemesSelector();
  renderMidias();
  renderNoticias();
  loadConfigForm();
  renderCartelaGeneratorPreview();

  window.falaSync.syncFromServer(false).then((res) => {
    if (res && res.state) {
      state = res.state;
      notifyPreviewIframe(state);
      renderRecados();
      renderThemesSelector();
      renderMidias();
      renderNoticias();
      loadConfigForm();
    }
  });
})();
