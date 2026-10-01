// Run Base — treino de força do aluno (programa vem de athlete_plans.strength)
(function () {
  var sb = RB.sb;
  var G = RB.strength = { open: {} };
  var c = {};

  function flat(d) {
    if (d.grupos) { var out = []; d.grupos.forEach(function (g) { g.exercicios.forEach(function (e) { out.push(e); }); }); return out; }
    return d.blocos || [];
  }
  // o histórico de cargas segue o nome do exercício (sobrevive a reordenação e edição do programa)
  function hkey(n) { return String(n || '').trim().toLowerCase(); }
  function sets(e) { var m = /^\s*(\d+)\s*x/i.exec(e || ''); var n = m ? parseInt(m[1], 10) : 1; return (n >= 2 && n <= 6) ? n : 1; }

  G.render = async function (el) {
    var plan = RB.athlete.plan;
    var gym = plan && plan.strength;
    if (!gym || !gym.length) { el.innerHTML = RB.tt('FORÇA') + RB.empty('Treino de força ainda<br>não disponível.'); return; }
    var id = RB.state.user.id;
    var rr = await Promise.all([sb.from('gym_logs').select('*').eq('athlete_id', id).order('created_at', { ascending: false }).limit(300), RB.media.load(id)]);
    var logs = rr[0].data || [];
    var hist = {};
    logs.forEach(function (l) { var k = hkey(l.exercise_name); (hist[k] = hist[k] || []); if (hist[k].length < 6) hist[k].push({ carga: l.carga, date: l.created_at }); });
    var first = logs.length ? logs[logs.length - 1].created_at : null;
    c = { gym: gym, hist: hist, weeks: plan.strength_started_at ? RB.ms.strengthWeeks(plan) : RB.weeksSince(first), el: el };
    if (G.open[0] === undefined) G.open[0] = true;
    draw();
  };

  function exRow(bl, di, bi) {
    var h = c.hist[hkey(bl.b)] || [];
    var vid = RB.media.get(bl.b);
    var icon = (vid ? '<button class="vid-b" onclick="RB.strength.tech(' + di + ',' + bi + ')" aria-label="Ver vídeo">▶ Vídeo</button>' : '') +
      ((bl.tec || bl.warn) && !vid ? '<button class="info-i" onclick="RB.strength.tech(' + di + ',' + bi + ')" aria-label="Ver técnica">i</button>' : '');
    var body = '';
    if (bl.c) {
      var rows = h.length ? h.map(function (x) { return '<div>' + RB.fmtDate(x.date) + '</div><div class="r">' + RB.esc(x.carga) + '</div>'; }).join('')
        : '<div class="none">Nenhum registro ainda</div>';
      var ns = sets(bl.e);
      var btn = '<button class="plus" onclick="RB.strength.add(' + di + ',' + bi + ',this)">+</button>';
      var date = '<input type="date" class="gi" id="gdate_' + di + '_' + bi + '">';
      var inputs = ns === 1
        ? '<div class="gi-row">' + date + '<input type="text" class="gi" placeholder="Carga" id="gcarga_' + di + '_' + bi + '">' + btn + '</div>'
        : '<div class="gi-row">' + date + '</div><div class="gi-lbl">Carga por série</div><div class="gi-row">' +
          Array.apply(null, Array(ns)).map(function (_, i) { return '<input type="text" inputmode="decimal" class="gi" placeholder="S' + (i + 1) + '" id="gcarga_' + di + '_' + bi + '_' + (i + 1) + '">'; }).join('') + btn + '</div>';
      body = '<div class="gtab"><div class="h">Data</div><div class="h r">Carga</div>' + rows + '</div>' + inputs;
    }
    return '<div class="ex"><div class="ex-h"><div class="ex-b">' + RB.esc(bl.b) + '</div>' + icon + '</div><div class="ex-e">' + RB.esc(bl.e) + '</div>' + body + '</div>';
  }

  function draw() {
    var html = RB.tt('FORÇA') + '<div class="hint-row">Toque no <span class="info-i sm">i</span> ou em <b>▶ Vídeo</b> para ver a técnica. Registre a carga de cada série.</div>';
    if (c.weeks >= RB.cfg.gymSwapWeeks) html += '<div class="card rl">' + RB.ew('⚠ Hora de evoluir') + '<div class="p">Você está no mesmo treino de força há ' + c.weeks + ' semanas. Fale com seu coach sobre progredir a carga ou trocar os exercícios.</div></div>';
    c.gym.forEach(function (d, di) {
      var open = !!G.open[di];
      html += '<div class="card gday' + (open ? ' open' : '') + '"><div class="gday-h" onclick="RB.strength.toggle(' + di + ')"><div><div class="gday-d">' + RB.esc(d.dia) + '</div><div class="gday-t">' + RB.esc(d.tipo) + '</div></div>' +
        '<div class="gday-r">' + (d.tempo ? RB.tag(d.tempo, 'm') : '') + '<span class="arrow">' + (open ? '▲' : '▼') + '</span></div></div>';
      var last = G.lastDone(d);
      html += '<div class="gday-f">' + (last ? '<span class="gday-ok">✓ Feito em ' + RB.fmtDate(last.performed_at + 'T12:00:00') + ' · RPE ' + last.rpe + '</span>' : '<span class="gday-no">Ainda sem registro</span>') +
        '<button class="mini" onclick="RB.athlete.strengthForm({day:' + di + '})">Concluir treino</button></div>';
      if (open) {
        html += '<div class="gday-b">' + (d.intro ? '<div class="intro">' + RB.md(d.intro) + '</div>' : '');
        if (d.grupos) {
          var bi = 0;
          d.grupos.forEach(function (g) {
            if (g.nome || g.foco || g.rec) html += '<div class="grp"><div class="grp-n">' + RB.esc(g.nome) + '</div><div class="grp-m">' + (g.foco ? 'Foco: ' + RB.esc(g.foco) : '') + (g.rec ? ' · Rec: ' + RB.esc(g.rec) : '') + '</div></div>';
            g.exercicios.forEach(function (bl) { html += exRow(bl, di, bi); bi++; });
          });
        } else {
          (d.blocos || []).forEach(function (bl, bi) { html += exRow(bl, di, bi); });
        }
        html += '</div>';
      }
      html += '</div>';
    });
    // evolução de cargas
    var ev = '';
    c.gym.forEach(function (d, di) {
      var part = '';
      flat(d).forEach(function (bl, bi) {
        var h = c.hist[hkey(bl.b)]; if (!h || !h.length) return;
        part += '<div class="evo"><div class="evo-n">' + RB.esc(bl.b) + '</div><div class="evo-c">' + h.map(function (x, i) {
          return '<span class="chip' + (i === 0 ? ' last' : '') + '">' + RB.fmtDate(x.date) + ': ' + RB.esc(x.carga) + '</span>';
        }).join('') + '</div></div>';
      });
      if (part) ev += '<div class="evo-d">' + RB.esc(d.dia) + ' — ' + RB.esc(d.tipo) + '</div>' + part;
    });
    html += '<div class="card">' + RB.ew('Evolução de cargas', 'blue') + (ev || '<div class="muted-s" style="text-align:center;padding:12px 0">Ainda sem registros. Salve seu primeiro treino!</div>') + '</div>';
    c.el.innerHTML = html;
  }

  G.dayLabel = function (d) { return d.dia + ' — ' + d.tipo; };
  G.lastDone = function (d) {
    var lbl = G.dayLabel(d);
    return (RB.athlete.feedbacks || []).find(function (f) { return f.kind === 'strength' && f.strength_day === lbl; }) || null;
  };
  G.flat = flat;
  G.days = function () { return c.gym || (RB.athlete.plan && RB.athlete.plan.strength) || []; };
  G.redraw = function () { if (c.el && document.body.contains(c.el) && RB.athlete.tab === 'forca') draw(); };
  G.toggle = function (di) { G.open[di] = !G.open[di]; draw(); };
  G.tech = function (di, bi) {
    var bl = flat(c.gym[di])[bi];
    var vid = RB.media.get(bl.b);
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('Técnica do exercício') + '<div class="sh-t">' + RB.esc(bl.b) + '</div><div class="sh-s">' + RB.esc(bl.e) + '</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      RB.media.player(vid) +
      (bl.tec || !vid ? '<div class="p" style="margin-bottom:16px">' + (bl.tec ? RB.md(bl.tec) : 'Técnica ainda não cadastrada para este exercício.') + '</div>' : '') +
      (bl.warn ? '<div class="warnbox"><div class="warnbox-t">⚠ Atenção</div><div class="p">' + RB.md(bl.warn) + '</div></div>' : '') +
      '<button class="btn btn-r" onclick="RB.closeSheet()">FECHAR</button>');
  };
  G.add = async function (di, bi, btn) {
    var bl = flat(c.gym[di])[bi];
    var ns = sets(bl.e), carga = '';
    if (ns === 1) { var ci = RB.$('gcarga_' + di + '_' + bi); carga = ci ? ci.value.trim() : ''; }
    else {
      var vals = [], any = false;
      for (var i = 1; i <= ns; i++) { var v = (RB.$('gcarga_' + di + '_' + bi + '_' + i) || {}).value; v = v ? v.trim() : ''; if (v) any = true; vals.push(v || '–'); }
      if (any) carga = vals.join(' / ');
    }
    if (!carga) { RB.toast('Preencha a carga', false); return; }
    var payload = { athlete_id: RB.state.user.id, exercise_key: di + '_' + bi, exercise_name: bl.b, carga: carga };
    var dt = RB.$('gdate_' + di + '_' + bi);
    if (dt && dt.value) payload.created_at = new Date(dt.value + 'T12:00:00').toISOString();
    btn.disabled = true;
    var res = await sb.from('gym_logs').insert(payload);
    btn.disabled = false;
    if (res.error) { RB.toast('Erro ao salvar', false); return; }
    RB.toast('Registro salvo ✓');
    await G.render(c.el);
  };
})();
