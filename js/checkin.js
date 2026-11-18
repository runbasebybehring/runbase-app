// Run Base — check-in de segunda em cartões (estilo "um cartão por pergunta"): sono, cabeça (estresse), dores, recado.
// Grava na mesma tabela `checkins` (sono 1–5, estresse 1–5, dor, dor_onde, note) — radar, resumo da treinadora e IA da semana seguem iguais.
(function () {
  var sb = RB.sb;
  var K = RB.checkin = { cur: null, f: {}, i: 0 };
  var esc = function (s) { return RB.esc(s); };
  var SONO = ['Péssimo', 'Ruim', 'Ok', 'Bom', 'Ótimo'], EST = ['Baixo', 'Leve', 'Médio', 'Alto', 'Muito alto'];
  var COL = ['#B71C1C', '#E65100', '#F9A825', '#558B2F', '#2E7D32'];
  var CEU = [['☀️', 'Tranquila'], ['🌤️', 'Leve'], ['⛅', 'Nublada'], ['🌧️', 'Pesada'], ['⛈️', 'Tempestade']];
  var PARTES = ['Pé', 'Tornozelo', 'Canela', 'Panturrilha', 'Joelho', 'Coxa', 'Posterior', 'Quadril', 'Glúteo', 'Lombar', 'Costas', 'Ombro'];
  var LADOS = ['Esquerdo', 'Direito', 'Os dois'];
  K.weekStart = function () { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.toISOString().slice(0, 10); };

  K.load = async function (athleteId) {
    var r = await sb.from('checkins').select('*').eq('athlete_id', athleteId).eq('week_start', K.weekStart()).maybeSingle();
    K.cur = r.data || null; K.f = {};
  };

  // ---------- ilustrações (SVG simples, cores da marca) ----------
  var W = 'rgba(255,255,255,', face = function (x, y, closed) {
    return closed
      ? '<path d="M' + (x - 14) + ' ' + y + 'q6 6 12 0M' + (x + 4) + ' ' + y + 'q6 6 12 0" stroke="#1A1A1A" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M' + (x - 4) + ' ' + (y + 12) + 'q5 4 10 0" stroke="#1A1A1A" stroke-width="3" fill="none" stroke-linecap="round"/>'
      : '<circle cx="' + (x - 9) + '" cy="' + y + '" r="4" fill="#1A1A1A"/><circle cx="' + (x + 11) + '" cy="' + y + '" r="4" fill="#1A1A1A"/><path d="M' + (x - 6) + ' ' + (y + 11) + 'q7 7 14 0" stroke="#1A1A1A" stroke-width="3" fill="none" stroke-linecap="round"/>';
  };
  var ART = {
    sono: '<svg viewBox="0 0 240 170" aria-hidden="true">' +
      '<g fill="' + W + '.85)"><path d="M30 40l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/><path d="M200 26l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/><circle cx="60" cy="18" r="3"/><circle cx="214" cy="80" r="3"/><circle cx="24" cy="110" r="2.5"/></g>' +
      '<path d="M150 22a52 52 0 1 0 50 70a42 42 0 1 1 -50 -70z" fill="#FFD54F"/>' +
      '<rect x="62" y="100" width="116" height="52" rx="26" fill="#fff"/><circle cx="90" cy="98" r="24" fill="#fff"/><circle cx="130" cy="88" r="30" fill="#fff"/><circle cx="160" cy="102" r="20" fill="#fff"/>' +
      face(124, 112, true) +
      '<text x="176" y="72" font-family="Barlow Condensed" font-weight="900" font-style="italic" font-size="22" fill="#fff">z</text><text x="190" y="56" font-family="Barlow Condensed" font-weight="900" font-style="italic" font-size="16" fill="' + W + '.8)">z</text></svg>',
    cabeca: '<svg viewBox="0 0 240 170" aria-hidden="true">' +
      '<g stroke="#FFE082" stroke-width="7" stroke-linecap="round">' + [0, 45, 90, 135, 180, 225, 270, 315].map(function (a) { var r = a * Math.PI / 180; return '<line x1="' + (100 + Math.cos(r) * 50) + '" y1="' + (80 + Math.sin(r) * 50) + '" x2="' + (100 + Math.cos(r) * 64) + '" y2="' + (80 + Math.sin(r) * 64) + '"/>'; }).join('') + '</g>' +
      '<circle cx="100" cy="80" r="40" fill="#FFD54F"/>' + face(100, 76) + '<circle cx="80" cy="90" r="5" fill="#FF8A65" opacity=".7"/><circle cx="122" cy="90" r="5" fill="#FF8A65" opacity=".7"/>' +
      '<g fill="#fff"><rect x="120" y="112" width="98" height="38" rx="19"/><circle cx="150" cy="110" r="20"/><circle cx="182" cy="104" r="24"/></g></svg>',
    dor: '<svg viewBox="0 0 240 170" aria-hidden="true">' +
      '<g transform="rotate(-28 120 85)"><rect x="40" y="58" width="160" height="56" rx="28" fill="#FFE0CC"/><rect x="92" y="58" width="56" height="56" fill="#F5C6A5"/>' +
      '<g fill="#E0A884"><circle cx="104" cy="70" r="3"/><circle cx="120" cy="70" r="3"/><circle cx="136" cy="70" r="3"/><circle cx="104" cy="102" r="3"/><circle cx="120" cy="102" r="3"/><circle cx="136" cy="102" r="3"/></g></g>' +
      '<g transform="rotate(-28 120 85)">' + face(120, 82) + '</g>' +
      '<g fill="' + W + '.9)"><path d="M28 30l4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/><path d="M206 120l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/></g></svg>',
    onde: '<svg viewBox="0 0 240 170" aria-hidden="true">' +
      '<g fill="#fff"><circle cx="120" cy="26" r="15"/><rect x="104" y="44" width="32" height="56" rx="14"/><rect x="82" y="46" width="14" height="50" rx="7" transform="rotate(12 89 46)"/><rect x="144" y="46" width="14" height="50" rx="7" transform="rotate(-12 151 46)"/><rect x="105" y="94" width="13" height="66" rx="6.5"/><rect x="122" y="94" width="13" height="66" rx="6.5"/></g>' +
      '<g fill="none" stroke="#FFD54F" stroke-width="4"><circle cx="128" cy="128" r="11"/><circle cx="128" cy="128" r="19" opacity=".5"/></g><circle cx="128" cy="128" r="4" fill="#FFD54F"/></svg>',
    recado: '<svg viewBox="0 0 240 170" aria-hidden="true">' +
      '<path d="M52 30h136a20 20 0 0 1 20 20v52a20 20 0 0 1-20 20h-80l-30 26v-26h-26a20 20 0 0 1-20-20v-52a20 20 0 0 1 20-20z" fill="#fff"/>' +
      '<g fill="#2E7D32"><circle cx="92" cy="76" r="8"/><circle cx="120" cy="76" r="8"/><circle cx="148" cy="76" r="8"/></g>' +
      '<path d="M196 18c-6-8-20-4-16 8 2 6 16 14 16 14s14-8 16-14c4-12-10-16-16-8z" fill="#FF8A80"/></svg>',
    fim: '<svg viewBox="0 0 240 170" aria-hidden="true">' +
      '<path d="M98 8h18l12 52h-18z" fill="#2B4EAA"/><path d="M142 8h-18l-12 52h18z" fill="#C41731"/>' +
      '<circle cx="120" cy="100" r="46" fill="#FFD54F"/><circle cx="120" cy="100" r="34" fill="#FFC107"/>' + face(120, 96) +
      '<g><rect x="34" y="40" width="8" height="8" fill="#FFD54F" transform="rotate(20 38 44)"/><rect x="196" y="56" width="8" height="8" fill="#fff" transform="rotate(-20 200 60)"/><circle cx="52" cy="128" r="4" fill="#fff"/><circle cx="196" cy="128" r="4" fill="#FFD54F"/><rect x="186" y="20" width="6" height="12" fill="#fff" transform="rotate(30 189 26)"/></g></svg>'
  };

  // ---------- cartões ----------
  function steps() {
    var s = ['sono', 'cabeca', 'dor'];
    if (K.f.dor) s.push('onde');
    s.push('recado', 'fim');
    return s;
  }
  var CARD = {
    sono: { c: '#2B4EAA', pill: 'Sono', q: 'Como você tem dormido esta semana?' },
    cabeca: { c: '#E8772E', pill: 'Cabeça', q: 'Que tempo está fazendo aí dentro?' },
    dor: { c: '#C41731', pill: 'Corpo', q: 'Sentiu alguma dor ou incômodo?' },
    onde: { c: '#8E1427', pill: 'Corpo', q: 'Onde está incomodando?' },
    recado: { c: '#2E7D32', pill: 'Recado', q: 'Quer contar algo pra treinadora?' },
    fim: { c: '#1A1A1A', pill: 'Pronto', q: 'Check-in completo!' }
  };
  function cardHtml(k, cls) {
    var C = CARD[k];
    return '<div class="ckx-card ' + (cls || '') + '" style="--cc:' + C.c + '"><span class="ckx-pill">' + C.pill + '</span>' +
      '<div class="ckx-art">' + ART[k] + '</div><div class="ckx-q">' + C.q + '</div></div>';
  }
  function bat(n) {
    var s = ''; for (var j = 0; j < 5; j++) s += '<i' + (j < n ? ' style="background:' + COL[n - 1] + '"' : '') + '></i>';
    return '<span class="ckx-bat">' + s + '</span>';
  }
  function answers(k) {
    var f = K.f;
    if (k === 'sono') return '<div class="ckx-sc">' + SONO.map(function (l, j) {
      return '<button class="ckx-o' + (f.sono === j + 1 ? ' on' : '') + '" onclick="RB.checkin.pick(\'sono\',' + (j + 1) + ')">' + bat(j + 1) + '<span>' + l + '</span></button>';
    }).join('') + '</div>';
    if (k === 'cabeca') return '<div class="ckx-sc">' + CEU.map(function (c, j) {
      return '<button class="ckx-o' + (f.estresse === j + 1 ? ' on' : '') + '" onclick="RB.checkin.pick(\'estresse\',' + (j + 1) + ')"><b class="ckx-em">' + c[0] + '</b><span>' + c[1] + '</span></button>';
    }).join('') + '</div><div class="ckx-hint">☀️ tranquila · ⛈️ estresse lá em cima</div>';
    if (k === 'dor') return '<div class="ckx-yn"><button class="ckx-b' + (f.dor === false ? ' on' : '') + '" onclick="RB.checkin.pick(\'dor\',false)">✕&nbsp; Não</button><button class="ckx-b' + (f.dor === true ? ' on' : '') + '" onclick="RB.checkin.pick(\'dor\',true)">✓&nbsp; Sim</button></div>';
    if (k === 'onde') {
      var p = f.partes || [];
      return '<div class="ckx-chips">' + PARTES.map(function (n) { return '<button class="ckx-ch' + (p.indexOf(n) >= 0 ? ' on' : '') + '" onclick="RB.checkin.part(\'' + n + '\')">' + n + '</button>'; }).join('') + '</div>' +
        '<div class="ckx-lado">' + LADOS.map(function (n) { return '<button class="ckx-ch sm' + (f.lado === n ? ' on' : '') + '" onclick="RB.checkin.side(\'' + n + '\')">' + n + '</button>'; }).join('') + '</div>' +
        '<input class="ckx-in" placeholder="Outro lugar ou detalhe (opcional)" value="' + esc(f.outro || '') + '" oninput="RB.checkin.f.outro=this.value">' +
        '<button class="ckx-go" onclick="RB.checkin.next()">CONTINUAR</button>';
    }
    if (k === 'recado') return '<textarea class="ckx-in ta" placeholder="Semana corrida, viagem, prova chegando… (opcional)" oninput="RB.checkin.f.note=this.value">' + esc(f.note || '') + '</textarea>' +
      '<div class="ckx-yn"><button class="ckx-b" onclick="RB.checkin.f.note=\'\';RB.checkin.next()">Pular</button><button class="ckx-b dk" onclick="RB.checkin.next()">Continuar ›</button></div>';
    if (k === 'fim') return '<div class="ckx-sum">' + resumo(f) + '</div><button class="ckx-go" id="ckx-send" onclick="RB.checkin.send()">ENVIAR PRA TREINADORA</button>';
    return '';
  }
  function ondeTxt(f) {
    var p = (f.partes || []).map(function (s) { return s.toLowerCase(); });
    var t = p.join(', ') + (p.length && f.lado ? ' (' + (f.lado === 'Os dois' ? 'os dois lados' : f.lado.toLowerCase()) + ')' : '');
    var o = (f.outro || '').trim();
    return [t, o].filter(Boolean).join(' · ');
  }
  function resumo(f) {
    return '<div><span>Sono</span>' + bat(f.sono) + '<b>' + SONO[f.sono - 1] + '</b></div>' +
      '<div><span>Cabeça</span><b class="ckx-em sm">' + CEU[f.estresse - 1][0] + '</b><b>' + CEU[f.estresse - 1][1] + '</b></div>' +
      '<div><span>Corpo</span><b>' + (f.dor ? '🩹 ' + esc(ondeTxt(f) || 'com dor') : '💪 Sem dor') + '</b></div>' +
      ((f.note || '').trim() ? '<div><span>Recado</span><b class="nt">“' + esc(f.note.trim()) + '”</b></div>' : '');
  }

  // ---------- tela ----------
  function render(enter) {
    var S = steps(), k = S[K.i], nx = S[K.i + 1];
    var el = RB.$('ckx'); if (!el) return;
    el.style.setProperty('--bg', CARD[k].c);
    el.innerHTML = '<div class="ckx-top">' + (K.i > 0 ? '<button class="ckx-x" onclick="RB.checkin.back()" aria-label="Voltar">‹</button>' : '<span></span>') +
      '<div class="ckx-dots">' + S.map(function (_, j) { return '<i class="' + (j < K.i ? 'd' : j === K.i ? 'c' : '') + '"></i>'; }).join('') + '</div>' +
      '<button class="ckx-x" onclick="RB.checkin.close()" aria-label="Fechar">✕</button></div>' +
      '<div class="ckx-deck">' + (nx ? cardHtml(nx, 'behind') : '') + cardHtml(k, 'top ' + (enter || '')) + '</div>' +
      '<div class="ckx-ans">' + answers(k) + '</div>';
  }
  K.open = function () {
    if (K.cur) return;
    K.i = 0;
    var el = document.createElement('div'); el.id = 'ckx'; el.className = 'ckx'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Check-in da semana');
    document.body.appendChild(el); document.body.classList.add('ckx-open');
    render('pop');
  };
  K.close = function () {
    var el = RB.$('ckx'); if (el) el.remove();
    document.body.classList.remove('ckx-open');
    var c = RB.$('ck-card'); if (c) c.outerHTML = K.homeCard();
  };
  function fly(dir) {
    var t = document.querySelector('#ckx .ckx-card.top');
    if (t) t.classList.add(dir || 'out');
    setTimeout(function () { K.i++; render('promote'); }, 300);
  }
  K.pick = function (k, v) {
    K.f[k] = v;
    if (k === 'dor' && !v) { K.f.partes = []; K.f.lado = null; K.f.outro = ''; }
    document.querySelectorAll('#ckx .ckx-o, #ckx .ckx-b').forEach(function (b) { b.disabled = true; });
    var btn = event && event.currentTarget; if (btn) btn.classList.add('on');
    if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) {}
    setTimeout(function () { fly(k === 'dor' && !v ? 'out-l' : 'out'); }, 180);
  };
  K.part = function (n) {
    var p = K.f.partes = K.f.partes || [], j = p.indexOf(n);
    if (j >= 0) p.splice(j, 1); else p.push(n);
    document.querySelectorAll('#ckx .ckx-chips .ckx-ch').forEach(function (b) { b.classList.toggle('on', p.indexOf(b.textContent) >= 0); });
  };
  K.side = function (n) {
    K.f.lado = K.f.lado === n ? null : n;
    document.querySelectorAll('#ckx .ckx-lado .ckx-ch').forEach(function (b) { b.classList.toggle('on', b.textContent === K.f.lado); });
  };
  K.next = function () {
    if (steps()[K.i] === 'onde' && !ondeTxt(K.f)) { RB.toast('Marque onde está doendo', false); return; }
    fly('out');
  };
  K.back = function () { if (K.i > 0) { K.i--; render('back'); } };

  K.send = async function () {
    var f = K.f;
    if (!f.sono || !f.estresse || f.dor == null) { RB.toast('Faltou responder algum cartão', false); return; }
    var b = RB.$('ckx-send'); if (b) { b.disabled = true; b.textContent = 'ENVIANDO…'; }
    var row = { athlete_id: RB.state.user.id, week_start: K.weekStart(), sono: f.sono, estresse: f.estresse, dor: f.dor, dor_onde: f.dor ? ondeTxt(f) || null : null, note: (f.note || '').trim() || null };
    var r = await sb.from('checkins').insert(row).select().single();
    if (r.error) { RB.toast('Não deu para enviar. Tente de novo.', false); if (b) { b.disabled = false; b.textContent = 'ENVIAR PRA TREINADORA'; } return; }
    K.cur = r.data;
    if (RB.push && RB.push.notify) RB.push.notify({ type: 'checkin', checkin_id: r.data.id });
    var el = RB.$('ckx'); if (!el) return;
    var msg = f.dor ? 'A treinadora vai ver o aviso de dor e ajustar o que for preciso.'
      : (f.sono <= 2 || f.estresse >= 4) ? 'Semana puxada, né? A treinadora vai levar isso em conta nos treinos.'
      : 'Corpo e cabeça em dia. Bora pra semana!';
    el.style.setProperty('--bg', '#1A1A1A');
    el.innerHTML = '<div class="ckx-top"><span></span><span></span><button class="ckx-x" onclick="RB.checkin.close()" aria-label="Fechar">✕</button></div>' +
      '<div class="ckx-deck"><div class="ckx-card top pop" style="--cc:#C41731"><span class="ckx-pill">Enviado</span><div class="ckx-art">' + ART.fim + '</div><div class="ckx-q">Valeu! ✓</div><div class="ckx-sub">' + msg + '</div></div></div>' +
      '<div class="ckx-ans"><button class="ckx-go" onclick="RB.checkin.close()">VOLTAR PRO APP</button></div>' + confetti();
    if (navigator.vibrate) try { navigator.vibrate([20, 40, 20]); } catch (e) {}
  };
  function confetti() {
    var c = ['#C41731', '#2B4EAA', '#FFD54F', '#fff', '#2E7D32'], s = '';
    for (var j = 0; j < 36; j++) s += '<i style="left:' + (Math.random() * 100) + '%;background:' + c[j % 5] + ';animation-delay:' + (Math.random() * .5).toFixed(2) + 's;animation-duration:' + (1.6 + Math.random() * 1.4).toFixed(2) + 's;transform:rotate(' + (Math.random() * 360 | 0) + 'deg)"></i>';
    return '<div class="ckx-conf" aria-hidden="true">' + s + '</div>';
  }

  // ---------- cartão na home do aluno (segunda a quinta, até responder) ----------
  K.homeCard = function () {
    var dow = (new Date().getDay() + 6) % 7, c = K.cur;
    if (c) return dow <= 1 ? '<div class="card gl ck-done" id="ck-card">' + RB.ew('Check-in da semana', 'green') +
      '<div class="ck-mini">' + bat(c.sono) + '<b class="ckx-em sm">' + CEU[c.estresse - 1][0] + '</b><span>' + (c.dor ? '🩹' : '💪') + '</span></div>' +
      '<div class="p">Feito ✓ A treinadora já recebeu.</div></div>' : '';
    if (dow > 3) return '';
    return '<button class="ck-teaser" id="ck-card" onclick="RB.checkin.open()">' +
      '<span class="ck-stack"><i style="background:#2E7D32"></i><i style="background:#E8772E"></i><i style="background:#2B4EAA">🌙</i></span>' +
      '<span class="ck-tx"><span class="ew blue" style="margin:0">Check-in da semana</span><b>Como você chega nessa semana?</b><small>3 cartões · 30 segundos</small></span>' +
      '<span class="ck-go">›</span></button>';
  };

  // ---------- treinadora: linha do último check-in do aluno ----------
  K.line = function (c) {
    if (!c) return '';
    return '<div class="card ck-line">' + RB.ew('Check-in · semana de ' + RB.fmtDate(c.week_start + 'T12:00:00'), 'blue') +
      '<div class="tags">' + RB.tag('sono ' + SONO[c.sono - 1].toLowerCase(), c.sono <= 2 ? 'r' : c.sono >= 4 ? 'g' : 'm') + ' ' +
      RB.tag('estresse ' + EST[c.estresse - 1].toLowerCase(), c.estresse >= 4 ? 'r' : c.estresse <= 2 ? 'g' : 'm') + ' ' +
      RB.tag(c.dor ? 'dor' + (c.dor_onde ? ': ' + c.dor_onde : '') : 'sem dor', c.dor ? 'r' : 'g') + '</div>' +
      (c.note ? '<div class="fbc-c">“' + esc(c.note) + '”</div>' : '') + '</div>';
  };
})();
