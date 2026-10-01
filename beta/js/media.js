// Run Base — vídeos dos exercícios de força (biblioteca única, ligada pelo nome do exercício)
(function () {
  var sb = RB.sb;
  var M = RB.media = { map: {}, loaded: false };
  var BUCKET = 'exercise-videos', MAX = 50 * 1024 * 1024;
  var esc = function (s) { return RB.esc(s); };

  // "1. Agachamento Búlgaro ⚠" → "agachamento bulgaro"
  M.key = function (name) {
    return String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/⚠/g, '').replace(/^\s*\d+\s*[.)\-–]\s*/, '').replace(/[^a-z0-9]+/g, ' ').trim();
  };
  M.load = async function (force) {
    if (M.loaded && !force) return M.map;
    var r = await sb.from('exercise_media').select('*');
    M.map = {}; (r.data || []).forEach(function (m) { M.map[m.key] = m; });
    M.loaded = true;
    return M.map;
  };
  M.get = function (name) { return M.map[M.key(name)] || null; };

  function ytId(u) {
    var m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/i.exec(u || '');
    return m ? m[1] : null;
  }
  M.kindOf = function (u) { return ytId(u) ? 'youtube' : 'link'; };

  M.player = function (m) {
    if (!m) return '';
    if (m.kind === 'upload') return '<div class="vid"><video src="' + esc(m.url) + '" controls playsinline loop muted autoplay preload="metadata"></video></div>';
    var id = m.kind === 'youtube' && ytId(m.url);
    if (id) return '<div class="vid yt' + (/\/shorts\//i.test(m.url) ? ' short' : '') + '"><iframe src="https://www.youtube-nocookie.com/embed/' + id + '?rel=0&playsinline=1&modestbranding=1" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy" title="Vídeo do exercício"></iframe></div>';
    return '<a class="btn btn-o vid-link" href="' + esc(m.url) + '" target="_blank" rel="noopener">▶ ABRIR VÍDEO ↗</a>';
  };

  // ---------- coach: gerenciar o vídeo de um exercício ----------
  var cur = null; // { name, key, after }
  M.manage = async function (name, after) {
    name = String(name || '').trim();
    if (!M.key(name)) { RB.toast('Dê um nome ao exercício primeiro', false); return; }
    await M.load();
    cur = { name: name, key: M.key(name), after: after || null };
    drawManage();
  };
  function drawManage() {
    var m = M.map[cur.key];
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('Vídeo do exercício') + '<div class="sh-t">' + esc(cur.name) + '</div>' +
      '<div class="sh-s">Vale para todos os alunos com este exercício.</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      (m ? M.player(m) + '<button class="btn btn-o" onclick="RB.media.remove()">REMOVER VÍDEO</button><div class="divl">ou substituir</div>' : '') +
      '<label class="btn btn-r vid-up" id="vid-up">ENVIAR VÍDEO DO CELULAR<input type="file" accept="video/*" onchange="RB.media.upload(this)" hidden></label>' +
      '<div class="hint" style="margin:6px 0 14px">Até 50MB. Ideal: vídeo curto (10–20s), em pé, mostrando a execução.</div>' +
      '<div class="fld"><div class="fld-l">Ou cole um link <span class="hint">YouTube toca dentro do app; Instagram e outros abrem fora</span></div>' +
      '<div class="z-row"><input class="fi" id="vid-url" placeholder="https://youtube.com/shorts/..." inputmode="url"><button class="mini" onclick="RB.media.saveLink()">Salvar</button></div></div>');
  }
  function done(msg) {
    RB.toast(msg);
    if (cur && cur.after) cur.after(); else drawManage();
  }
  M.upload = async function (inp) {
    var file = inp.files && inp.files[0]; if (!file) return;
    if (file.size > MAX) { RB.toast('Vídeo maior que 50MB — corte ou reduza', false); inp.value = ''; return; }
    var lbl = RB.$('vid-up'); if (lbl) { lbl.classList.add('busy'); lbl.firstChild.nodeValue = 'ENVIANDO… ' + Math.round(file.size / 1048576) + 'MB'; }
    var ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'mp4';
    var path = cur.key.replace(/ /g, '-') + '-' + Date.now() + '.' + ext;
    var type = file.type || (ext === 'mov' ? 'video/quicktime' : 'video/mp4');
    var up = await sb.storage.from(BUCKET).upload(path, file, { contentType: type, upsert: false, cacheControl: '31536000' });
    if (up.error) { RB.toast('Erro ao enviar o vídeo', false); drawManage(); return; }
    var url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    var old = M.map[cur.key];
    var r = await sb.from('exercise_media').upsert({ key: cur.key, name: cur.name, kind: 'upload', url: url, storage_path: path, updated_at: new Date().toISOString() }).select().single();
    if (r.error) { RB.toast('Erro ao salvar', false); return; }
    if (old && old.storage_path) sb.storage.from(BUCKET).remove([old.storage_path]);
    M.map[cur.key] = r.data;
    done('Vídeo salvo ✓');
  };
  M.saveLink = async function () {
    var u = (RB.$('vid-url').value || '').trim();
    if (!/^https?:\/\/\S+$/i.test(u)) { RB.toast('Cole um link válido', false); return; }
    var old = M.map[cur.key];
    var r = await sb.from('exercise_media').upsert({ key: cur.key, name: cur.name, kind: M.kindOf(u), url: u, storage_path: null, updated_at: new Date().toISOString() }).select().single();
    if (r.error) { RB.toast('Erro ao salvar', false); return; }
    if (old && old.storage_path) sb.storage.from(BUCKET).remove([old.storage_path]);
    M.map[cur.key] = r.data;
    done('Vídeo salvo ✓');
  };
  M.remove = async function () {
    var old = M.map[cur.key]; if (!old || !confirm('Remover o vídeo deste exercício?')) return;
    var r = await sb.from('exercise_media').delete().eq('key', cur.key);
    if (r.error) { RB.toast('Erro ao remover', false); return; }
    if (old.storage_path) sb.storage.from(BUCKET).remove([old.storage_path]);
    delete M.map[cur.key];
    done('Vídeo removido');
  };

  // ---------- coach: biblioteca com todos os exercícios dos alunos ----------
  var lib = [];
  M.library = async function () {
    var ov = document.createElement('div');
    ov.className = 'preview-overlay ed-ov'; ov.id = 'lib-ov';
    ov.innerHTML = '<div class="preview-bar"><span>Vídeos dos exercícios</span><span class="ed-btns"><button onclick="RB.media.closeLib()">Fechar</button></span></div><div class="preview-body" id="lib-body"><div class="ld"><div class="sp"></div></div></div>';
    document.body.appendChild(ov); document.body.classList.add('locked');
    var r = await Promise.all([sb.from('athlete_plans').select('athlete_id,strength').not('strength', 'is', null), sb.from('athletes').select('id,name'), M.load(true)]);
    var names = {}; (r[1].data || []).forEach(function (a) { names[a.id] = a.name.split(' ')[0]; });
    var by = {};
    (r[0].data || []).forEach(function (p) {
      (p.strength || []).forEach(function (d) {
        var ex = d.grupos ? [].concat.apply([], d.grupos.map(function (g) { return g.exercicios || []; })) : (d.blocos || []);
        ex.forEach(function (e) {
          var k = M.key(e.b); if (!k) return;
          var it = by[k] = by[k] || { key: k, name: String(e.b).replace(/^\s*\d+\s*[.)\-–]\s*/, '').replace(/⚠/g, '').trim(), who: {} };
          it.who[names[p.athlete_id] || '?'] = 1;
        });
      });
    });
    Object.keys(M.map).forEach(function (k) { if (!by[k]) by[k] = { key: k, name: M.map[k].name, who: {} }; });
    lib = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return a.key < b.key ? -1 : 1; });
    drawLib();
  };
  function drawLib() {
    var body = RB.$('lib-body'); if (!body) return;
    var q = M.key((RB.$('lib-q') || {}).value || '');
    var have = lib.filter(function (x) { return M.map[x.key]; }).length;
    var rows = lib.filter(function (x) { return !q || x.key.indexOf(q) >= 0; }).map(function (x) {
      var m = M.map[x.key], who = Object.keys(x.who);
      return '<div class="lib-r"><div class="lib-t"><b>' + esc(x.name) + '</b><span class="muted-s">' + (who.length ? esc(who.slice(0, 4).join(', ')) + (who.length > 4 ? ' +' + (who.length - 4) : '') : 'sem aluno no momento') + '</span></div>' +
        '<button class="mini' + (m ? '' : ' ghost') + '" onclick="RB.media.libEdit(\'' + x.key + '\')">' + (m ? '▶ Vídeo' : '+ Vídeo') + '</button></div>';
    }).join('');
    var st = body.parentNode.scrollTop, focus = document.activeElement && document.activeElement.id === 'lib-q';
    body.innerHTML = '<div class="hint" style="margin-bottom:10px">' + have + ' de ' + lib.length + ' exercícios com vídeo. O vídeo aparece para todo aluno que tiver o exercício com o mesmo nome.</div>' +
      '<input class="fi" id="lib-q" placeholder="Buscar exercício" value="' + esc((RB.$('lib-q') || {}).value || '') + '" oninput="RB.media.filter()">' +
      '<div class="card" style="padding:4px 14px">' + (rows || '<div class="muted-s" style="padding:14px 0;text-align:center">Nenhum exercício encontrado.</div>') + '</div>';
    body.parentNode.scrollTop = st;
    if (focus) { var i = RB.$('lib-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }
  M.filter = function () { drawLib(); };
  M.libEdit = function (k) {
    var it = lib.find(function (x) { return x.key === k; });
    M.manage(it.name, function () { RB.closeSheet(); drawLib(); });
  };
  M.closeLib = function () { var o = RB.$('lib-ov'); if (o) o.remove(); document.body.classList.remove('locked'); };
})();
