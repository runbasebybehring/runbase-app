// Run Base — galera: sequência de semanas, selos e mural da comunidade (+ eventos)
(function () {
  var sb = RB.sb;
  var G = RB.galera = { view: null };
  var esc = function (s) { return RB.esc(s); };
  var DAY = 864e5;
  var monday = function (d) { d = new Date(d.getFullYear(), d.getMonth(), d.getDate()); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d; };
  var fday = function (f) { return new Date((f.performed_at || f.created_at.slice(0, 10)) + 'T12:00:00'); };

  // semanas (seg–dom) com pelo menos um treino registrado
  G.stats = function (fbs) {
    var weeks = {}, months = {}, maxKm = 0, strength = 0;
    fbs.forEach(function (f) {
      var d = fday(f); weeks[monday(d).getTime()] = 1;
      var mk = d.getFullYear() + '-' + d.getMonth();
      months[mk] = (months[mk] || 0) + (+f.distance_km || 0);
      if (+f.distance_km > maxKm) maxKm = +f.distance_km;
      if (f.kind === 'strength') strength++;
    });
    var ws = Object.keys(weeks).map(Number).sort(function (a, b) { return b - a; });
    var cur = monday(new Date()).getTime(), streak = 0;
    var start = weeks[cur] ? cur : (weeks[cur - 7 * DAY] ? cur - 7 * DAY : null);
    if (start != null) { for (var t = start; weeks[t] || weeks[t + 3600e3] || weeks[t - 3600e3]; t -= 7 * DAY) streak++; }
    // maior sequência já feita (tolerância de 1h por causa do horário de verão)
    var best = 0, run = 0, prev = null;
    ws.slice().reverse().forEach(function (w) { run = prev != null && Math.abs(w - prev - 7 * DAY) <= 3600e3 * 2 ? run + 1 : 1; prev = w; if (run > best) best = run; });
    var bestMonth = 0; Object.keys(months).forEach(function (k) { if (months[k] > bestMonth) bestMonth = months[k]; });
    return { total: fbs.length, streak: streak, best: Math.max(best, streak), maxKm: maxKm, bestMonth: bestMonth, strength: strength };
  };
  var BADGES = [
    ['first', '👟', 'Primeiro treino', 'Registrou o primeiro treino', function (s) { return s.total >= 1; }],
    ['s4', '🔥', '4 semanas seguidas', 'Um mês inteiro sem falhar', function (s) { return s.best >= 4; }],
    ['s8', '🔥', '8 semanas seguidas', 'Dois meses de constância', function (s) { return s.best >= 8; }],
    ['s12', '🏆', '12 semanas seguidas', 'Um ciclo inteiro', function (s) { return s.best >= 12; }],
    ['t25', '✦', '25 treinos', '25 treinos registrados', function (s) { return s.total >= 25; }],
    ['t100', '✦', '100 treinos', '100 treinos registrados', function (s) { return s.total >= 100; }],
    ['k10', '◎', 'Primeiro 10K', 'Um treino de 10 km ou mais', function (s) { return s.maxKm >= 10; }],
    ['k21', '◎', 'Primeiro 21K', 'Uma meia maratona', function (s) { return s.maxKm >= 21; }],
    ['k42', '★', 'Maratonista', '42 km num treino ou prova', function (s) { return s.maxKm >= 42; }],
    ['m100', '▲', '100 km no mês', '100 km somados num mês', function (s) { return s.bestMonth >= 100; }],
    ['f10', '◆', 'Base forte', '10 treinos de força registrados', function (s) { return s.strength >= 10; }]
  ];
  G.badges = function (s) { return BADGES.map(function (b) { return { id: b[0], icon: b[1], t: b[2], d: b[3], on: b[4](s) }; }); };

  // cartão da home do aluno
  G.homeCard = function (fbs) {
    var s = G.stats(fbs), got = G.badges(s).filter(function (b) { return b.on; });
    if (!s.total) return '';
    return '<div class="card gal-mini" onclick="RB.galera.view=\'selos\';RB.athlete.go(\'eventos\')">' + RB.ew('Constância', 'blue') +
      '<div class="gal-row"><div class="gal-n">' + s.streak + '<span>' + (s.streak === 1 ? 'semana seguida' : 'semanas seguidas') + '</span></div>' +
      '<div class="gal-b">' + got.slice(-4).map(function (b) { return '<span title="' + esc(b.t) + '">' + b.icon + '</span>'; }).join('') + '<i>' + got.length + ' selo' + (got.length === 1 ? '' : 's') + '</i></div></div>' +
      '<div class="cm-a">Ver mural da galera ›</div></div>';
  };

  G.dago = function (iso) {
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var d = Math.round((t - new Date(iso + 'T00:00:00')) / DAY);
    return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : d + ' dias';
  };
  // aba Galera (aluno) — Mural · Eventos · Selos
  G.render = async function (el) {
    if (!G.view) G.view = RB.events.pendingCount() ? 'eventos' : 'mural';
    el.innerHTML = RB.tt('GALERA') + RB.seg([['mural', 'Mural'], ['eventos', 'Eventos' + (RB.events.pendingCount() ? ' •' : '')], ['selos', 'Selos']], G.view, 'RB.galera.go') + '<div id="galera-body"></div>';
    var body = RB.$('galera-body');
    if (G.view === 'eventos') return RB.events.render(body, { noTitle: true });
    if (G.view === 'selos') return selos(body);
    return mural(body);
  };
  G.go = function (v) { G.view = v; G.render(RB.$('athlete-content')); };

  function selos(el) {
    var A = RB.athlete, s = G.stats(A.feedbacks), bs = G.badges(s);
    el.innerHTML = '<div class="card">' + RB.statGrid([{ v: String(s.streak), l: 'Semanas seguidas', a: true }, { v: String(s.best), l: 'Melhor sequência' }, { v: String(s.total), l: 'Treinos' }]) + '</div>' +
      '<div class="badges">' + bs.map(function (b) {
        return '<div class="bdg' + (b.on ? ' on' : '') + '"><div class="bdg-i">' + b.icon + '</div><div class="bdg-t">' + esc(b.t) + '</div><div class="bdg-d">' + esc(b.d) + '</div></div>';
      }).join('') + '</div><div class="hint" style="text-align:center;margin-top:10px">Sequência = semanas (seg a dom) com pelo menos um treino registrado no app.</div>';
  }

  async function mural(el) {
    el.innerHTML = '<div class="ld"><div class="sp"></div></div>';
    var r = await Promise.all([sb.rpc('community_board'), sb.rpc('community_feed')]);
    var board = (r[0].data || []).filter(function (x) { return x.streak > 0 || +x.month_km > 0; }).slice(0, 10);
    var feed = r[1].data || [];
    var me = RB.athlete.me;
    var html = me && me.mural === false ? '<div class="card"><div class="p">Você está fora do mural. Para aparecer, toque nas suas iniciais no topo e ative "Aparecer no mural".</div></div>' : '';
    html += '<div class="card">' + RB.ew('🔥 Constância da galera', 'blue') + (board.length ? board.map(function (x, i) {
      return '<div class="lb-r' + (x.is_me ? ' me' : '') + '"><span class="lb-p">' + (i + 1) + '</span>' + RB.av(x.img, 28) + '<span class="lb-n">' + esc(x.first_name) + (x.is_me ? ' (você)' : '') + '</span>' +
        '<span class="lb-s">' + x.streak + ' sem</span><span class="lb-k">' + (+x.month_km ? RB.pace.fmtKm(+x.month_km) + ' km no mês' : '') + '</span></div>';
    }).join('') : '<div class="muted-s">Ninguém registrou treino nas últimas semanas ainda.</div>') + '</div>';
    html += RB.ew('Treinos recentes') + (feed.length ? feed.map(function (f) {
      var met = f.distance_km ? RB.pace.fmtKm(+f.distance_km) + ' km' + (f.duration_sec ? ' · ' + RB.pace.fmtHMS(f.duration_sec) + ' · ' + RB.pace.fmtPace(f.duration_sec / f.distance_km) + '/km' : '') : '';
      return '<div class="feed-r' + (f.is_me ? ' me' : '') + '">' + RB.av(f.img, 34) + '<div class="feed-t"><div><b>' + esc(f.first_name) + '</b> · ' + esc(f.kind === 'strength' ? 'treino de força' : String(f.label || 'corrida').toLowerCase()) + '</div>' +
        (met ? '<div class="feed-m">' + met + '</div>' : '') + '</div><div class="feed-d">' + G.dago(f.performed_at) + '</div></div>';
    }).join('') : RB.empty('Nenhum treino nas últimas 3 semanas.'));
    el.innerHTML = html;
  }
})();
