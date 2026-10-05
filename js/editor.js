// Run Base — editores do coach: planilha (semanas e treinos) e plano (perfil, bloco, semana-tipo, zonas, força)
(function () {
  var sb = RB.sb;
  var E = RB.edit = {};
  var DAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
  var TYPES = ['REGENERATIVO', 'LEVE', 'LEVE + STRIDES', 'RODAGEM', 'LONGÃO', 'PROGRESSIVO', 'TEMPO RUN', 'INTERVALADO', 'FARTLEK', 'RUN/WALK', 'FORÇA', 'PROVA', 'DESCANSO'];
  var esc = RB.esc;
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  // ======================= PLANILHA =======================
  var P = { athlete: null, el: null, weeks: [], fb: {}, open: {} };

  E.planilha = async function (athlete, el) {
    P.athlete = athlete; P.el = el;
    el.innerHTML = '<div class="ld"><div class="sp"></div></div>';
    var wr = await sb.from('weeks').select('*,workouts(*)').eq('athlete_id', athlete.id).order('week_number');
    P.weeks = (wr.data || []).map(function (w) { w.workouts.sort(function (a, b) { return a.sort_order - b.sort_order || a.id - b.id; }); return w; });
    var ids = []; P.weeks.forEach(function (w) { w.workouts.forEach(function (x) { ids.push(x.id); }); });
    P.fb = {};
    if (ids.length) {
      for (var i = 0; i < ids.length; i += 300) {
        var fr = await sb.from('feedbacks').select('workout_id,rpe').in('workout_id', ids.slice(i, i + 300));
        (fr.data || []).forEach(function (f) { P.fb[f.workout_id] = f; });
      }
    }
    var cur = P.weeks.find(function (w) { return w.is_current; });
    if (cur && P.open[cur.id] === undefined) P.open[cur.id] = true;
    drawPlanilha();
  };

  function drawPlanilha() {
    var html = '<div class="pl-bar"><button class="btn btn-r sm" onclick="RB.edit.newWeek(true)">+ SEMANA (DUPLICAR ÚLTIMA)</button><button class="btn btn-o sm" onclick="RB.edit.newWeek(false)">+ EM BRANCO</button><button class="btn btn-o sm" onclick="RB.edit.tplPick(\'week\')">+ DE UM MODELO</button><button class="btn btn-b sm" onclick="RB.edit.aiWeek()">✦ SUGERIR COM IA</button></div>' +
      '<button class="btn-link go-forca" onclick="RB.edit.gotoForca()">Editar o treino de força deste aluno ›</button>' +
      '<div class="card cal-card" onclick="RB.edit.startForm()"><div>' + RB.ew('Calendário', 'blue') + '<div class="cal-t">' +
      (P.athlete.plan_start ? 'Semana 1 em ' + fmtBR(P.athlete.plan_start) + ' · avança toda segunda' : 'Sem data · a semana só muda manualmente') + '</div></div><span class="mini">Alterar</span></div>';
    if (!P.weeks.length) html += RB.empty('Nenhuma semana ainda.<br>Crie a primeira acima.');
    var cur = P.weeks.find(function (w) { return w.is_current; });
    P.weeks.slice().reverse().forEach(function (wk) {
      var io = !!P.open[wk.id], done = wk.workouts.filter(function (x) { return P.fb[x.id]; }).length;
      var past = cur && wk.week_number < cur.week_number;
      html += '<div class="wb' + (wk.is_current ? ' cur' : '') + (past ? ' past' : '') + '"><div class="wh" data-wk="' + wk.id + '" onclick="RB.edit.toggleWeek(' + wk.id + ')"><div><div class="wk-l' + (wk.is_current ? ' cur' : '') + '">' + esc(wk.label) + '</div>' +
        (wk.is_current ? '<div class="wk-now">Semana atual</div>' : '') + '</div><div class="wk-r"><span class="wk-done">' + done + '/' + wk.workouts.length + '</span><span class="wk-v">' + esc(wk.volume) + '</span><span class="arrow">' + (io ? '▲' : '▼') + '</span></div></div>';
      if (io) {
        html += '<div class="wbd open">' + wk.workouts.map(function (d, i) {
          var f = P.fb[d.id];
          return '<div class="dr ed' + (f ? ' ok' : '') + '"><div class="dr-h"><span class="dr-d">' + esc(d.day_label) + '</span>' + RB.tag(d.type, 'r') + (d.structure && d.structure.length ? RB.tag(d.structure.length + (d.structure.length === 1 ? ' bloco' : ' blocos'), 'b') : '') +
            (f ? '<span class="dr-ok" style="color:' + RB.rpeColor(f.rpe) + '">✓ RPE ' + f.rpe + '</span>' : '') + '</div><div class="dr-t">' + esc(d.description) + '</div>' +
            '<div class="dr-a"><button onclick="RB.edit.workout(' + wk.id + ',' + d.id + ')">Editar</button>' +
            (i > 0 ? '<button onclick="RB.edit.move(' + wk.id + ',' + i + ',-1)" aria-label="Subir">▲</button>' : '') +
            (i < wk.workouts.length - 1 ? '<button onclick="RB.edit.move(' + wk.id + ',' + i + ',1)" aria-label="Descer">▼</button>' : '') + '</div></div>';
        }).join('') +
          '<button class="mini" onclick="RB.edit.workout(' + wk.id + ',null)">+ Adicionar treino</button>' +
          '<div class="wk-acts"><button onclick="RB.edit.weekForm(' + wk.id + ')">Editar semana</button>' +
          (wk.is_current ? '' : '<button onclick="RB.edit.makeCurrent(' + wk.id + ')">Tornar semana atual</button>') +
          '<button onclick="RB.edit.dupWeek(' + wk.id + ')">Duplicar</button>' +
          '<button onclick="RB.edit.tplSave(\'week\',' + wk.id + ')">Salvar como modelo</button>' +
          '<button class="danger" onclick="RB.edit.delWeek(' + wk.id + ')">Excluir</button></div></div>';
      }
      html += '</div>';
    });
    P.el.innerHTML = html;
  }
  E.gotoForca = async function () { await RB.coach.dt('plano'); E.open('forca'); };
  E.toggleWeek = function (id) { P.open[id] = !P.open[id]; RB.keepAnchor('[data-wk="' + id + '"]', drawPlanilha); };
  var reload = function () { return E.planilha(P.athlete, P.el); };
  var findWeek = function (id) { return P.weeks.find(function (w) { return w.id === id; }); };

  async function createWeek(src) {
    var last = P.weeks[P.weeks.length - 1];
    var n = (last ? last.week_number : 0) + 1;
    var ins = await sb.from('weeks').insert({ athlete_id: P.athlete.id, label: 'Semana ' + n, volume: src ? src.volume : '', week_number: n, is_current: !P.weeks.length }).select().single();
    if (ins.error) { RB.toast('Erro ao criar semana', false); return null; }
    if (src && src.workouts.length) {
      var rows = src.workouts.map(function (w, i) { return { week_id: ins.data.id, athlete_id: P.athlete.id, day_label: w.day_label, type: w.type, description: w.description, structure: w.structure || null, sort_order: i }; });
      var r2 = await sb.from('workouts').insert(rows);
      if (r2.error) RB.toast('Semana criada, mas os treinos não foram copiados', false);
    }
    P.open[ins.data.id] = true;
    return ins.data;
  }
  E.newWeek = async function (dup) {
    var src = dup ? P.weeks[P.weeks.length - 1] : null;
    if (dup && !src) { RB.toast('Não há semana para duplicar', false); return; }
    var w = await createWeek(src);
    if (w) { RB.toast('Semana criada ✓'); await reload(); E.weekForm(w.id); }
  };
  E.dupWeek = async function (id) {
    var w = await createWeek(findWeek(id));
    if (w) { RB.toast('Semana duplicada no fim da planilha ✓'); await reload(); E.weekForm(w.id); }
  };
  E.weekForm = function (id) {
    var w = findWeek(id); if (!w) return;
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('Semana ' + w.week_number) + '<div class="sh-t">Editar semana</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      '<div class="fld"><div class="fld-l">Nome</div><input class="fi" id="wk-label" value="' + esc(w.label) + '" placeholder="Semana 8 — Regenerativa"></div>' +
      '<div class="fld"><div class="fld-l">Volume</div><input class="fi" id="wk-vol" value="' + esc(w.volume) + '" placeholder="32km"></div>' +
      '<button class="btn btn-r" onclick="RB.edit.saveWeek(' + id + ')">SALVAR</button>');
  };
  E.saveWeek = async function (id) {
    var r = await sb.from('weeks').update({ label: RB.$('wk-label').value.trim() || 'Semana', volume: RB.$('wk-vol').value.trim() }).eq('id', id);
    if (r.error) { RB.toast('Erro ao salvar', false); return; }
    RB.closeSheet(); RB.toast('Semana salva ✓'); reload();
  };
  // datas: a semana 1 começa numa segunda; a semana atual sai da data
  var iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var monday = function (d) { d = new Date(d.getFullYear(), d.getMonth(), d.getDate()); var k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return d; };
  var fmtBR = function (s) { var p = s.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
  E.weekOfDate = function (start, date) {
    var s = new Date(start + 'T12:00:00'); return Math.floor((monday(date) - monday(s)) / (7 * 864e5)) + 1;
  };
  async function setStart(dateStr, focusId) {
    var r = await sb.from('athletes').update({ plan_start: dateStr }).eq('id', P.athlete.id).select().single();
    if (r.error) { RB.toast('Erro ao salvar', false); return false; }
    P.athlete.plan_start = r.data.plan_start;
    if (focusId) P.open[focusId] = true;
    return true;
  }
  E.makeCurrent = async function (id) {
    var w = findWeek(id);
    // a semana escolhida vira a desta segunda-feira; as próximas seguem toda segunda
    var start = monday(new Date()); start.setDate(start.getDate() - (w.week_number - 1) * 7);
    if (!confirm('Tornar "' + w.label + '" a semana atual?\n\nA partir daí o app avança sozinho toda segunda-feira.')) return;
    if (await setStart(iso(start), id)) { RB.toast('Semana atual trocada ✓'); reload(); }
  };
  E.startForm = function () {
    var a = P.athlete;
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('Calendário da planilha') + '<div class="sh-t">Quando começou a semana 1?</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      '<div class="p" style="margin-bottom:12px">O app muda de semana sozinho toda segunda-feira, com ou sem feedback. Escolha qualquer dia da semana 1: ele usa a segunda-feira daquela semana.</div>' +
      '<div class="fld"><div class="fld-l">Semana 1 começou em</div><input type="date" class="fi" id="ps-date" value="' + (a.plan_start || iso(monday(new Date()))) + '" oninput="RB.edit.startPreview()"></div>' +
      '<div class="calc-out" id="ps-prev"></div>' +
      '<button class="btn btn-r" onclick="RB.edit.saveStart()">SALVAR</button>' +
      (a.plan_start ? '<button class="btn-link danger" onclick="RB.edit.clearStart()">Desligar o avanço automático</button>' : ''));
    E.startPreview();
  };
  E.startPreview = function () {
    var v = RB.$('ps-date').value, o = RB.$('ps-prev'); if (!v) { o.textContent = ''; return; }
    var n = E.weekOfDate(iso(monday(new Date(v + 'T12:00:00'))), new Date());
    var w = P.weeks.filter(function (x) { return x.week_number <= Math.max(n, 1); }).pop();
    o.innerHTML = 'Hoje seria a <b>semana ' + Math.max(n, 1) + '</b>' + (w ? ' → ' + RB.esc(w.label) : '') + (P.weeks.length && n > P.weeks[P.weeks.length - 1].week_number ? '<br><span class="hint">Depois da última semana, o aluno fica na última até você criar mais.</span>' : '');
  };
  E.saveStart = async function () {
    var v = RB.$('ps-date').value; if (!v) return;
    if (await setStart(iso(monday(new Date(v + 'T12:00:00'))))) { RB.closeSheet(); RB.toast('Calendário salvo ✓'); reload(); }
  };
  E.clearStart = async function () {
    if (!confirm('Desligar o avanço automático? A semana só muda quando você trocar manualmente.')) return;
    if (await setStart(null)) { RB.closeSheet(); RB.toast('Avanço automático desligado'); reload(); }
  };
  E.delWeek = async function (id) {
    var w = findWeek(id);
    if (w.workouts.some(function (x) { return P.fb[x.id]; })) { RB.toast('Esta semana tem feedbacks do aluno e não pode ser excluída', false); return; }
    // semana atual pode ser excluída: a anterior (ou a próxima) vira a atual
    var others = P.weeks.filter(function (x) { return x.id !== id; });
    var heir = w.is_current ? (others.filter(function (x) { return x.week_number < w.week_number; }).pop() || others[0] || null) : null;
    var msg = 'Excluir "' + w.label + '"' + (w.workouts.length ? ' e os ' + w.workouts.length + ' treinos dela' : '') + '?' + (heir ? '\n\n"' + heir.label + '" passa a ser a semana atual.' : '');
    if (!confirm(msg)) return;
    if (w.workouts.length) { var r1 = await sb.from('workouts').delete().eq('week_id', id); if (r1.error) { RB.toast('Erro ao excluir', false); return; } }
    var r2 = await sb.from('weeks').delete().eq('id', id);
    if (r2.error) { RB.toast('Erro ao excluir', false); return; }
    if (heir) await sb.from('weeks').update({ is_current: true }).eq('id', heir.id);
    RB.toast('Semana excluída'); reload();
  };
  E.move = async function (wid, i, dir) {
    var w = findWeek(wid), list = w.workouts.slice();
    var t = list[i]; list[i] = list[i + dir]; list[i + dir] = t;
    await Promise.all(list.map(function (x, k) { return sb.from('workouts').update({ sort_order: k }).eq('id', x.id); }));
    reload();
  };

  // ---- treino ----
  var W = null;
  E.workout = function (wid, id) {
    var wk = findWeek(wid);
    var w = id ? clone(wk.workouts.find(function (x) { return x.id === id; })) : { day_label: 'SEG', type: '', description: '', structure: [] };
    w.structure = w.structure || [];
    W = { wid: wid, w: w, hasFb: id && !!P.fb[id] };
    drawWorkout();
  };
  function drawWorkout() {
    var w = W.w;
    var html = '<div class="sh-top"><div>' + RB.ew(w.id ? 'Editar treino' : 'Novo treino') + '<div class="sh-t">' + esc(findWeek(W.wid).label) + '</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      '<div class="fld"><div class="fld-l">Dia</div><div class="opts days7">' + DAYS.map(function (d) { return '<button class="eb' + (w.day_label === d ? ' sel' : '') + '" onclick="RB.edit.wSet(\'day_label\',\'' + d + '\')">' + d + '</button>'; }).join('') + '</div></div>' +
      '<div class="fld"><div class="fld-l">Tipo</div><input class="fi" list="types" value="' + esc(w.type) + '" oninput="RB.edit.wSet(\'type\',this.value,1)" placeholder="LONGÃO"><datalist id="types">' + TYPES.map(function (t) { return '<option value="' + t + '">'; }).join('') + '</datalist></div>' +
      '<div class="fld"><div class="fld-l">Descrição <span class="hint">cite Z1–Z5 e o aluno vê o pace dele</span></div><textarea class="ft" rows="3" oninput="RB.edit.wSet(\'description\',this.value,1)" placeholder="12km Z2 com os 3 últimos em Z3">' + esc(w.description) + '</textarea></div>' +
      '<div class="fld"><div class="fld-l">Estrutura em blocos <span class="hint">opcional</span></div>' +
      w.structure.map(function (b, i) {
        return '<div class="blk-ed"><select class="fi sel" onchange="RB.edit.bSet(' + i + ',\'fase\',this.value)">' + Object.keys(RB.pace.FASES).map(function (k) { return '<option value="' + k + '"' + (b.fase === k ? ' selected' : '') + '>' + RB.pace.FASES[k] + '</option>'; }).join('') + '</select>' +
          '<input class="fi" inputmode="numeric" value="' + esc(b.reps || '') + '" placeholder="Reps" oninput="RB.edit.bSet(' + i + ',\'reps\',this.value)">' +
          '<input class="fi" value="' + esc(b.vol || '') + '" placeholder="2km / 400m / 10min" oninput="RB.edit.bSet(' + i + ',\'vol\',this.value)">' +
          '<select class="fi sel" onchange="RB.edit.bSet(' + i + ',\'zona\',this.value)"><option value="">Zona</option>' + ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].map(function (z) { return '<option' + (b.zona === z ? ' selected' : '') + '>' + z + '</option>'; }).join('') + '</select>' +
          '<input class="fi full" value="' + esc(b.obs || '') + '" placeholder="Observação (ex.: recupera 1min30 trotando)" oninput="RB.edit.bSet(' + i + ',\'obs\',this.value)">' +
          '<div class="blk-a">' + (i > 0 ? '<button onclick="RB.edit.bMove(' + i + ',-1)">▲</button>' : '') + (i < w.structure.length - 1 ? '<button onclick="RB.edit.bMove(' + i + ',1)">▼</button>' : '') + '<button class="danger" onclick="RB.edit.bDel(' + i + ')">Remover</button></div></div>';
      }).join('') +
      '<div class="blk-add">' + Object.keys(RB.pace.FASES).map(function (k) { return '<button class="mini" onclick="RB.edit.bAdd(\'' + k + '\')">+ ' + RB.pace.FASES[k] + '</button>'; }).join('') + '</div></div>' +
      '<button class="btn btn-r" onclick="RB.edit.saveWorkout()">SALVAR TREINO</button>' +
      (w.id ? (W.hasFb ? '<div class="hint" style="text-align:center;margin-top:10px">Este treino já tem feedback do aluno e não pode ser excluído.</div>' : '<button class="btn-link danger" onclick="RB.edit.delWorkout()">Excluir treino</button>') : '');
    RB.openSheet(html);
  }
  E.wSet = function (k, v, quiet) { W.w[k] = v; if (!quiet) { var st = RB.$('sheet-body').scrollTop; drawWorkout(); RB.$('sheet-body').scrollTop = st; } };
  E.bSet = function (i, k, v) { W.w.structure[i][k] = v; };
  E.bAdd = function (fase) { W.w.structure.push({ fase: fase, reps: '', vol: '', zona: fase === 'aquec' || fase === 'desaq' ? 'Z1' : '', obs: '' }); var st = RB.$('sheet-body').scrollTop; drawWorkout(); RB.$('sheet-body').scrollTop = st + 120; };
  E.bDel = function (i) { W.w.structure.splice(i, 1); var st = RB.$('sheet-body').scrollTop; drawWorkout(); RB.$('sheet-body').scrollTop = st; };
  E.bMove = function (i, d) { var s = W.w.structure, t = s[i]; s[i] = s[i + d]; s[i + d] = t; var st = RB.$('sheet-body').scrollTop; drawWorkout(); RB.$('sheet-body').scrollTop = st; };
  E.saveWorkout = async function () {
    var w = W.w;
    if (!w.type.trim()) { RB.toast('Preencha o tipo do treino', false); return; }
    var structure = w.structure.filter(function (b) { return b.vol || b.obs || b.reps; });
    var data = { day_label: w.day_label, type: w.type.trim().toUpperCase(), description: w.description.trim(), structure: structure.length ? structure : null };
    var r;
    if (w.id) r = await sb.from('workouts').update(data).eq('id', w.id);
    else {
      var wk = findWeek(W.wid);
      var order = DAYS.indexOf(data.day_label);
      // entra na posição do dia da semana
      var pos = wk.workouts.filter(function (x) { return DAYS.indexOf(x.day_label) <= order; }).length;
      r = await sb.from('workouts').insert(Object.assign(data, { week_id: W.wid, athlete_id: P.athlete.id, sort_order: pos }));
      if (!r.error) {
        var later = wk.workouts.slice(pos);
        await Promise.all(later.map(function (x, k) { return sb.from('workouts').update({ sort_order: pos + 1 + k }).eq('id', x.id); }));
      }
    }
    if (r.error) { RB.toast('Erro ao salvar', false); return; }
    RB.closeSheet(); RB.toast('Treino salvo ✓'); reload();
  };
  E.delWorkout = async function () {
    if (!confirm('Excluir este treino?')) return;
    var r = await sb.from('workouts').delete().eq('id', W.w.id);
    if (r.error) { RB.toast('Erro ao excluir', false); return; }
    RB.closeSheet(); RB.toast('Treino excluído'); reload();
  };

  // ======================= PLANO DE PROVA / ZONAS DO TESTE =======================
  E.raceForm = function () {
    var rp = S.plan.race_plan || {};
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('Plano de prova') + '<div class="sh-t">' + esc(S.athlete.race || 'Prova') + '</div><div class="sh-s">O aluno vê o plano no app (com destaque nas 3 semanas antes da prova).</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      '<div class="calc-r"><div><div class="fld-l">Meta de tempo <span class="hint">h:mm:ss</span></div><input class="fi" id="rp-t" inputmode="numeric" value="' + esc(rp.target || '') + '" placeholder="vazio = estimativa do teste" oninput="RB.pace.mask(this);RB.edit.racePrev()"></div>' +
      '<div><div class="fld-l">Gel a cada (min)</div><input class="fi" id="rp-g" inputmode="numeric" value="' + esc(rp.gel_min || 40) + '" oninput="RB.edit.racePrev()"></div></div>' +
      '<div class="fld"><div class="fld-l">Recado para a prova <span class="hint">opcional · **negrito** funciona</span></div><textarea class="ft" id="rp-n" rows="3" placeholder="Largue no pelotão de 5:30, não persiga ninguém até o km 15.">' + esc(rp.notes || '') + '</textarea></div>' +
      '<div class="card rp-prev" id="rp-prev"></div>' +
      '<button class="btn btn-r" onclick="RB.edit.saveRace()">SALVAR PLANO</button>');
    E.racePrev();
  };
  var raceVals = function () { return { target: RB.$('rp-t').value.trim(), gel_min: +RB.$('rp-g').value || 40, notes: RB.$('rp-n') ? RB.$('rp-n').value.trim() : '' }; };
  E.racePrev = function () { RB.$('rp-prev').innerHTML = RB.perf.raceHtml(S.athlete, raceVals(), RB.perf.tests); };
  E.saveRace = async function () {
    var v = raceVals();
    if (v.target && !RB.pace.parseHMS(v.target)) { RB.toast('Meta no formato h:mm:ss', false); return; }
    var r = await sb.from('athlete_plans').upsert({ athlete_id: S.athlete.id, race_plan: v, updated_at: new Date().toISOString() }).select().single();
    if (r.error) { RB.toast('Erro ao salvar', false); return; }
    RB.closeSheet(); RB.toast('Plano de prova salvo ✓'); RB.coach.dt('plano');
  };
  // abre o editor de zonas com os paces sugeridos pelo teste
  E.zonesWith = function (paces) {
    E.open('zonas');
    paces.forEach(function (p, i) { if (X.data[i]) X.data[i].pace = p; });
    drawX();
    RB.toast('Zonas preenchidas pelo teste — revise e salve');
  };

  // ======================= IA: PRÓXIMA SEMANA =======================
  var AIW = null;
  E.aiWeek = function () {
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('✦ IA · próxima semana') + '<div class="sh-t">Rascunho para ' + esc(P.athlete.name.split(' ')[0]) + '</div><div class="sh-s">A IA lê as últimas semanas, feedbacks, check-ins, testes, ficha e a prova. Você revisa antes de criar.</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      '<div class="fld"><div class="fld-l">Algum pedido? <span class="hint">opcional</span></div><textarea class="ft" id="aiw-h" rows="2" placeholder="Ex.: semana regenerativa · incluir tiros na quarta · ele viaja no fim de semana"></textarea></div>' +
      '<button class="btn btn-r" id="aiw-go" onclick="RB.edit.aiWeekGo()">GERAR SUGESTÃO</button>');
  };
  E.aiWeekGo = async function () {
    var b = RB.$('aiw-go'), hint = (RB.$('aiw-h') || {}).value || '';
    if (b) { b.disabled = true; b.textContent = 'A IA está montando a semana... (até 1 min)'; }
    var r = await sb.functions.invoke('suggest-week', { body: { athlete_id: P.athlete.id, hint: hint.trim() } });
    var d = r.data || {};
    if (r.error || d.error) { if (b) { b.disabled = false; b.textContent = 'GERAR SUGESTÃO'; } RB.toast(d.error === 'not_configured' ? 'IA ainda não configurada' : 'Não deu para gerar agora', false); return; }
    AIW = d; AIW.hint = hint;
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('✦ Sugestão da IA') + '<div class="sh-t">' + esc(d.label) + '</div><div class="sh-s">Volume ' + esc(d.volume) + '</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      '<div class="aiw-why">' + esc(d.justificativa) + '</div>' +
      (d.treinos || []).map(function (t) { return '<div class="dr"><div class="dr-h"><span class="dr-d">' + esc(t.day_label) + '</span>' + RB.tag(t.type, 'r') + '</div><div class="dr-t">' + esc(t.description) + '</div></div>'; }).join('') +
      '<button class="btn btn-r" style="margin-top:12px" onclick="RB.edit.aiWeekCreate()">CRIAR ESTA SEMANA</button>' +
      '<button class="btn btn-o" onclick="RB.edit.aiWeek();RB.$(\'aiw-h\').value=' + "RB.edit.aiHint()" + '">PEDIR OUTRA VERSÃO</button>' +
      '<div class="hint" style="text-align:center;margin-top:6px">A semana entra no fim da planilha. Depois dá para editar cada treino.</div>');
  };
  E.aiHint = function () { return AIW ? AIW.hint || '' : ''; };
  E.aiWeekCreate = async function () {
    if (!AIW) return;
    RB.closeSheet();
    var w = await createWeek({ volume: AIW.volume || '', workouts: (AIW.treinos || []).map(function (t) { return { day_label: t.day_label, type: String(t.type || '').toUpperCase(), description: t.description }; }) });
    if (!w) return;
    await sb.from('weeks').update({ label: AIW.label || ('Semana ' + w.week_number) }).eq('id', w.id);
    RB.toast('Semana criada a partir da sugestão ✓');
    await reload();
  };

  // ======================= MODELOS =======================
  // modelos de treino de força (o programa inteiro) e de semana de corrida (treinos da semana)
  var TPL = { list: [] };
  E.tplSave = async function (kind, wid) {
    var data, sug;
    if (kind === 'week') {
      var w = findWeek(wid);
      if (!w.workouts.length) { RB.toast('Semana sem treinos', false); return; }
      data = { volume: w.volume || '', workouts: w.workouts.map(function (x) { return { day_label: x.day_label, type: x.type, description: x.description, structure: x.structure || null }; }) };
      sug = (w.label || '').replace(/^Semana\s*\d+\s*[—–-]?\s*/i, '') || 'Semana modelo';
    } else {
      data = clone(X.data);
      if (!data.length) { RB.toast('Treino de força vazio', false); return; }
      sug = (data[0].tipo || 'Treino de força');
    }
    var name = prompt('Nome do modelo:', sug); if (!name || !name.trim()) return;
    var r = await sb.from('templates').insert({ kind: kind, name: name.trim(), data: data });
    RB.toast(r.error ? 'Erro ao salvar o modelo' : 'Modelo salvo ✓', !r.error);
  };
  E.tplPick = async function (kind) {
    TPL.kind = kind;
    RB.openSheet('<div class="ld"><div class="sp"></div></div>');
    var r = await sb.from('templates').select('*').eq('kind', kind).order('created_at', { ascending: false });
    TPL.list = r.data || [];
    var desc = function (t) {
      if (kind === 'week') return (t.data.workouts || []).length + ' treinos' + (t.data.volume ? ' · ' + esc(t.data.volume) : '');
      var n = 0; (t.data || []).forEach(function (d) { n += flat(d).length; }); return (t.data || []).length + ' dia(s) · ' + n + ' exercícios';
    };
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('Modelos') + '<div class="sh-t">' + (kind === 'week' ? 'Semanas de corrida' : 'Treinos de força') + '</div>' +
      '<div class="sh-s">' + (kind === 'week' ? 'A semana escolhida entra no fim da planilha deste aluno.' : 'O modelo substitui o treino de força que está no editor. Você revisa antes de salvar.') + '</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      (TPL.list.length ? TPL.list.map(function (t, i) {
        return '<div class="tpl-r"><div><b>' + esc(t.name) + '</b><div class="muted-s">' + desc(t) + ' · ' + RB.fmtDate(t.created_at) + '</div></div><div class="tpl-a"><button class="mini" onclick="RB.edit.tplApply(' + i + ')">Usar</button><button class="mini ghost" onclick="RB.edit.tplDel(' + i + ')">✕</button></div></div>';
      }).join('') : RB.empty('Nenhum modelo ainda.<br>' + (kind === 'week' ? 'Abra uma semana e toque em "Salvar como modelo".' : 'Monte um treino e toque em "Salvar como modelo".'))));
  };
  E.tplApply = async function (i) {
    var t = TPL.list[i];
    if (TPL.kind === 'week') {
      RB.closeSheet();
      var w = await createWeek(t.data);
      if (w) { await sb.from('weeks').update({ label: 'Semana ' + w.week_number + ' — ' + t.name }).eq('id', w.id); RB.toast('Semana criada a partir do modelo ✓'); await reload(); E.weekForm(w.id); }
      return;
    }
    if (X.data.length && !confirm('Substituir o treino de força do editor pelo modelo "' + t.name + '"?')) return;
    X.data = clone(t.data).map(function (d) {
      if (!d.grupos) d.grupos = [{ nome: '', foco: '', rec: '', exercicios: d.blocos || [] }];
      delete d.blocos; d.aquec = d.aquec || []; return d;
    });
    RB.closeSheet(); drawX();
    X.isNew = true; drawX();
    RB.toast('Modelo aplicado — revise e toque em Salvar');
  };
  E.markNew = function (v) { if (X) X.isNew = v; };
  E.tplDel = async function (i) {
    var t = TPL.list[i];
    if (!confirm('Excluir o modelo "' + t.name + '"? Os alunos que já usam esse treino não mudam.')) return;
    await sb.from('templates').delete().eq('id', t.id);
    E.tplPick(TPL.kind);
  };

  // ======================= PLANO =======================
  var S = null; // { athlete, el, plan, zones, profile }
  var COLORS = [['red', 'Vermelho'], ['blue', 'Azul'], ['green', 'Verde'], ['off', 'Folga']];
  var ZCOL = ['#2B4EAA', '#2E7D32', '#F9A825', '#E65100', '#C41731', '#7B1FA2'];
  var HL = [['highlight', '★ Destaque'], ['alert', '⚠ Atenção'], ['note', '↗ Observação'], ['next', '→ Próximo passo']];

  E.plano = async function (athlete, el) {
    el.innerHTML = '<div class="ld"><div class="sp"></div></div>';
    var r = await Promise.all([
      sb.from('athlete_plans').select('*').eq('athlete_id', athlete.id).maybeSingle(),
      sb.from('zones').select('*').eq('athlete_id', athlete.id).order('sort_order'),
      RB.perf.load(athlete.id),
      RB.intake.load(athlete.id)
    ]);
    var plan = r[0].data || { athlete_id: athlete.id, block: null, week_layout: null, strength: null };
    S = { athlete: athlete, el: el, plan: plan, zones: r[1].data || [] };
    var b = plan.block || {}, s = plan.strength || [];
    var sumStr = s.length ? s.length + ' dia(s) · ' + s.reduce(function (a, d) { return a + flat(d).length; }, 0) + ' exercícios' : 'não cadastrado';
    var sw = plan.strength_started_at ? RB.weeksSince(plan.strength_started_at) : 0;
    el.innerHTML =
      section('Perfil e objetivo', esc(athlete.goal || '—') + '<br><span class="muted-s">' + esc(athlete.race || '') + ' · ' + esc(athlete.pace || '') + '</span>', 'perfil') +
      RB.intake.coachSection(athlete) +
      section('Bloco atual', b.mes ? '<b>' + esc(b.mes) + '</b>' + (b.obj ? ' · ' + esc(b.obj) : '') + '<br><span class="muted-s">' + esc((b.resumo || '').slice(0, 120)) + (b.resumo && b.resumo.length > 120 ? '…' : '') + '</span>' : 'não cadastrado', 'bloco') +
      section('Organização da semana', plan.week_layout && plan.week_layout.length ? '<div class="wkgrid">' + plan.week_layout.map(wkCell).join('') + '</div>' : 'não cadastrada', 'semana') +
      RB.perf.card(true) +
      section('Plano de prova', (function () { var pl = RB.perf.plan(athlete, plan.race_plan, RB.perf.tests); return !pl ? 'Sem distância no campo "Prova" do perfil' : pl.missing ? 'Defina a meta de tempo (ou registre um teste)' : 'Meta <b>' + RB.pace.fmtHMS(pl.target) + '</b> · ' + RB.pace.fmtPace(pl.target / pl.km) + ' /km<br><span class="muted-s">' + esc(pl.from) + (pl.gels.length ? ' · ' + pl.gels.length + ' gel(s)' : '') + '</span>'; })(), 'prova') +
      section('Zonas de treino', S.zones.length ? S.zones.map(function (z) { return '<span class="zchip" style="--zc:' + esc(z.color) + '"><b>' + esc(z.zone.split('·')[0].trim()) + '</b> ' + esc(z.pace) + '</span>'; }).join(' ') : 'não cadastradas', 'zonas') +
      section('Treino de força', sumStr + (s.length ? '<br><span class="muted-s">Programa atual há ' + sw + ' semana(s)</span>' : ''), 'forca') +
      (s.length ? '<button class="btn btn-o" onclick="RB.edit.videos()">▶ VÍDEOS DOS EXERCÍCIOS</button>' : '');
  };
  E.videos = function () { RB.media.library(S.athlete, S.plan.strength); 
  };
  function section(t, body, key) {
    return '<div class="card pl-sec"><div class="pl-h">' + RB.ew(t, 'blue') + '<button class="mini" onclick="RB.edit.open(\'' + key + '\')">Editar</button></div><div class="pl-b">' + body + '</div></div>';
  }
  function wkCell(d) {
    var col = { red: 'var(--red)', blue: 'var(--blue)', green: 'var(--green)' };
    var off = d.c === 'off';
    return '<div class="wkd' + (off ? ' off' : '') + '" style="' + (off ? '' : 'background:' + (col[d.c] || d.c)) + '"><div class="a">' + esc(d.d) + '</div><div class="b">' + esc(d.t) + '</div><div class="c">' + esc(d.s) + '</div></div>';
  }
  function flat(d) { if (d.grupos) { var o = []; d.grupos.forEach(function (g) { o = o.concat(g.exercicios || []); }); return o; } return d.blocos || []; }

  // editor em tela cheia com estado em memória
  var X = null; // { key, data }
  E.open = function (key) {
    if (key === 'prova') return E.raceForm();
    var p = S.plan, a = S.athlete;
    var data;
    if (key === 'perfil') data = { goal: a.goal || '', race: a.race || '', pace: a.pace || '', vol: a.vol || '', img: a.img || '' };
    if (key === 'bloco') { data = clone(p.block || { mes: '', obj: '', resumo: '', infos: [] }); data.infos = data.infos || []; while (data.infos.length < 4) data.infos.push({ cls: 'note', t: '', x: '' }); }
    if (key === 'semana') { var wl = p.week_layout || []; data = DAYS.map(function (d) { var x = wl.find(function (y) { return y.d === d; }); return x ? clone(x) : { d: d, t: '', s: '', c: 'off' }; }); }
    if (key === 'zonas') data = S.zones.length ? S.zones.map(function (z) { return { zone: z.zone, description: z.description || '', pace: z.pace, color: z.color }; }) : ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].map(function (z, i) { return { zone: z, description: '', pace: '', color: ZCOL[i] }; });
    if (key === 'forca') data = (clone(p.strength || [])).map(function (d) {
      // tudo vira grupos para editar; dias antigos em "blocos" viram um grupo sem nome
      if (!d.grupos) d.grupos = [{ nome: '', foco: '', rec: '', exercicios: d.blocos || [] }];
      if (!d.aquec || !d.aquec.length) { var aq = RB.strength.aquec(d, p.strength || []); d.aquec = clone(aq.items || []); d.intro = aq.intro || ''; }
      delete d.blocos; return d;
    });
    X = { key: key, data: data };
    var ov = document.createElement('div');
    ov.className = 'preview-overlay ed-ov'; ov.id = 'ed-ov';
    ov.innerHTML = '<div class="preview-bar"><span>' + { perfil: 'Perfil e objetivo', bloco: 'Bloco atual', semana: 'Organização da semana', zonas: 'Zonas de treino', forca: 'Treino de força' }[key] + ' · ' + esc(a.name.split(' ')[0]) + '</span><span class="ed-btns"><button onclick="RB.edit.close()">Cancelar</button><button class="save" onclick="RB.edit.saveX()">Salvar</button></span></div><div class="preview-body" id="ed-body"></div>';
    document.body.appendChild(ov); document.body.classList.add('locked');
    drawX();
    if (key === 'forca') RB.media.forAthlete(a).then(function () { if (X && X.key === 'forca') drawX(); });
  };
  function vidBtn(name, ep) {
    var k = RB.media.key(name), own = RB.media.own[k], def = RB.media.def[k];
    return '<button class="vid-e' + (own ? ' on' : def ? ' def' : '') + '" onclick="RB.edit.video(\'' + ep + '\')">' + (own ? '▶ Vídeo ✓' : def ? '▶ Padrão' : '+ Vídeo') + '</button>';
  }
  E.video = function (path) {
    var e = at(path);
    RB.media.manage(e.b, function () { RB.closeSheet(); if (X) drawX(); });
  };
  E.close = function () { var o = RB.$('ed-ov'); if (o) o.remove(); document.body.classList.remove('locked'); X = null; };

  // inputs com data-p="caminho.no.estado"
  E.set = function (el) {
    var path = el.dataset.p.split('.'), o = X.data;
    for (var i = 0; i < path.length - 1; i++) o = o[path[i]];
    o[path[path.length - 1]] = el.type === 'checkbox' ? el.checked : el.value;
  };
  var I = function (p, v, ph, cls) { return '<input class="fi ' + (cls || '') + '" data-p="' + p + '" value="' + esc(v == null ? '' : v) + '" placeholder="' + esc(ph || '') + '" oninput="RB.edit.set(this)">'; };
  var T = function (p, v, ph, rows) { return '<textarea class="ft" rows="' + (rows || 3) + '" data-p="' + p + '" placeholder="' + esc(ph || '') + '" oninput="RB.edit.set(this)">' + esc(v || '') + '</textarea>'; };
  var Sel = function (p, v, opts) { return '<select class="fi sel" data-p="' + p + '" onchange="RB.edit.set(this)">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (v === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'; };
  var F = function (l, inner) { return '<div class="fld"><div class="fld-l">' + l + '</div>' + inner + '</div>'; };

  function drawX() {
    var d = X.data, h = '';
    if (X.key === 'perfil') {
      h = F('Objetivo', I('goal', d.goal, 'Meia Maratona de Amsterdam 18/10')) + F('Prova <span class="hint">com data dd/mm/aaaa, o app mostra a contagem regressiva</span>', I('race', d.race, 'Amsterdam 21K — 18/10/2026')) +
        F('Pace de referência', I('pace', d.pace, '5:20–5:50 /km Z2')) + F('Volume / rotina', I('vol', d.vol, '~28–35km/sem')) + F('Iniciais (avatar)', I('img', d.img, 'RF'));
    }
    if (X.key === 'bloco') {
      h = F('Nome do bloco', I('mes', d.mes, 'Bloco 2')) + F('Objetivo do bloco', I('obj', d.obj, 'Amsterdam 21K — 18/10/2026')) +
        F('Resumo <span class="hint">**negrito** funciona</span>', T('resumo', d.resumo, 'O que é este bloco e o foco dele', 5)) +
        F('Pontos de atenção <span class="hint">os 2 primeiros aparecem na home do aluno</span>', d.infos.map(function (x, i) {
          return '<div class="hl-ed">' + Sel('infos.' + i + '.cls', x.cls, HL) + I('infos.' + i + '.t', x.t, 'Título') + T('infos.' + i + '.x', x.x, 'Texto', 2) + '</div>';
        }).join(''));
    }
    if (X.key === 'semana') {
      h = '<div class="hint" style="margin-bottom:10px">Deixe a atividade em branco para esconder a organização da semana.</div>' + d.map(function (x, i) {
        return '<div class="wl-ed"><div class="wl-d">' + x.d + '</div>' + I(i + '.t', x.t, 'CORRIDA') + I(i + '.s', x.s, 'Z1 leve') + Sel(i + '.c', x.c, COLORS) + '</div>';
      }).join('');
    }
    if (X.key === 'zonas') {
      h = d.map(function (z, i) {
        return '<div class="z-ed"><div class="z-row">' + I(i + '.zone', z.zone, 'Z1 · Recuperação') + I(i + '.pace', z.pace, '6:10–6:40 /km') + '</div>' +
          '<div class="z-row">' + I(i + '.description', z.description, 'Descrição') + '<div class="z-cols">' + ZCOL.map(function (c) { return '<button class="zc' + (z.color === c ? ' on' : '') + '" style="background:' + c + '" onclick="RB.edit.zColor(' + i + ',\'' + c + '\')" aria-label="cor"></button>'; }).join('') + '</div></div>' +
          '<div class="blk-a">' + (i > 0 ? '<button onclick="RB.edit.arr(null,' + i + ',-1)">▲</button>' : '') + (i < d.length - 1 ? '<button onclick="RB.edit.arr(null,' + i + ',1)">▼</button>' : '') + '<button class="danger" onclick="RB.edit.arrDel(null,' + i + ')">Remover</button></div></div>';
      }).join('') + '<button class="mini" onclick="RB.edit.arrAdd(null,{zone:\'\',description:\'\',pace:\'\',color:\'#2B4EAA\'})">+ Zona</button>' +
        '<div class="hint" style="margin-top:10px">Comece o nome com Z1…Z5 para o app ligar a zona aos treinos e mostrar o pace ao aluno.</div>';
    }
    if (X.key === 'forca') {
      h = '<div class="tpl-bar"><button class="mini" onclick="RB.edit.tplPick(\'strength\')">Aplicar modelo</button><button class="mini ghost" onclick="RB.edit.tplSave(\'strength\')">Salvar como modelo</button></div>' +
        '<div class="hint" style="margin-bottom:12px">Marque "registra carga" nos exercícios em que o aluno deve anotar a carga. O histórico de cargas segue pelo nome do exercício.</div>' +
        d.map(function (day, di) {
          return '<div class="card fd-ed"><div class="fd-h"><b>Dia ' + (di + 1) + '</b><div class="blk-a">' + (di > 0 ? '<button onclick="RB.edit.arr(\'\',' + di + ',-1)">▲</button>' : '') + (di < d.length - 1 ? '<button onclick="RB.edit.arr(\'\',' + di + ',1)">▼</button>' : '') + '<button class="danger" onclick="RB.edit.arrDel(\'\',' + di + ')">Remover dia</button></div></div>' +
            '<div class="z-row">' + I(di + '.dia', day.dia, 'TER / QUI') + I(di + '.tempo', day.tempo, '50–60min') + '</div>' + I(di + '.tipo', day.tipo, 'FULL BODY — Força para corrida', 'full') +
            F('Aquecimento e ativação <span class="hint">mobilidade, ativação, educativos — cada item pode ter vídeo</span>', (day.aquec || []).map(function (it, ai) {
              var ap = di + '.aquec.' + ai;
              return '<div class="aq-ed">' + I(ap + '.g', it.g, 'Grupo (ex.: Ativação com mini band)', 'full') + '<div class="z-row">' + I(ap + '.b', it.b, 'Exercício') + I(ap + '.e', it.e, '10x cada lado') + '</div>' +
                '<div class="blk-a">' + vidBtn(it.b, ap) + (ai > 0 ? '<button onclick="RB.edit.arr(\'' + di + '.aquec\',' + ai + ',-1)">▲</button>' : '') + (ai < day.aquec.length - 1 ? '<button onclick="RB.edit.arr(\'' + di + '.aquec\',' + ai + ',1)">▼</button>' : '') + '<button class="danger" onclick="RB.edit.arrDel(\'' + di + '.aquec\',' + ai + ')">Remover</button></div></div>';
            }).join('') + '<button class="mini" onclick="RB.edit.aqAdd(' + di + ')">+ Item de aquecimento</button>') +
            F('Observações / progressão', T(di + '.intro', day.intro, 'Regras de progressão, descanso, avisos...', 3)) +
            day.grupos.map(function (g, gi) {
              var gp = di + '.grupos.' + gi;
              return '<div class="gr-ed"><div class="z-row">' + I(gp + '.nome', g.nome, 'Bloco 1: Força (opcional)') + I(gp + '.rec', g.rec, 'Rec 90s') + '</div>' + I(gp + '.foco', g.foco, 'Foco: quadríceps, core', 'full') +
                (g.exercicios || []).map(function (e, ei) {
                  var ep = gp + '.exercicios.' + ei;
                  return '<div class="ex-ed"><div class="z-row">' + I(ep + '.b', e.b, 'Nome do exercício') + '<label class="ck-l"><input type="checkbox" data-p="' + ep + '.c"' + (e.c ? ' checked' : '') + ' onchange="RB.edit.set(this)"> registra carga</label></div>' +
                    I(ep + '.e', e.e, '3x10 · 20kg · 60s', 'full') + T(ep + '.tec', e.tec, 'Técnica (opcional)', 2) + I(ep + '.warn', e.warn, '⚠ Atenção (opcional)', 'full') +
                    '<div class="blk-a">' + vidBtn(e.b, ep) + (ei > 0 ? '<button onclick="RB.edit.arr(\'' + gp + '.exercicios\',' + ei + ',-1)">▲</button>' : '') + (ei < g.exercicios.length - 1 ? '<button onclick="RB.edit.arr(\'' + gp + '.exercicios\',' + ei + ',1)">▼</button>' : '') + '<button class="danger" onclick="RB.edit.arrDel(\'' + gp + '.exercicios\',' + ei + ')">Remover</button></div></div>';
                }).join('') +
                '<div class="blk-add"><button class="mini" onclick="RB.edit.arrAdd(\'' + gp + '.exercicios\',{b:\'\',e:\'\',c:true,tec:\'\',warn:\'\'})">+ Exercício</button>' +
                (day.grupos.length > 1 ? '<button class="mini ghost" onclick="RB.edit.arrDel(\'' + di + '.grupos\',' + gi + ')">Remover bloco</button>' : '') + '</div></div>';
            }).join('') +
            '<button class="mini" onclick="RB.edit.arrAdd(\'' + di + '.grupos\',{nome:\'\',foco:\'\',rec:\'\',exercicios:[]})">+ Bloco de exercícios</button></div>';
        }).join('') +
        '<button class="btn btn-o" onclick="RB.edit.arrAdd(\'\',{dia:\'\',tipo:\'\',tempo:\'\',intro:\'\',aquec:[],grupos:[{nome:\'\',foco:\'\',rec:\'\',exercicios:[]}]})">+ DIA DE TREINO</button>' +
        '<label class="ck-l big"><input type="checkbox" id="str-new"' + (X.isNew ? ' checked' : '') + ' onchange="RB.edit.isNew=this.checked;RB.edit.markNew(this.checked)"> <span><b>É um programa novo</b><br>Zera a contagem de 4 semanas. Deixe desmarcado para pequenos ajustes de carga ou texto.</span></label>';
    }
    h += '<button class="btn btn-r" onclick="RB.edit.saveX()">SALVAR</button>';
    var body = RB.$('ed-body'), st = body.parentNode.scrollTop;
    body.innerHTML = h;
    body.parentNode.scrollTop = st;
  }
  var at = function (path) { var o = X.data; if (path === null || path === '') return o; path.split('.').forEach(function (k) { o = o[k]; }); return o; };
  E.arr = function (path, i, d) { var a = at(path), t = a[i]; a[i] = a[i + d]; a[i + d] = t; drawX(); };
  E.arrDel = function (path, i) { if (!confirm('Remover?')) return; at(path).splice(i, 1); drawX(); };
  E.arrAdd = function (path, item) { at(path).push(item); drawX(); };
  E.aqAdd = function (di) { var a = X.data[di].aquec = X.data[di].aquec || [], last = a[a.length - 1]; a.push({ g: last ? last.g : 'Aquecimento', b: '', e: '' }); drawX(); };
  E.zColor = function (i, c) { X.data[i].color = c; drawX(); };

  E.saveX = async function () {
    var a = S.athlete, d = X.data, r;
    if (X.key === 'perfil') {
      r = await sb.from('athletes').update({ goal: d.goal.trim(), race: d.race.trim(), pace: d.pace.trim(), vol: d.vol.trim(), img: d.img.trim().toUpperCase().slice(0, 3) }).eq('id', a.id).select().single();
      if (!r.error) Object.assign(a, r.data);
    } else if (X.key === 'zonas') {
      var rows = d.filter(function (z) { return z.zone.trim(); }).map(function (z, i) { return { athlete_id: a.id, zone: z.zone.trim(), description: z.description.trim() || null, pace: z.pace.trim(), color: z.color, sort_order: i }; });
      r = await sb.from('zones').delete().eq('athlete_id', a.id);
      if (!r.error && rows.length) r = await sb.from('zones').insert(rows);
    } else {
      var up = { athlete_id: a.id, updated_at: new Date().toISOString() };
      if (X.key === 'bloco') { d.infos = d.infos.filter(function (x) { return x.t || x.x; }); up.block = d.mes || d.resumo ? d : null; }
      if (X.key === 'semana') up.week_layout = d.some(function (x) { return x.t; }) ? d : null;
      if (X.key === 'forca') {
        var days = d.map(function (day) {
          var grupos = day.grupos.map(function (g) { g.exercicios = (g.exercicios || []).filter(function (e) { return e.b && e.b.trim(); }).map(function (e) { var o = { b: e.b.trim(), e: (e.e || '').trim(), c: !!e.c }; if (e.tec) o.tec = e.tec.trim(); if (e.warn) o.warn = e.warn.trim(); return o; }); return g; }).filter(function (g) { return g.exercicios.length; });
          var out = { dia: day.dia.trim(), tipo: day.tipo.trim(), tempo: (day.tempo || '').trim() };
          if (day.intro) out.intro = day.intro.trim();
          var aq = (day.aquec || []).filter(function (it) { return it.b && it.b.trim(); }).map(function (it) { return { g: (it.g || '').trim(), b: it.b.trim(), e: (it.e || '').trim() }; });
          if (aq.length) out.aquec = aq;
          // um único bloco sem nome volta a ser lista simples
          if (grupos.length === 1 && !grupos[0].nome && !grupos[0].foco && !grupos[0].rec) out.blocos = grupos[0].exercicios; else out.grupos = grupos;
          return out;
        }).filter(function (day) { return (day.blocos || day.grupos).length; });
        up.strength = days.length ? days : null;
        var isNew = RB.$('str-new') && RB.$('str-new').checked;
        if (isNew || !S.plan.strength_started_at) up.strength_started_at = new Date().toISOString();
      }
      r = await sb.from('athlete_plans').upsert(up).select().single();
    }
    if (r && r.error) { RB.toast('Erro ao salvar', false); return; }
    E.close(); RB.toast('Salvo ✓');
    RB.coach.dt('plano');
  };
})();
