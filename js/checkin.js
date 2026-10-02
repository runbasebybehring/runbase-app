// Run Base — check-in de segunda: sono, estresse e dores (3 toques). Entra no radar e no resumo da coach.
(function () {
  var sb = RB.sb;
  var K = RB.checkin = { cur: null, f: {} };
  var esc = function (s) { return RB.esc(s); };
  var SONO = ['Péssimo', 'Ruim', 'Ok', 'Bom', 'Ótimo'], EST = ['Baixo', 'Leve', 'Médio', 'Alto', 'Muito alto'];
  var COL = ['#B71C1C', '#E65100', '#F9A825', '#558B2F', '#2E7D32'];
  K.weekStart = function () { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.toISOString().slice(0, 10); };

  K.load = async function (athleteId) {
    var r = await sb.from('checkins').select('*').eq('athlete_id', athleteId).eq('week_start', K.weekStart()).maybeSingle();
    K.cur = r.data || null; K.f = {};
  };
  function scale(k, labels, colors) {
    return '<div class="ck-sc">' + labels.map(function (l, i) {
      var v = i + 1, on = K.f[k] === v, c = colors[i];
      return '<button type="button" class="eb" style="' + (on ? 'background:' + c + '22;border-color:' + c + ';color:' + c : '') + '" onclick="RB.checkin.set(\'' + k + '\',' + v + ')">' + l + '</button>';
    }).join('') + '</div>';
  }
  // cartão na home do aluno (segunda a quinta, até responder)
  K.homeCard = function () {
    var dow = (new Date().getDay() + 6) % 7;
    if (K.cur) return dow <= 1 ? '<div class="card gl ck-done">' + RB.ew('Check-in da semana', 'green') + '<div class="p">Feito ✓ Obrigada! A treinadora já recebeu.</div></div>' : '';
    if (dow > 3) return '';
    return '<div class="card ck-card" id="ck-card">' + RB.ew('☀ Check-in da semana', 'blue') + '<div class="p" style="margin-bottom:10px">3 perguntas rápidas para a treinadora ajustar seus treinos.</div>' +
      '<div class="fld-l">Como está seu sono?</div>' + scale('sono', SONO, COL) +
      '<div class="fld-l">Nível de estresse</div>' + scale('estresse', EST, COL.slice().reverse()) +
      '<div class="fld-l">Alguma dor ou incômodo?</div><div class="ck-sc">' +
      '<button type="button" class="eb' + (K.f.dor === false ? ' sel' : '') + '" onclick="RB.checkin.set(\'dor\',false)">Não</button><button type="button" class="eb' + (K.f.dor === true ? ' sel' : '') + '" onclick="RB.checkin.set(\'dor\',true)">Sim</button></div>' +
      (K.f.dor ? '<input class="fi" id="ck-onde" placeholder="Onde? (ex.: joelho direito, panturrilha)" value="' + esc(K.f.dor_onde || '') + '" oninput="RB.checkin.f.dor_onde=this.value">' : '') +
      '<input class="fi" id="ck-note" style="margin-top:8px" placeholder="Algo mais? (opcional)" value="' + esc(K.f.note || '') + '" oninput="RB.checkin.f.note=this.value">' +
      '<button class="btn btn-r sm" style="margin-top:10px" onclick="RB.checkin.send()">ENVIAR CHECK-IN</button></div>';
  };
  K.set = function (k, v) {
    K.f[k] = v;
    var el = RB.$('ck-card'); if (el) el.outerHTML = K.homeCard();
  };
  K.send = async function () {
    if (!K.f.sono || !K.f.estresse || K.f.dor == null) { RB.toast('Responda as 3 perguntas', false); return; }
    var row = { athlete_id: RB.state.user.id, week_start: K.weekStart(), sono: K.f.sono, estresse: K.f.estresse, dor: K.f.dor, dor_onde: K.f.dor ? (K.f.dor_onde || '').trim() || null : null, note: (K.f.note || '').trim() || null };
    var r = await sb.from('checkins').insert(row).select().single();
    if (r.error) { RB.toast('Não deu para enviar', false); return; }
    K.cur = r.data; RB.toast(row.dor ? 'Enviado ✓ — a treinadora vai ver o aviso de dor' : 'Check-in enviado ✓');
    RB.athlete.go('home');
  };

  // coach: linha do último check-in do aluno
  K.line = function (c) {
    if (!c) return '';
    return '<div class="card ck-line">' + RB.ew('Check-in · semana de ' + RB.fmtDate(c.week_start + 'T12:00:00'), 'blue') +
      '<div class="tags">' + RB.tag('sono ' + SONO[c.sono - 1].toLowerCase(), c.sono <= 2 ? 'r' : c.sono >= 4 ? 'g' : 'm') + ' ' +
      RB.tag('estresse ' + EST[c.estresse - 1].toLowerCase(), c.estresse >= 4 ? 'r' : c.estresse <= 2 ? 'g' : 'm') + ' ' +
      RB.tag(c.dor ? 'dor' + (c.dor_onde ? ': ' + c.dor_onde : '') : 'sem dor', c.dor ? 'r' : 'g') + '</div>' +
      (c.note ? '<div class="fbc-c">“' + esc(c.note) + '”</div>' : '') + '</div>';
  };
})();
