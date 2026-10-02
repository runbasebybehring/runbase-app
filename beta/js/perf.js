// Run Base — testes de corrida (3K/5K/10K) com zonas sugeridas, e plano de prova (pace por km, géis, checklist)
(function () {
  var sb = RB.sb;
  var X = RB.perf = { tests: [] };
  var esc = function (s) { return RB.esc(s); };
  var P = function () { return RB.pace; };
  var fmtDist = function (km) { return km >= 42 ? 'Maratona' : km >= 21 && km < 21.2 ? 'Meia (21K)' : P().fmtKm(km) + ' km'; };

  // ---------- cálculo ----------
  // Riegel: tempo previsto em outra distância
  X.riegel = function (t1, d1, d2) { return t1 * Math.pow(d2 / d1, 1.06); };
  // pace de limiar ≈ pace de uma prova de ~60 min
  X.ltPace = function (t, d) { var d60 = d * Math.pow(3600 / t, 1 / 1.06); return 3600 / d60; };
  // faixas (multiplicadores do pace de limiar), no padrão RUNBASE: Z3 = limiar
  var BANDS = [[1.28, 1.40], [1.16, 1.28], [0.96, 1.06], [0.88, 0.95], [null, 0.88]];
  X.zonesFrom = function (t, d) {
    var lt = X.ltPace(t, d), f = P().fmtPace;
    return BANDS.map(function (b) { return b[0] == null ? 'abaixo de ' + f(lt * b[1]) + ' /km' : f(lt * b[0]) + '–' + f(lt * b[1]) + ' /km'; });
  };
  X.predict = function (t, d) {
    return [[5, '5K'], [10, '10K'], [21.0975, '21K'], [42.195, '42K']].map(function (x) { return { l: x[1], t: X.riegel(t, d, x[0]), p: X.riegel(t, d, x[0]) / x[0] }; });
  };

  // ---------- testes ----------
  X.load = async function (athleteId) {
    var r = await sb.from('tests').select('*').eq('athlete_id', athleteId).order('test_date', { ascending: false });
    X.tests = r.data || []; X.aid = athleteId;
    return X.tests;
  };
  function testRow(t, prev, coach) {
    var p = t.duration_sec / t.distance_km, d = prev ? (prev.duration_sec / prev.distance_km) - p : null;
    var same = prev && Math.abs(prev.distance_km - t.distance_km) < 0.05;
    return '<div class="ts-r"><div><b>' + fmtDist(+t.distance_km) + '</b> · ' + RB.fmtDate(t.test_date + 'T12:00:00') + (t.notes ? '<div class="muted-s">' + esc(t.notes) + '</div>' : '') + '</div>' +
      '<div class="ts-v"><b>' + P().fmtHMS(t.duration_sec) + '</b><span>' + P().fmtPace(p) + ' /km' + (d != null && same && Math.abs(d) >= 1 ? ' <i class="' + (d > 0 ? 'up' : 'dn') + '">' + (d > 0 ? '−' : '+') + Math.round(Math.abs(d)) + 's</i>' : '') + '</span></div>' +
      (coach ? '<button class="mini ghost" onclick="RB.perf.del(\'' + t.id + '\')">✕</button>' : '') + '</div>';
  }
  // cartão (aluno e coach)
  X.card = function (coach) {
    var ts = X.tests;
    var h = '<div class="card tests">' + RB.ew('Testes de corrida', 'blue');
    if (!ts.length) {
      h += '<div class="p" style="margin-bottom:10px">' + (coach ? 'Registre um teste de 3K ou 5K para o app sugerir as zonas de pace.' : 'Quando fizer um teste de 3K ou 5K, registre aqui para acompanhar sua evolução.') + '</div>';
    } else {
      h += ts.map(function (t, i) {
        var prev = ts.slice(i + 1).find(function (x) { return Math.abs(x.distance_km - t.distance_km) < 0.05; });
        return testRow(t, prev, coach);
      }).join('');
      var last = ts[0];
      h += '<div class="ts-pred"><div class="fld-l">Estimativa pelo último teste</div><div class="ts-grid">' + X.predict(last.duration_sec, +last.distance_km).map(function (x) {
        return '<div><span>' + x.l + '</span><b>' + P().fmtHMS(x.t) + '</b><i>' + P().fmtPace(x.p) + '/km</i></div>';
      }).join('') + '</div><div class="hint">Estimativa matemática: vale com treino específico para a distância.</div></div>';
      if (coach) h += '<button class="btn btn-o sm" onclick="RB.perf.suggest()">VER ZONAS SUGERIDAS</button>';
    }
    h += '<button class="' + (ts.length ? 'btn-link' : 'btn btn-r sm') + '" onclick="RB.perf.form(' + (coach ? 1 : 0) + ')">+ Registrar teste</button></div>';
    return h;
  };
  X.form = function (coach) {
    X.coachMode = !!coach;
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('Teste de corrida') + '<div class="sh-t">Registrar teste</div><div class="sh-s">Teste feito no máximo esforço sustentável, de preferência em pista ou percurso plano.</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      '<div class="fld"><div class="fld-l">Distância</div><div class="calc-d">' + [['3', '3K'], ['5', '5K'], ['10', '10K']].map(function (d, i) {
        return '<button class="' + (i === 1 ? 'on' : '') + '" onclick="this.parentNode.querySelectorAll(\'button\').forEach(function(b){b.classList.remove(\'on\')});this.classList.add(\'on\');RB.$(\'ts-km\').value=\'' + d[0] + '\';RB.perf.preview()">' + d[1] + '</button>';
      }).join('') + '<input class="fi" id="ts-km" inputmode="decimal" value="5" oninput="RB.perf.preview()"></div></div>' +
      '<div class="calc-r"><div><div class="fld-l">Tempo (h:mm:ss)</div><input class="fi" id="ts-time" inputmode="numeric" placeholder="25:30" oninput="RB.perf.preview()"></div>' +
      '<div><div class="fld-l">Data</div><input class="fi" type="date" id="ts-date" value="' + new Date().toISOString().slice(0, 10) + '"></div></div>' +
      '<div class="fld"><div class="fld-l">Observação <span class="hint">opcional</span></div><input class="fi" id="ts-notes" placeholder="Pista do Ibirapuera, calor"></div>' +
      '<div class="calc-out" id="ts-prev"></div>' +
      '<button class="btn btn-r" onclick="RB.perf.save()">SALVAR TESTE</button>');
  };
  X.preview = function () {
    var km = P().km(RB.$('ts-km').value), t = P().parseHMS(RB.$('ts-time').value), o = RB.$('ts-prev');
    o.innerHTML = km && t ? 'Pace <b>' + P().fmtPace(t / km) + ' /km</b> · limiar estimado ' + P().fmtPace(X.ltPace(t, km)) + ' /km' : '';
  };
  X.save = async function () {
    var km = P().km(RB.$('ts-km').value), t = P().parseHMS(RB.$('ts-time').value);
    if (!km || !t || t < 300) { RB.toast('Preencha distância e tempo', false); return; }
    var r = await sb.from('tests').insert({ athlete_id: X.aid, distance_km: km, duration_sec: t, test_date: RB.$('ts-date').value || undefined, notes: RB.$('ts-notes').value.trim() || null }).select().single();
    if (r.error) { RB.toast('Erro ao salvar', false); return; }
    X.tests.unshift(r.data); X.tests.sort(function (a, b) { return a.test_date < b.test_date ? 1 : -1; });
    RB.closeSheet(); RB.toast('Teste salvo ✓');
    if (X.coachMode) { RB.coach.dt('plano').then(function () { X.suggest(); }); } else RB.athlete.go('planilha');
  };
  X.del = async function (id) {
    if (!confirm('Excluir este teste?')) return;
    await sb.from('tests').delete().eq('id', id);
    X.tests = X.tests.filter(function (t) { return t.id !== id; });
    RB.coach.dt('plano');
  };
  // coach: zonas sugeridas pelo último teste
  X.suggest = function () {
    var t = X.tests[0]; if (!t) return;
    X.sug = X.zonesFrom(t.duration_sec, +t.distance_km);
    var names = ['Z1 · Regenerativo', 'Z2 · Aeróbico', 'Z3 · Limiar', 'Z4 · Intervalado', 'Z5 · Forte'];
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('Zonas sugeridas') + '<div class="sh-t">Pelo teste de ' + fmtDist(+t.distance_km) + ' em ' + P().fmtHMS(t.duration_sec) + '</div><div class="sh-s">Limiar estimado: ' + P().fmtPace(X.ltPace(t.duration_sec, +t.distance_km)) + ' /km. Revise antes de aplicar.</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      X.sug.map(function (p, i) { return '<div class="zone sm"><div style="flex:1"><div class="zone-h"><span class="zone-n">' + names[i] + '</span><span class="zone-p">' + esc(p) + '</span></div></div></div>'; }).join('') +
      '<button class="btn btn-r" style="margin-top:12px" onclick="RB.closeSheet();RB.edit.zonesWith(RB.perf.sug)">APLICAR NAS ZONAS</button>' +
      '<div class="hint" style="text-align:center;margin-top:8px">Abre o editor de zonas já preenchido. Nada muda até você salvar.</div>');
  };

  // ---------- plano de prova ----------
  X.raceKm = function (txt) {
    txt = String(txt || '');
    if (/meia/i.test(txt)) return 21.0975;
    if (/maratona/i.test(txt) && !/meia/i.test(txt)) return 42.195;
    var m = /(\d+(?:[.,]\d+)?)\s*k(?:m)?\b/i.exec(txt);
    if (!m) return null;
    var v = parseFloat(m[1].replace(',', '.'));
    return v === 21 ? 21.0975 : v === 42 ? 42.195 : v;
  };
  // plano: { target: "1:55:00", gel_min: 40, notes: "" }
  X.plan = function (athlete, rp, tests) {
    var km = X.raceKm(athlete.race) || X.raceKm(athlete.goal);
    if (!km) return null;
    var tgt = rp && P().parseHMS(rp.target), from = 'meta definida pela treinadora';
    if (!tgt && tests && tests.length) { tgt = X.riegel(tests[0].duration_sec, +tests[0].distance_km, km); from = 'estimativa pelo seu último teste'; }
    if (!tgt) return { km: km, missing: true };
    var D = km, segs;
    if (D >= 8) {
      var m = (tgt - 5) / D;
      segs = [{ a: 0, b: 2, p: m + 10, t: 'Largada: segura um pouco. A adrenalina engana.' },
        { a: 2, b: D - 3, p: m, t: 'Ritmo de prova, constante. Respira e encaixa.' },
        { a: D - 3, b: D, p: m - 5, t: 'Final: se estiver bem, solta.' }];
    } else {
      var m2 = (tgt - 5) / D;
      segs = [{ a: 0, b: 1, p: m2 + 5, t: 'Primeiro km controlado.' }, { a: 1, b: D, p: m2, t: 'Ritmo constante até o fim.' }];
    }
    var gelMin = (rp && +rp.gel_min) || 40, gels = [];
    if (tgt > 75 * 60) for (var g = gelMin * 60; g < tgt - 15 * 60; g += gelMin * 60) gels.push({ min: Math.round(g / 60), km: g / (tgt / D) });
    var marks = [5, 10, 15, 21.0975, 30, 42.195].filter(function (x) { return x < D - 0.5; }).concat([D]);
    var at = function (k) { var t = 0; segs.forEach(function (s) { var a = Math.max(s.a, 0), b = Math.min(s.b, k); if (b > a) t += (b - a) * s.p; }); return t; };
    return { km: km, target: tgt, from: from, segs: segs, gels: gels, splits: marks.map(function (k) { return { k: k, t: at(k) }; }), notes: rp && rp.notes };
  };
  X.raceHtml = function (athlete, rp, tests) {
    var pl = X.plan(athlete, rp, tests);
    if (!pl) return RB.empty('Coloque a distância da prova no perfil (ex.: "21K — 18/10/2026").');
    if (pl.missing) return '<div class="p">Falta a meta de tempo. ' + (RB.state.isCoach ? 'Defina a meta abaixo ou registre um teste.' : 'Sua treinadora vai definir a meta da prova.') + '</div>';
    var f = P().fmtPace, hms = P().fmtHMS, k = P().fmtKm;
    return '<div class="rp-top"><div><span>Meta</span><b>' + hms(pl.target) + '</b><i>' + esc(pl.from) + '</i></div><div><span>Pace médio</span><b>' + f(pl.target / pl.km) + '</b><i>/km · ' + k(pl.km) + ' km</i></div></div>' +
      '<div class="fld-l">Estratégia</div>' + pl.segs.map(function (s) {
        return '<div class="rp-seg"><div class="rp-k">km ' + k(s.a) + '–' + k(s.b) + '</div><div class="rp-p">' + f(s.p) + '<span>/km</span></div><div class="rp-t">' + esc(s.t) + '</div></div>';
      }).join('') +
      '<div class="fld-l" style="margin-top:12px">Passagens</div><div class="rp-splits">' + pl.splits.map(function (s) { return '<div><span>' + (s.k === pl.km ? 'Chegada' : k(s.k) + ' km') + '</span><b>' + hms(s.t) + '</b></div>'; }).join('') + '</div>' +
      (pl.gels.length ? '<div class="fld-l" style="margin-top:12px">Géis</div>' + pl.gels.map(function (g, i) { return '<div class="rp-gel">' + (i + 1) + 'º gel · ~' + g.min + ' min · perto do km ' + Math.round(g.km) + '</div>'; }).join('') +
        '<div class="hint">Tome com água, num posto. Use só gel que você já testou nos longões.</div>' : '') +
      (pl.notes ? '<div class="rp-notes"><div class="fld-l">Recado da treinadora</div>' + RB.md(pl.notes) + '</div>' : '') +
      '<div class="fld-l" style="margin-top:12px">Checklist</div>' + [
        ['Véspera', 'Kit separado: tênis já usado, roupa testada, número de peito e alfinetes, chip. Jantar habitual, nada novo. Dormir cedo.'],
        ['Manhã da prova', 'Café da manhã testado 2–3h antes. Chegar 45 min antes. Banheiro com folga. Trote leve de 10 min.'],
        ['Durante', 'Larga no seu pelotão. Não persegue ninguém nos primeiros km. Água em todos os postos se estiver calor.'],
        ['Depois', 'Hidrata, come, trota ou caminha 10 min. Conta pra treinadora como foi no feedback.']
      ].map(function (c) { return '<div class="rp-ck"><b>' + c[0] + '</b>' + c[1] + '</div>'; }).join('');
  };
  // aluno: abre o plano
  X.openRace = async function () {
    var A = RB.athlete;
    if (!X.tests.length || X.aid !== A.me.id) await X.load(A.me.id);
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('Plano de prova') + '<div class="sh-t">' + esc(A.me.race) + '</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      X.raceHtml(A.me, A.plan && A.plan.race_plan, X.tests) + '<button class="btn btn-r" style="margin-top:14px" onclick="RB.closeSheet()">FECHAR</button>');
  };
})();
