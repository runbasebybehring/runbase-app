// Run Base — gráficos leves em SVG (sem bibliotecas)
(function () {
  var uid = 0;

  // Linha de RPE ao longo dos treinos. points: [{d: Date|string, v: number, label: string}]
  RB.lineChart = function (points, opts) {
    opts = opts || {};
    if (!points.length) return RB.empty('Sem dados ainda');
    var id = 'lc' + (++uid);
    var W = 340, H = opts.h || 150, pl = 26, pr = 10, pt = 14, pb = 22;
    var max = opts.max || 10, min = opts.min || 0;
    var n = points.length;
    var x = function (i) { return n === 1 ? (pl + (W - pl - pr) / 2) : pl + i * (W - pl - pr) / (n - 1); };
    var y = function (v) { return pt + (H - pt - pb) * (1 - (v - min) / (max - min)); };
    var grid = '';
    (opts.ticks || [0, 5, 10]).forEach(function (t) {
      grid += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(t) + '" y2="' + y(t) + '" class="ch-grid"/>' +
        '<text x="' + (pl - 6) + '" y="' + (y(t) + 3) + '" class="ch-ax" text-anchor="end">' + t + '</text>';
    });
    if (opts.band) {
      grid += '<rect x="' + pl + '" width="' + (W - pl - pr) + '" y="' + y(opts.band[1]) + '" height="' + (y(opts.band[0]) - y(opts.band[1])) + '" class="ch-band"/>';
    }
    var path = points.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1); }).join(' ');
    var dots = points.map(function (p, i) {
      return '<g class="ch-hit" data-i="' + i + '"><circle cx="' + x(i) + '" cy="' + y(p.v) + '" r="12" fill="transparent"/>' +
        '<circle cx="' + x(i) + '" cy="' + y(p.v) + '" r="4.5" fill="' + (p.color || 'var(--red)') + '" stroke="var(--white)" stroke-width="2"/></g>';
    }).join('');
    var first = RB.fmtDate(points[0].d), last = RB.fmtDate(points[n - 1].d);
    var labels = '<text x="' + pl + '" y="' + (H - 6) + '" class="ch-ax">' + first + '</text>' +
      (n > 1 ? '<text x="' + (W - pr) + '" y="' + (H - 6) + '" class="ch-ax" text-anchor="end">' + last + '</text>' : '');
    setTimeout(function () {
      var root = document.getElementById(id); if (!root) return;
      var tip = root.querySelector('.ch-tip');
      root.querySelectorAll('.ch-hit').forEach(function (g) {
        var show = function () {
          var p = points[+g.dataset.i];
          tip.innerHTML = '<strong>' + RB.esc(p.v) + '</strong> · ' + RB.fmtDate(p.d) + (p.label ? ' · ' + RB.esc(p.label) : '');
          tip.style.opacity = 1;
        };
        g.addEventListener('mouseenter', show); g.addEventListener('click', show);
      });
      root.addEventListener('mouseleave', function () { tip.style.opacity = 0; });
    }, 0);
    return '<div class="chart" id="' + id + '"><div class="ch-tip"></div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + RB.esc(opts.aria || 'gráfico') + '">' +
      grid + '<path d="' + path + '" class="ch-line"/>' + dots + labels + '</svg></div>';
  };

  // Distribuição em barras horizontais. rows: [{l, n, c}]
  RB.barList = function (rows) {
    var tot = rows.reduce(function (a, r) { return a + r.n; }, 0);
    if (!tot) return '<div class="muted-s">Sem registros</div>';
    return rows.map(function (r) {
      var pct = Math.round(r.n / tot * 100);
      return '<div class="bl-row"><div class="bl-l">' + RB.esc(r.l) + '</div><div class="bl-track"><div class="bl-fill" style="width:' + pct + '%;background:' + r.c + '"></div></div><div class="bl-v">' + r.n + '</div></div>';
    }).join('');
  };

  // Barra de progresso animada
  RB.progress = function (items) {
    setTimeout(function () { document.querySelectorAll('.rpf[data-w]').forEach(function (b) { b.style.width = b.dataset.w + '%'; }); }, 80);
    return items.map(function (p) {
      return '<div class="rpi"><div class="rph"><span class="rpl">' + RB.esc(p.l) + '</span><span class="rpv">' + RB.esc(p.v) + '</span></div>' +
        '<div class="rpb"><div class="rpf" style="width:0%;background:' + RB.esc(p.c || 'var(--red)') + '" data-w="' + (+p.w || 0) + '"></div></div></div>';
    }).join('');
  };
})();
