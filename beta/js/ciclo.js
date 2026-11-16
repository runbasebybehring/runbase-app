// Run Base — aba Ciclo (opcional, a aluna ativa em "Minha conta"): registra menstruação e sintomas,
// mostra a fase do ciclo e explica o que costuma acontecer com o treino em cada fase. A treinadora vê os registros.
// Tabelas: period_settings (1 linha por aluna) e period_logs (1 linha por dia).
(function () {
  var sb = RB.sb;
  var C = RB.ciclo = { cfg: null, logs: [], sel: null };
  var esc = function (s) { return RB.esc(s); };

  // ---------- datas (sempre no fuso local, como 'AAAA-MM-DD') ----------
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var parse = function (s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); };
  var addD = function (s, n) { var d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  var diff = function (a, b) { return Math.round((parse(a) - parse(b)) / 864e5); };
  var today = function () { return ymd(new Date()); };
  var curto = function (s) { var d = parse(s); return d.getDate() + ' ' + ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][d.getMonth()]; };

  var HORM = [['nao', 'Não uso'], ['pilula', 'Pílula'], ['diu_h', 'DIU hormonal'], ['implante', 'Implante / injeção'], ['outro', 'Outro']];
  var FLUXO = [['', 'Não'], ['leve', 'Leve'], ['medio', 'Médio'], ['forte', 'Forte']];
  var SINT = ['Cólica', 'Inchaço', 'Dor de cabeça', 'Cansaço', 'Sono ruim', 'Lombar', 'Seios sensíveis', 'Humor oscilando', 'Mais fome', 'Enjoo', 'Pernas pesadas', 'Tudo ótimo'];
  var BAT = ['#B71C1C', '#E65100', '#F9A825', '#558B2F', '#2E7D32'];

  // ---------- fases ----------
  var F = {
    menstrual: { n: 'Menstrual', c: '#C41731', e: '🩸',
      corpo: 'Estrogênio e progesterona estão no ponto mais baixo. Cólica, cansaço e lombar são comuns nos primeiros dias, mas muitas mulheres treinam muito bem nessa fase.',
      treino: 'Se estiver bem, siga a planilha normalmente. Se a cólica pegar, faça um aquecimento mais longo e ajuste a intensidade pela sensação. Movimento leve costuma até aliviar a cólica.',
      dica: 'Capriche na hidratação e em alimentos com ferro: feijão, carnes, folhas verde-escuras.' },
    folicular: { n: 'Folicular', c: '#2E7D32', e: '🌱',
      corpo: 'O estrogênio vai subindo. Muitas mulheres sentem mais energia, disposição e recuperação mais rápida.',
      treino: 'Costuma ser um bom momento para os treinos mais fortes da planilha: tiros, ritmo e progressão de carga na força.',
      dica: 'Aproveite a energia, mas sem pular o descanso: recuperação continua contando.' },
    ovulatoria: { n: 'Ovulatória', c: '#E8772E', e: '☀️',
      corpo: 'Pico de estrogênio. A energia geralmente está alta. Alguns estudos sugerem um pouco mais de frouxidão nos ligamentos nesses dias.',
      treino: 'Bom dia para treino forte. Capriche no aquecimento e na técnica em saltos, educativos e mudanças de direção.',
      dica: 'Atenção à postura do joelho nos agachamentos e afundos.' },
    lutea: { n: 'Lútea', c: '#2B4EAA', e: '🌙',
      corpo: 'A progesterona sobe e a temperatura do corpo aumenta um pouquinho (cerca de 0,3 °C). O calor pode pesar mais e a fome pode aumentar. É normal.',
      treino: 'O mesmo pace pode parecer mais difícil. Vale se guiar pela sensação e pela frequência cardíaca, sem brigar com o relógio.',
      dica: 'Hidrate bem, principalmente em longão e dias quentes. Um lanche antes do treino ajuda.' },
    tpm: { n: 'Pré-menstrual', c: '#7B1FA2', e: '🌧️',
      corpo: 'Os hormônios começam a cair. Inchaço, irritação, sono pior e cansaço podem aparecer: é a famosa TPM.',
      treino: 'Siga o plano ajustando pela sensação. Treinos leves e de força costumam ajudar no humor e no sono.',
      dica: 'Priorize dormir bem e diminua o sal se o inchaço incomodar.' }
  };
  var ORDEM = ['menstrual', 'folicular', 'ovulatoria', 'lutea', 'tpm'];
  var natural = function () { return C.cfg && C.cfg.hormonal === 'nao'; };

  // inícios de menstruação: dia com fluxo cujo dia com fluxo anterior está a mais de 2 dias
  function starts() {
    var fl = C.logs.filter(function (l) { return l.flow; }).map(function (l) { return l.day; }).sort();
    var out = [];
    fl.forEach(function (d, i) { if (!i || diff(d, fl[i - 1]) > 2) out.push(d); });
    return out;
  }
  function lens() {
    var s = starts(), L = C.cfg.cycle_len, P = C.cfg.period_len;
    var iv = [];
    for (var i = Math.max(1, s.length - 3); i < s.length; i++) { var x = diff(s[i], s[i - 1]); if (x >= 18 && x <= 60) iv.push(x); }
    if (iv.length) L = Math.round(iv.reduce(function (a, b) { return a + b; }, 0) / iv.length);
    return { L: L, P: P, s: s };
  }
  function faseDia(day, L, P) {
    var ov = L - 14;
    if (day <= P) return 'menstrual';
    if (day < ov - 1) return 'folicular';
    if (day <= ov + 1) return 'ovulatoria';
    if (day <= L - 5) return 'lutea';
    return 'tpm';
  }
  // fase de uma data qualquer (null se não dá pra saber)
  C.phaseOf = function (date) {
    if (!natural()) return null;
    var k = lens(), st = null;
    for (var i = k.s.length - 1; i >= 0; i--) if (k.s[i] <= date) { st = k.s[i]; break; }
    if (!st) return null;
    var day = diff(date, st) + 1;
    if (day > 60) return null;
    return { day: day, key: day > k.L ? 'tpm' : faseDia(day, k.L, k.P), L: k.L, P: k.P, start: st, late: day > k.L };
  };
  var logOf = function (d) { return C.logs.find(function (l) { return l.day === d; }); };

  C.load = async function (uid) {
    C.cfg = null; C.logs = [];
    try {
      var r = await Promise.all([
        sb.from('period_settings').select('*').eq('athlete_id', uid).maybeSingle(),
        sb.from('period_logs').select('*').eq('athlete_id', uid).gte('day', addD(today(), -400)).order('day')
      ]);
      C.cfg = r[0].data || null; C.logs = r[1].data || [];
    } catch (e) {}
    C.nav();
  };
  C.on = function () { return !!(C.cfg && C.cfg.enabled); };
  C.nav = function () { var b = document.querySelector('#screen-athlete .nav-btn[data-tab="ciclo"]'); if (b) b.style.display = C.on() ? '' : 'none'; };

  // ---------- anel do ciclo ----------
  function ring(ph, size) {
    var L = ph.L, R = 92, cx = 110, cy = 110, s = '';
    for (var d = 1; d <= L; d++) {
      var a0 = (d - 1) / L * 2 * Math.PI - Math.PI / 2, a1 = d / L * 2 * Math.PI - Math.PI / 2 - .025;
      var k = faseDia(d, L, ph.P), on = d === Math.min(ph.day, L);
      s += '<path d="M' + (cx + R * Math.cos(a0)) + ' ' + (cy + R * Math.sin(a0)) + 'A' + R + ' ' + R + ' 0 0 1 ' + (cx + R * Math.cos(a1)) + ' ' + (cy + R * Math.sin(a1)) + '" stroke="' + F[k].c + '" stroke-width="' + (on ? 22 : 14) + '" fill="none" opacity="' + (d <= ph.day ? 1 : .28) + '"/>';
    }
    var at = (Math.min(ph.day, L) - .5) / L * 2 * Math.PI - Math.PI / 2;
    s += '<circle cx="' + (cx + R * Math.cos(at)) + '" cy="' + (cy + R * Math.sin(at)) + '" r="9" fill="#fff" stroke="#1A1A1A" stroke-width="3"/>';
    return '<svg viewBox="0 0 220 220" width="' + (size || 220) + '" class="cy-ring" aria-hidden="true">' + s + '</svg>';
  }

  // ---------- home: cartãozinho ----------
  C.homeCard = function () {
    if (!C.on()) return '';
    var ph = C.phaseOf(today()), lg = logOf(today());
    var t = ph ? '<b>Dia ' + ph.day + '</b> · ' + (ph.late ? 'menstruação atrasando?' : 'fase ' + F[ph.key].n.toLowerCase()) : natural() ? '<b>Seu ciclo</b> · marque o 1º dia da menstruação' : '<b>Seu ciclo</b> · registre como você está';
    return '<button class="cy-home" style="--pc:' + (ph ? F[ph.key].c : '#7B1FA2') + '" onclick="RB.athlete.go(\'ciclo\')"><span class="cy-dot">' + (ph ? F[ph.key].e : '☾') + '</span><span class="cy-ht">' + t + '</span><span class="cy-hr">' + (lg ? '✓ hoje' : 'Registrar ›') + '</span></button>';
  };

  // ---------- aba Ciclo ----------
  C.render = function (el) {
    if (!C.on()) { el.innerHTML = RB.tt('CICLO') + convite(); return; }
    var hoje = today(), ph = C.phaseOf(hoje), lg = logOf(hoje), html = RB.tt('CICLO');
    if (ph) {
      var f = F[ph.key], prox = addD(ph.start, ph.L), falta = diff(prox, hoje);
      html += '<div class="cy-hero" style="--pc:' + f.c + '"><div class="cy-rw">' + ring(ph) + '<div class="cy-c"><small>DIA</small><b>' + ph.day + '</b><span>' + f.e + ' ' + f.n + '</span></div></div>' +
        '<div class="cy-pred">' + (ph.late ? 'A menstruação era esperada por volta de ' + curto(prox) + '. Quando vier, marque aqui.' : falta <= 0 ? 'A menstruação pode vir hoje.' : 'Próxima menstruação: por volta de <b>' + curto(prox) + '</b> (em ' + falta + ' dia' + (falta > 1 ? 's' : '') + ')') + '</div></div>';
    } else if (natural()) {
      html += '<div class="cy-hero" style="--pc:#7B1FA2"><div class="cy-empty">☾</div><div class="cy-pred">Marque o primeiro dia da sua última menstruação para o app calcular sua fase.</div></div>';
    } else {
      html += '<div class="cy-hero" style="--pc:#7B1FA2"><div class="cy-empty">☾</div><div class="cy-pred">Com anticoncepcional hormonal, as fases naturais do ciclo ficam mais estáveis, então o app não calcula fase. Registre sintomas e sangramentos: com o tempo, aparece o <b>seu</b> padrão.</div></div>';
    }
    html += '<button class="cy-log' + (lg ? ' done' : '') + '" onclick="RB.ciclo.logSheet()">' + (lg ? '✓ Hoje registrado · editar' : '+ Como você está hoje?') + '</button>';
    html += alerta();
    if (ph && !ph.late) {
      var f2 = F[ph.key];
      html += '<div class="cy-card" style="--pc:' + f2.c + '"><div class="cy-tag">' + f2.e + ' Fase ' + f2.n.toLowerCase() + '</div>' +
        '<div class="cy-sec"><b>No corpo</b><p>' + f2.corpo + '</p></div><div class="cy-sec"><b>No treino</b><p>' + f2.treino + '</p></div><div class="cy-sec"><b>Dica</b><p>' + f2.dica + '</p></div></div>';
    }
    html += strip() + padroes() + fasesGuia() +
      '<div class="hint cy-disc">Isso é o que costuma acontecer na média. O efeito do ciclo no desempenho varia muito de mulher pra mulher: o que vale é o seu padrão. Dor forte, ciclo muito irregular ou mais de 3 meses sem menstruar: converse com sua ginecologista e com a treinadora.</div>' +
      '<button class="btn-link" onclick="RB.ciclo.setup()">Ajustes do ciclo</button>';
    el.innerHTML = html;
  };
  function alerta() {
    if (!natural()) return '';
    var s = starts(), last = s[s.length - 1];
    var from = last || (C.cfg.created_at || '').slice(0, 10);
    if (!from || diff(today(), from) < 60) return '';
    return '<div class="card rl">' + RB.ew('Faz tempo sem menstruação') + '<div class="p">Já são mais de 2 meses sem registro. Se ela não veio mesmo, vale conversar com a treinadora e com sua médica: em quem treina, isso pode ter a ver com energia, alimentação e carga de treino. Se só esqueceu de marcar, tudo certo, é só registrar.</div></div>';
  }
  // últimos 28 dias
  function strip() {
    var hoje = today(), cells = '';
    for (var i = 27; i >= 0; i--) {
      var d = addD(hoje, -i), l = logOf(d), ph = C.phaseOf(d);
      cells += '<button class="cy-d' + (i === 0 ? ' hj' : '') + (l && l.flow ? ' fl ' + l.flow : '') + '" style="' + (ph ? '--pc:' + F[ph.key].c : '') + '" onclick="RB.ciclo.logSheet(\'' + d + '\')" aria-label="' + curto(d) + '">' +
        '<span>' + parse(d).getDate() + '</span>' + (l ? '<i>' + (l.flow ? '' : l.symptoms.length ? '•' : '✓') + '</i>' : '') + '</button>';
    }
    return '<div class="card"><div class="ew mid">Últimos 28 dias</div><div class="cy-strip">' + cells + '</div><div class="hint" style="margin-top:8px">Toque num dia para registrar ou corrigir. 🔴 menstruação · • sintomas</div></div>';
  }
  // padrões pessoais: sintomas e esforço (RPE dos feedbacks) por fase
  function padroes() {
    if (!natural() || starts().length < 2) return '<div class="card"><div class="ew mid">Seus padrões</div><div class="p">Depois de 2 ciclos registrados, aparece aqui como <b>você</b> costuma se sentir e render em cada fase.</div></div>';
    var by = {};
    ORDEM.forEach(function (k) { by[k] = { n: 0, s: {}, en: [], rpe: [] }; });
    C.logs.forEach(function (l) {
      var ph = C.phaseOf(l.day); if (!ph || ph.late) return;
      var b = by[ph.key]; b.n++;
      (l.symptoms || []).forEach(function (x) { if (x !== 'Tudo ótimo') b.s[x] = (b.s[x] || 0) + 1; });
      if (l.energia) b.en.push(l.energia);
    });
    ((RB.athlete && RB.athlete.feedbacks) || []).forEach(function (f) {
      if (!f.rpe) return;
      var ph = C.phaseOf(String(f.performed_at || f.created_at).slice(0, 10)); if (ph && !ph.late) by[ph.key].rpe.push(+f.rpe);
    });
    var avg = function (a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; };
    var rows = ORDEM.map(function (k) {
      var b = by[k], top = Object.keys(b.s).sort(function (x, y) { return b.s[y] - b.s[x]; }).slice(0, 3);
      if (!b.n && b.rpe.length < 2) return '';
      return '<div class="cy-pr" style="--pc:' + F[k].c + '"><div class="cy-prn">' + F[k].e + ' ' + F[k].n + '</div><div class="cy-prt">' +
        (top.length ? top.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') : '<span class="ok">sem sintomas frequentes</span>') + '</div>' +
        '<div class="cy-prm">' + (b.en.length >= 2 ? '<span>energia ' + avg(b.en).toFixed(1) + '/5</span>' : '') + (b.rpe.length >= 2 ? '<span>esforço nos treinos ' + avg(b.rpe).toFixed(1) + '</span>' : '') + '</div></div>';
    }).join('');
    return '<div class="card"><div class="ew mid">Seus padrões</div>' + rows + '<div class="hint" style="margin-top:6px">Esforço = média da nota de esforço (RPE) que você dá nos feedbacks dos treinos naquela fase.</div></div>';
  }
  function fasesGuia() {
    if (!natural()) return '';
    return '<details class="cy-guia"><summary>Entenda as 5 fases</summary>' + ORDEM.map(function (k) {
      return '<div class="cy-gi" style="--pc:' + F[k].c + '"><b>' + F[k].e + ' ' + F[k].n + '</b><p>' + F[k].treino + '</p></div>';
    }).join('') + '</details>';
  }

  // ---------- registrar um dia ----------
  C.f = {};
  C.logSheet = function (day) {
    day = day || today();
    var l = logOf(day) || {};
    C.f = { day: day, flow: l.flow || '', symptoms: (l.symptoms || []).slice(), energia: l.energia || null, note: l.note || '' };
    sheet();
  };
  function sheet() {
    var f = C.f, isHoje = f.day === today();
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('☾ Ciclo') + '<div class="sh-t">' + (isHoje ? 'Como você está hoje?' : curto(f.day)) + '</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      '<div class="fld"><div class="fld-l">Menstruação</div><div class="cy-op">' + FLUXO.map(function (o) {
        return '<button class="cy-b' + (f.flow === o[0] ? ' on' : '') + (o[0] ? ' fl' : '') + '" onclick="RB.ciclo.set(\'flow\',\'' + o[0] + '\')">' + (o[0] ? '🩸'.repeat(o[0] === 'leve' ? 1 : o[0] === 'medio' ? 2 : 3) + ' ' : '') + o[1] + '</button>';
      }).join('') + '</div></div>' +
      '<div class="fld"><div class="fld-l">Energia</div><div class="cy-op">' + [1, 2, 3, 4, 5].map(function (n) {
        var seg = ''; for (var j = 0; j < 5; j++) seg += '<i' + (j < n ? ' style="background:' + BAT[n - 1] + '"' : '') + '></i>';
        return '<button class="cy-b en' + (f.energia === n ? ' on' : '') + '" onclick="RB.ciclo.set(\'energia\',' + n + ')" aria-label="Energia ' + n + ' de 5"><span class="ckx-bat">' + seg + '</span></button>';
      }).join('') + '</div></div>' +
      '<div class="fld"><div class="fld-l">Sintomas</div><div class="cy-ch">' + SINT.map(function (s) {
        return '<button class="ckx-ch sm' + (f.symptoms.indexOf(s) >= 0 ? ' on' : '') + '" onclick="RB.ciclo.sym(this)">' + s + '</button>';
      }).join('') + '</div></div>' +
      '<div class="fld"><input class="fi" placeholder="Anotação (opcional)" value="' + esc(f.note) + '" oninput="RB.ciclo.f.note=this.value"></div>' +
      '<button class="btn btn-r" id="cy-save" onclick="RB.ciclo.save()">SALVAR</button>' +
      (logOf(f.day) ? '<button class="btn-link danger" onclick="RB.ciclo.del()">Apagar registro deste dia</button>' : '') +
      '<div class="hint" style="margin-top:10px;text-align:center">A treinadora vê seus registros.</div>');
  }
  C.set = function (k, v) { C.f[k] = C.f[k] === v && k === 'energia' ? null : v; sheet(); };
  C.sym = function (b) {
    var s = b.textContent, a = C.f.symptoms, i = a.indexOf(s);
    if (i >= 0) a.splice(i, 1); else { a.push(s); if (s === 'Tudo ótimo') C.f.symptoms = a = ['Tudo ótimo']; else { var j = a.indexOf('Tudo ótimo'); if (j >= 0) a.splice(j, 1); } }
    sheet();
  };
  C.save = async function () {
    var f = C.f;
    if (!f.flow && !f.symptoms.length && !f.energia && !f.note.trim()) { RB.toast('Marque pelo menos uma coisa', false); return; }
    var b = RB.$('cy-save'); if (b) b.disabled = true;
    var row = { athlete_id: RB.state.user.id, day: f.day, flow: f.flow || null, symptoms: f.symptoms, energia: f.energia, note: f.note.trim() || null };
    var r = await sb.from('period_logs').upsert(row, { onConflict: 'athlete_id,day' }).select().single();
    if (r.error) { if (b) b.disabled = false; RB.toast('Não deu para salvar', false); return; }
    C.logs = C.logs.filter(function (l) { return l.day !== f.day; }).concat([r.data]).sort(function (a, c) { return a.day < c.day ? -1 : 1; });
    RB.closeSheet(); RB.toast('Registrado ✓'); RB.athlete.go(RB.athlete.tab, true);
  };
  C.del = async function () {
    var r = await sb.from('period_logs').delete().eq('athlete_id', RB.state.user.id).eq('day', C.f.day);
    if (r.error) { RB.toast('Não deu para apagar', false); return; }
    C.logs = C.logs.filter(function (l) { return l.day !== C.f.day; });
    RB.closeSheet(); RB.athlete.go(RB.athlete.tab, true);
  };

  // ---------- ativar / ajustes ----------
  function convite() {
    return '<div class="cy-inv"><div class="cy-empty">☾</div><div class="sh-t" style="text-align:center">Treino e ciclo menstrual</div>' +
      '<p class="p" style="text-align:center;margin:8px 0 16px">Registre sua menstruação e como você se sente. O app mostra em que fase do ciclo você está e explica como isso pode influenciar seus treinos.</p>' +
      '<button class="btn btn-r" onclick="RB.ciclo.setup()">ATIVAR</button></div>';
  }
  C.s = {};
  C.setup = function () {
    var c = C.cfg || {};
    C.s = { hormonal: c.hormonal || 'nao', cycle_len: c.cycle_len || 28, period_len: c.period_len || 5, last: '' };
    setupSheet();
  };
  function setupSheet() {
    var s = C.s, novo = !C.on(), nat = s.hormonal === 'nao';
    var opt = function (k, arr) { return '<div class="cy-op wrap">' + arr.map(function (o) { return '<button class="cy-b' + (String(s[k]) === String(o[0]) ? ' on' : '') + '" onclick="RB.ciclo.ss(\'' + k + '\',\'' + o[0] + '\')">' + o[1] + '</button>'; }).join('') + '</div>'; };
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('☾ Ciclo') + '<div class="sh-t">' + (novo ? 'Acompanhar meu ciclo' : 'Ajustes do ciclo') + '</div>' +
      '<div class="sh-s">' + (novo ? 'A treinadora vai ver seus registros para entender melhor seus treinos.' : 'A treinadora vê seus registros.') + '</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      '<div class="fld"><div class="fld-l">Usa anticoncepcional hormonal?</div>' + opt('hormonal', HORM) + '</div>' +
      (nat ? '<div class="fld"><div class="fld-l">Seu ciclo costuma durar <span class="hint">do 1º dia de uma menstruação até a próxima</span></div><div class="cy-num"><button onclick="RB.ciclo.ss(\'cycle_len\',' + (s.cycle_len - 1) + ')">−</button><b>' + s.cycle_len + ' dias</b><button onclick="RB.ciclo.ss(\'cycle_len\',' + (s.cycle_len + 1) + ')">+</button></div></div>' +
        '<div class="fld"><div class="fld-l">A menstruação costuma durar</div><div class="cy-num"><button onclick="RB.ciclo.ss(\'period_len\',' + (s.period_len - 1) + ')">−</button><b>' + s.period_len + ' dias</b><button onclick="RB.ciclo.ss(\'period_len\',' + (s.period_len + 1) + ')">+</button></div><div class="hint" style="margin-top:4px">Não sabe? Deixe 28 e 5: o app ajusta sozinho conforme você registra.</div></div>' +
        (novo || !starts().length ? '<div class="fld"><div class="fld-l">1º dia da última menstruação</div><input class="fi" type="date" max="' + today() + '" value="' + s.last + '" onchange="RB.ciclo.s.last=this.value"></div>' : '') : '') +
      '<button class="btn btn-r" id="cy-go" onclick="RB.ciclo.saveCfg()">' + (novo ? 'ATIVAR' : 'SALVAR') + '</button>' +
      (novo ? '' : '<button class="btn-link danger" onclick="RB.ciclo.off()">Desativar a aba Ciclo</button>'));
  }
  C.ss = function (k, v) {
    if (k === 'cycle_len') v = Math.max(18, Math.min(60, +v));
    if (k === 'period_len') v = Math.max(1, Math.min(12, +v));
    var dt = document.querySelector('#sheet-body input[type=date]'); if (dt) C.s.last = dt.value;
    C.s[k] = v; setupSheet();
  };
  C.saveCfg = async function () {
    var s = C.s, uid = RB.state.user.id, b = RB.$('cy-go'); if (b) b.disabled = true;
    var row = { athlete_id: uid, enabled: true, hormonal: s.hormonal, cycle_len: +s.cycle_len, period_len: +s.period_len, updated_at: new Date().toISOString() };
    var r = await sb.from('period_settings').upsert(row, { onConflict: 'athlete_id' }).select().single();
    if (r.error) { if (b) b.disabled = false; RB.toast('Não deu para salvar', false); return; }
    C.cfg = r.data;
    if (s.hormonal === 'nao' && s.last) {
      var rows = []; for (var i = 0; i < Math.min(+s.period_len, diff(today(), s.last) + 1); i++) rows.push({ athlete_id: uid, day: addD(s.last, i), flow: i === 0 ? 'medio' : 'leve', symptoms: [] });
      var r2 = await sb.from('period_logs').upsert(rows, { onConflict: 'athlete_id,day' }).select();
      if (!r2.error) { var ds = rows.map(function (x) { return x.day; }); C.logs = C.logs.filter(function (l) { return ds.indexOf(l.day) < 0; }).concat(r2.data).sort(function (a, c) { return a.day < c.day ? -1 : 1; }); }
    }
    C.nav(); RB.closeSheet(); RB.toast('Pronto ✓'); RB.athlete.go('ciclo');
  };
  C.off = async function () {
    if (!confirm('Desativar a aba Ciclo? Seus registros ficam guardados se quiser voltar depois.')) return;
    var r = await sb.from('period_settings').update({ enabled: false, updated_at: new Date().toISOString() }).eq('athlete_id', RB.state.user.id).select().single();
    if (r.error) { RB.toast('Não deu para desativar', false); return; }
    C.cfg = r.data; C.nav(); RB.closeSheet(); RB.athlete.go('home');
  };
  // botão em "Minha conta"
  C.accountBtn = function () {
    return '<button class="btn btn-o" style="margin-top:10px" onclick="RB.closeSheet();' + (C.on() ? 'RB.athlete.go(\'ciclo\')' : 'RB.ciclo.setup()') + '">☾ ' + (C.on() ? 'MEU CICLO' : 'ACOMPANHAR MEU CICLO MENSTRUAL') + '</button>';
  };

  // ---------- treinadora: cartão no perfil da aluna ----------
  C.coachCard = async function (athleteId) {
    try {
      var r = await Promise.all([
        sb.from('period_settings').select('*').eq('athlete_id', athleteId).maybeSingle(),
        sb.from('period_logs').select('*').eq('athlete_id', athleteId).gte('day', addD(today(), -400)).order('day')
      ]);
      if (!r[0].data || !r[0].data.enabled) return '';
      var keep = { cfg: C.cfg, logs: C.logs };
      C.cfg = r[0].data; C.logs = r[1].data || [];
      var ph = C.phaseOf(today()), hoje = today();
      var rec = C.logs.filter(function (l) { return diff(hoje, l.day) <= 7 && (l.symptoms.length || l.flow || l.note); }).reverse();
      var s = starts(), sem = natural() && diff(hoje, s.length ? s[s.length - 1] : (C.cfg.created_at || hoje).slice(0, 10)) >= 60;
      var html = '<div class="card cy-coach"' + (ph ? ' style="--pc:' + F[ph.key].c + '"' : '') + '>' + RB.ew('☾ Ciclo', 'mid') +
        '<div class="cy-ch1">' + (ph ? '<b>' + F[ph.key].e + ' Dia ' + ph.day + ' · ' + (ph.late ? 'atrasada' : F[ph.key].n) + '</b>' : '<b>' + (natural() ? 'Sem fase calculada' : 'Usa ' + (HORM.find(function (h) { return h[0] === C.cfg.hormonal; }) || ['', 'anticoncepcional'])[1].toLowerCase()) + '</b>') +
        (ph && !ph.late ? '<span>' + F[ph.key].treino + '</span>' : '') + '</div>' +
        (sem ? '<div class="tags" style="margin:6px 0">' + RB.tag('+2 meses sem menstruação registrada', 'r') + '</div>' : '') +
        (rec.length ? rec.slice(0, 5).map(function (l) {
          return '<div class="cy-cl"><span>' + curto(l.day) + '</span>' + (l.flow ? '🩸 ' : '') + esc((l.symptoms || []).join(', ')) + (l.energia ? ' · energia ' + l.energia + '/5' : '') + (l.note ? ' · “' + esc(l.note) + '”' : '') + '</div>';
        }).join('') : '<div class="hint">Sem registros nos últimos 7 dias.</div>') + '</div>';
      C.cfg = keep.cfg; C.logs = keep.logs;
      return html;
    } catch (e) { return ''; }
  };
})();
