// Run Base — vídeos dos exercícios de força
// Cada aluno tem o seu vídeo por exercício (ligado pelo nome normalizado).
// Vídeos "padrão" (athlete_id nulo) cobrem máquinas tradicionais para quem ainda não tem vídeo próprio.
(function () {
  var sb = RB.sb;
  var M = RB.media = { own: {}, def: {}, aid: null };
  var BUCKET = 'exercise-videos', MAX = 50 * 1024 * 1024;
  var esc = function (s) { return RB.esc(s); };

  // "1. Agachamento Búlgaro ⚠" → "agachamento bulgaro"
  M.key = function (name) {
    return String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/⚠/g, '').replace(/^\s*\d+\s*[.)\-–]\s*/, '').replace(/[^a-z0-9]+/g, ' ').trim();
  };
  // carrega os vídeos de um aluno + os padrão
  M.load = async function (athleteId) {
    var r = await sb.from('exercise_media').select('*').or('athlete_id.is.null,athlete_id.eq.' + athleteId);
    M.aid = athleteId; M.own = {}; M.def = {};
    (r.data || []).forEach(function (m) { if (m.athlete_id) { if (m.athlete_id === athleteId) M.own[m.key] = m; } else M.def[m.key] = m; });
  };
  M.get = function (name) { var k = M.key(name); return M.own[k] || M.def[k] || null; };

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

  // ---------- coach: vídeo de um exercício para o aluno aberto ----------
  var cur = null; // { name, key, after, first }
  M.manage = async function (name, after) {
    name = String(name || '').trim();
    if (!M.key(name)) { RB.toast('Dê um nome ao exercício primeiro', false); return; }
    cur = { name: name, key: M.key(name), after: after || null, first: M.first || 'aluno' };
    drawManage();
  };
  function drawManage() {
    var own = M.own[cur.key], def = M.def[cur.key];
    var top = own ? M.player(own) + '<button class="btn btn-o" onclick="RB.media.remove()">REMOVER VÍDEO DO ALUNO</button><div class="divl">ou substituir</div>'
      : def ? '<div class="vid-def">Usando o <b>vídeo padrão</b> da máquina. Envie um vídeo para ' + esc(cur.first) + ' se quiser um próprio.</div>' + M.player(def) + '<div class="divl">vídeo próprio do aluno</div>'
      : '';
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('Vídeo do exercício · ' + esc(cur.first)) + '<div class="sh-t">' + esc(cur.name) + '</div>' +
      '<div class="sh-s">O vídeo que você enviar aqui é só de ' + esc(cur.first) + '.</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' + top +
      '<label class="btn btn-r vid-up" id="vid-up">ENVIAR VÍDEO DO CELULAR<input type="file" accept="video/*" onchange="RB.media.upload(this)" hidden></label>' +
      '<div class="hint" style="margin:6px 0 14px">Até 50MB. Ideal: vídeo curto (10–20s), em pé, mostrando a execução.</div>' +
      '<div class="fld"><div class="fld-l">Ou cole um link <span class="hint">YouTube toca dentro do app; Instagram e outros abrem fora</span></div>' +
      '<div class="z-row"><input class="fi" id="vid-url" placeholder="https://youtube.com/shorts/..." inputmode="url"><button class="mini" onclick="RB.media.saveLink()">Salvar</button></div></div>');
  }
  function done(msg) {
    RB.toast(msg);
    if (cur && cur.after) cur.after(); else drawManage();
  }
  async function save(row, old) {
    row.athlete_id = M.aid; row.key = cur.key; row.name = cur.name; row.updated_at = new Date().toISOString();
    var r = await sb.from('exercise_media').upsert(row, { onConflict: 'athlete_id,key' }).select().single();
    if (r.error) { RB.toast('Erro ao salvar', false); return false; }
    if (old && old.storage_path && old.storage_path !== row.storage_path) sb.storage.from(BUCKET).remove([old.storage_path]);
    M.own[cur.key] = r.data;
    return true;
  }
  M.upload = async function (inp) {
    var file = inp.files && inp.files[0]; if (!file) return;
    if (file.size > MAX) { RB.toast('Vídeo maior que 50MB — corte ou reduza', false); inp.value = ''; return; }
    var lbl = RB.$('vid-up'); if (lbl) { lbl.classList.add('busy'); lbl.firstChild.nodeValue = 'ENVIANDO… ' + Math.round(file.size / 1048576) + 'MB'; }
    var ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'mp4';
    var path = M.aid + '/' + cur.key.replace(/ /g, '-') + '-' + Date.now() + '.' + ext;
    var type = file.type || (ext === 'mov' ? 'video/quicktime' : 'video/mp4');
    var up = await sb.storage.from(BUCKET).upload(path, file, { contentType: type, upsert: false, cacheControl: '31536000' });
    if (up.error) { RB.toast('Erro ao enviar o vídeo', false); drawManage(); return; }
    var url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    if (await save({ kind: 'upload', url: url, storage_path: path }, M.own[cur.key])) done('Vídeo salvo ✓');
  };
  M.saveLink = async function () {
    var u = (RB.$('vid-url').value || '').trim();
    if (!/^https?:\/\/\S+$/i.test(u)) { RB.toast('Cole um link válido', false); return; }
    if (await save({ kind: M.kindOf(u), url: u, storage_path: null }, M.own[cur.key])) done('Vídeo salvo ✓');
  };
  M.remove = async function () {
    var old = M.own[cur.key]; if (!old || !confirm('Remover o vídeo deste exercício para ' + cur.first + '?')) return;
    var r = await sb.from('exercise_media').delete().eq('id', old.id);
    if (r.error) { RB.toast('Erro ao remover', false); return; }
    if (old.storage_path) sb.storage.from(BUCKET).remove([old.storage_path]);
    delete M.own[cur.key];
    done('Vídeo removido');
  };

  // ---------- coach: lista dos exercícios do aluno com o status do vídeo ----------
  var lib = [];
  M.forAthlete = async function (athlete) { M.first = athlete.name.split(' ')[0]; await M.load(athlete.id); };
  M.library = async function (athlete, strength) {
    var ov = document.createElement('div');
    ov.className = 'preview-overlay ed-ov'; ov.id = 'lib-ov';
    ov.innerHTML = '<div class="preview-bar"><span>Vídeos dos exercícios · ' + esc(athlete.name.split(' ')[0]) + '</span><span class="ed-btns"><button onclick="RB.media.closeLib()">Fechar</button></span></div><div class="preview-body" id="lib-body"><div class="ld"><div class="sp"></div></div></div>';
    document.body.appendChild(ov); document.body.classList.add('locked');
    await M.forAthlete(athlete);
    var seen = {}; lib = [];
    (strength || []).forEach(function (d) {
      var ex = d.grupos ? [].concat.apply([], d.grupos.map(function (g) { return g.exercicios || []; })) : (d.blocos || []);
      ex.forEach(function (e) { var k = M.key(e.b); if (!k || seen[k]) return; seen[k] = 1; lib.push({ key: k, name: String(e.b).trim(), dia: d.dia }); });
    });
    drawLib();
  };
  function drawLib() {
    var body = RB.$('lib-body'); if (!body) return;
    var nOwn = lib.filter(function (x) { return M.own[x.key]; }).length, nDef = lib.filter(function (x) { return !M.own[x.key] && M.def[x.key]; }).length;
    var rows = lib.map(function (x, i) {
      var own = M.own[x.key], def = M.def[x.key];
      var st = own ? '<span class="vs on">vídeo próprio</span>' : def ? '<span class="vs def">vídeo padrão</span>' : '<span class="vs">sem vídeo</span>';
      return '<div class="lib-r"><div class="lib-t"><b>' + esc(x.name) + '</b>' + st + '</div>' +
        '<button class="mini' + (own ? '' : ' ghost') + '" onclick="RB.media.libEdit(' + i + ')">' + (own ? '▶ Vídeo' : '+ Vídeo') + '</button></div>';
    }).join('');
    var st = body.parentNode.scrollTop;
    body.innerHTML = '<div class="hint" style="margin-bottom:10px">' + nOwn + ' com vídeo próprio · ' + nDef + ' com vídeo padrão de máquina · ' + (lib.length - nOwn - nDef) + ' sem vídeo. Cada vídeo que você enviar aqui é só deste aluno.</div>' +
      '<div class="card" style="padding:4px 14px">' + (rows || '<div class="muted-s" style="padding:14px 0;text-align:center">Este aluno ainda não tem treino de força.</div>') + '</div>';
    body.parentNode.scrollTop = st;
  }
  M.libEdit = function (i) { M.manage(lib[i].name, function () { RB.closeSheet(); drawLib(); }); };
  M.closeLib = function () { var o = RB.$('lib-ov'); if (o) o.remove(); document.body.classList.remove('locked'); };
})();
