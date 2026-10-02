// Run Base — carga de treino estimada (RPE × minutos) e razão aguda:crônica (sinal de risco de lesão)
(function () {
  var L = RB.trainLoad = {};
  var DAY = 864e5;
  var day0 = function (f) { return new Date((f.performed_at || f.created_at.slice(0, 10)) + 'T12:00:00'); };
  var monday = function (d) { d = new Date(d.getFullYear(), d.getMonth(), d.getDate()); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d; };

  // carga de uma sessão: esforço (RPE) × duração em minutos (estimada quando o aluno não informou o tempo)
  L.session = function (f) {
    if (!f.rpe) return 0;
    var min = f.duration_sec ? f.duration_sec / 60 : f.distance_km ? f.distance_km * 6.5 : (f.kind === 'strength' ? 50 : 45);
    return f.rpe * Math.min(min, 300);
  };
  L.weekly = function (fbs, n) {
    n = n || 8;
    var cur = monday(new Date()), out = [];
    for (var i = n - 1; i >= 0; i--) { var s = new Date(cur); s.setDate(s.getDate() - 7 * i); out.push({ start: s, load: 0, n: 0 }); }
    fbs.forEach(function (f) {
      var m = monday(day0(f)).getTime();
      var w = out.find(function (x) { return Math.abs(x.start.getTime() - m) < 3 * 3600e3; });
      if (w) { w.load += L.session(f); w.n++; }
    });
    return out;
  };
  // razão aguda (últimos 7 dias) ÷ crônica (média semanal dos últimos 28 dias)
  L.acwr = function (fbs) {
    var now = Date.now(), acute = 0, chronic = 0, weeks = {};
    fbs.forEach(function (f) {
      var t = now - day0(f).getTime(), l = L.session(f);
      if (t < 0 || t > 28 * DAY) return;
      chronic += l; weeks[Math.floor(t / (7 * DAY))] = 1;
      if (t <= 7 * DAY) acute += l;
    });
    var avg = chronic / 4;
    if (!avg || Object.keys(weeks).length < 3) return null;
    var r = acute / avg;
    var z = r > 1.5 ? ['risco', 'Risco alto', 'r'] : r > 1.3 ? ['atencao', 'Atenção', 'd'] : r < 0.8 ? ['queda', 'Carga em queda', 'b'] : ['ideal', 'Faixa ideal', 'g'];
    return { r: r, acute: acute, chronic: avg, k: z[0], l: z[1], c: z[2] };
  };
  // cartão do coach (aba Feedbacks do aluno)
  L.card = function (fbs) {
    var wk = L.weekly(fbs, 8), max = Math.max.apply(null, wk.map(function (w) { return w.load; }).concat([1]));
    var a = L.acwr(fbs);
    var W = 340, H = 120, bw = (W - 20) / wk.length;
    var bars = wk.map(function (w, i) {
      var h = Math.round((H - 26) * w.load / max), x = 10 + i * bw, last = i === wk.length - 1;
      return '<rect x="' + (x + 4) + '" y="' + (H - 18 - h) + '" width="' + (bw - 8) + '" height="' + Math.max(h, w.load ? 2 : 0) + '" fill="' + (last ? 'var(--red)' : 'var(--blue)') + '" opacity="' + (last ? 1 : .55) + '"/>' +
        '<text x="' + (x + bw / 2) + '" y="' + (H - 4) + '" class="ch-ax" text-anchor="middle">' + w.start.getDate() + '/' + (w.start.getMonth() + 1) + '</text>';
    }).join('');
    return '<div class="card">' + RB.ew('Carga de treino (estimada)', 'mid') +
      (a ? '<div class="ld-top"><div class="ld-r ' + a.k + '">' + a.r.toFixed(2).replace('.', ',') + '</div><div><b>' + a.l + '</b><div class="muted-s">Carga dos últimos 7 dias ÷ média semanal do último mês. Acima de 1,5 = aumento rápido, mais risco de lesão.</div></div></div>'
        : '<div class="muted-s" style="margin-bottom:8px">Precisa de pelo menos 3 semanas de feedback para calcular o risco.</div>') +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" class="ld-svg" role="img" aria-label="Carga semanal">' + bars + '</svg>' +
      '<div class="hint">Carga = esforço (RPE) × minutos de treino. Sem tempo informado, o app estima pela distância.</div></div>';
  };
})();
