// Run Base — destaques em formato de stories (aro na home que abre uma sequência de telas)
(function () {
  var sb = RB.sb;
  var ST = RB.stories = { list: [], cur: null, i: 0 };

  var COLORS = { blue: 'var(--blue)', green: '#2E7D32', red: '#C41731', orange: '#E65100', purple: '#7B1FA2', ink: '#14161C', cream: '#F4EFE8' };
  function col(c) { return COLORS[c] || c || COLORS.ink; }
  function key(h) { return 'story:' + h.id + ':' + Math.floor(new Date(h.updated_at).getTime() / 1000); }
  function seen(h) { return !!(RB.ms && RB.ms.acked[key(h)]); }

  ST.load = async function (uid) {
    try {
      var r = await sb.from('story_highlights').select('*').eq('athlete_id', uid).eq('published', true).order('position');
      ST.list = r.data || [];
    } catch (e) { ST.list = []; }
  };

  // ---------- fileira de destaques na home ----------
  ST.row = function () {
    if (!ST.list.length) return '';
    return '<div class="st-row">' + ST.list.map(function (h, k) {
      var cover = RB.esc(h.cover || h.title).replace(/\n/g, '<br>');
      return '<button class="st-hl' + (seen(h) ? ' seen' : '') + '" onclick="RB.stories.open(' + k + ')" aria-label="Abrir ' + RB.esc(h.title) + '">' +
        '<span class="st-ring"><span class="st-cv">' + cover + '</span></span><span class="st-tt">' + RB.esc(h.title) + '</span></button>';
    }).join('') + '</div>';
  };

  // ---------- blocos de um slide ----------
  var B = {
    kick: function (b) { return '<div class="stv-kick">' + RB.esc(b.text) + '</div>'; },
    title: function (b) {
      var size = b.size || 'h2', cap = { huge: 150, h2: 54, h3: 28 }[size] || 54;
      var L = Math.max.apply(null, String(b.text || '').split(/\s+/).map(function (w) { return w.length; }).concat([1]));
      return '<h2 class="stv-d ' + size + '" style="font-size:min(' + cap + 'px,calc(145cqw / ' + L + '))">' + RB.md(b.text) + '</h2>';
    },
    text: function (b) { return '<p class="stv-p"' + (b.small ? ' style="font-size:13.5px"' : '') + '>' + RB.md(b.text) + '</p>'; },
    spacer: function () { return '<div class="stv-sp"></div>'; },
    foot: function (b) { return '<div class="stv-foot">' + RB.md(b.text) + '</div>'; },
    ghost: function (b) { return '<div class="stv-ghost" aria-hidden="true">' + RB.esc(b.text) + '</div>'; },
    pill: function (b) { return '<div class="stv-pill"><b>' + RB.esc(b.big) + '</b>' + RB.esc(b.text) + '</div>'; },
    flag: function (b) { return '<div class="stv-flag">' + RB.esc(b.text) + '</div>'; },
    cond: function (b) { return '<div class="stv-cond"><p>' + RB.md(b.text) + '</p></div>'; },
    goal: function (b) {
      return '<div class="stv-goal"><div><small>' + RB.esc(b.label) + '</small><div class="stv-d g">' + RB.esc(b.title) + '</div></div><div class="r"><b>' + RB.esc(b.pace) + '</b><span>' + RB.esc(b.unit || 'pace por km') + '</span></div></div>';
    },
    stat: function (b) { return '<div class="stv-stat"><div class="stv-d s">' + RB.esc(b.big) + '</div><b>' + RB.esc(b.title) + '</b><span>' + RB.esc(b.text) + '</span></div>'; },
    pillar: function (b) { return '<div class="stv-pil"><div class="stv-d pl">' + RB.esc(b.title) + '</div><p class="stv-p">' + RB.md(b.text) + '</p></div>'; },
    big: function (b) { return '<div class="stv-big"><div class="stv-d bg" style="white-space:nowrap;font-size:min(92px,calc(150cqw / ' + Math.max(3, String(b.value).length) + '))">' + RB.esc(b.value) + '</div><span>' + RB.md(b.text) + '</span></div>'; },
    rows: function (b) {
      return '<div class="stv-rows">' + b.items.map(function (r) { return '<div><b>' + RB.esc(r[0]) + '</b><p class="stv-p">' + RB.md(r[1]) + '</p></div>'; }).join('') + '</div>';
    },
    timeline: function (b) {
      return '<div><div class="stv-tl">' + b.phases.map(function (p) { return '<i style="flex:' + (+p.weeks || 1) + ';background:' + col(p.color) + '"></i>'; }).join('') + '</div>' +
        '<div class="stv-ticks">' + (b.ticks || []).map(function (t) { return '<span>' + RB.esc(t) + '</span>'; }).join('') + '</div></div>' +
        '<div class="stv-leg">' + b.phases.map(function (p) { return '<div><i style="background:' + col(p.color) + '"></i><b>' + RB.esc(p.name) + '</b><span>' + RB.esc(p.until) + '</span></div>'; }).join('') + '</div>';
    },
    path: function (b) {
      return '<div class="stv-path">' + b.items.map(function (n, k) {
        return '<div class="stv-node' + (k === b.items.length - 1 ? ' end' : '') + '"><div class="when">' + RB.esc(n.when) + '</div><div class="stv-d nd">' + RB.esc(n.title) + '</div>' + (n.text ? '<p class="stv-p">' + RB.md(n.text) + '</p>' : '') + '</div>';
      }).join('') + '</div>';
    },
    zones: function (b) {
      return '<div class="stv-zones">' + b.items.map(function (z) {
        return '<div class="stv-z' + (z.goal ? ' goalz' : '') + '"><i style="' + (z.goal ? '' : 'background:' + col(z.color)) + '">' + RB.esc(z.tag) + '</i><div><b>' + RB.esc(z.name) + '</b><span>' + RB.esc(z.text) + '</span></div><em>' + RB.esc(z.pace) + '</em></div>';
      }).join('') + '</div>';
    },
    rules: function (b) {
      return '<div>' + b.items.map(function (r) { return '<div class="stv-rule"><div><b>' + RB.esc(r[0]) + '</b><p class="stv-p">' + RB.md(r[1]) + '</p></div></div>'; }).join('') + '</div>';
    },
    // ---- blocos do relatório mensal ----
    tiles: function (b) {
      return '<div class="stv-tiles">' + b.items.map(function (x) { return '<div class="stv-tile"><div class="stv-d tv"' + (String(x.v).length > 4 ? ' style="font-size:38px"' : '') + '>' + RB.esc(x.v) + '</div><span>' + RB.esc(x.l) + '</span></div>'; }).join('') + '</div>';
    },
    cal: function (b) {
      var h = '<div class="stv-cal" role="img" aria-label="Calendário do mês com os dias de treino marcados">';
      ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].forEach(function (d) { h += '<div class="h">' + d + '</div>'; });
      var lead = (new Date(b.year, b.month, 1).getDay() + 6) % 7, n = new Date(b.year, b.month + 1, 0).getDate();
      for (var k = 0; k < lead; k++) h += '<div class="c e"></div>';
      for (var d = 1; d <= n; d++) {
        var r = (b.run || []).indexOf(d) > -1, st = (b.str || []).indexOf(d) > -1;
        h += '<div class="c' + (r && st ? ' both' : r ? ' run' : st ? ' str' : '') + (b.until && d > b.until ? ' fut' : '') + '">' + d + '</div>';
      }
      return h + '</div><div class="stv-calleg"><span><i class="run"></i>corrida</span><span><i class="str"></i>força</span></div>';
    },
    vs: function (b) {
      return '<div class="stv-vs"><div><small>' + RB.esc(b.a.label) + '</small><div class="stv-d v">' + RB.esc(b.a.v) + '</div></div><div class="vs-ar">→</div><div class="r"><small>' + RB.esc(b.b.label) + '</small><div class="stv-d v">' + RB.esc(b.b.v) + '</div></div></div>';
    },
    lifts: function (b) {
      return '<div>' + b.items.map(function (l) { return '<div class="stv-lift"><b>' + RB.esc(l.name) + '</b><em>' + RB.esc(l.val) + '</em>' + (l.sub ? '<span>' + RB.esc(l.sub) + '</span>' : '') + '</div>'; }).join('') + '</div>';
    },
    mile: function (b) { return '<div class="stv-mile"><div class="stv-d m">' + RB.esc(b.big) + '</div><p>' + RB.md(b.text) + '</p></div>'; },
    meter: function (b) {
      return '<div><div class="stv-kick" style="margin-bottom:8px">' + RB.esc(b.label) + '</div><div class="stv-meter">' + b.items.map(function (x) { return '<i class="' + (x.on ? 'on' : '') + '">' + RB.esc(x.t) + '</i>'; }).join('') + '</div></div>';
    },
    quote: function (b) { return '<p class="stv-quote">' + RB.esc(b.text) + '</p>'; },
    note: function (b) { return '<div class="stv-note"><p>' + RB.md(b.text) + '</p></div>'; },
    bullets: function (b) { return '<div class="stv-bul">' + b.items.map(function (t) { return '<div><p>' + RB.md(t) + '</p></div>'; }).join('') + '</div>'; },
    weeks: function (b) {
      var max = Math.max.apply(null, b.items.map(function (w) { return +w.long || 0; })) || 1;
      return '<div>' + b.items.map(function (w) {
        return '<div class="stv-wk"><span class="t">' + RB.esc(w.title) + '</span><span class="vol">' + RB.esc(w.vol) + '</span><p>' + RB.md(w.text) + '</p>' +
          (w.long ? '<div class="lg"><div class="bar"><i style="width:' + Math.round(100 * w.long / (max * 1.0909)) + '%"></i></div><span>' + w.long + ' km</span></div>' : '') + '</div>';
      }).join('') + '</div>';
    }
  };
  function slideHtml(s, k, n) {
    var inner = (s.blocks || []).map(function (b) { var f = B[b.t]; return f ? f(b) : ''; }).join('');
    if (k === n - 1) inner += '<button class="stv-restart" onclick="event.stopPropagation();RB.stories.go(0)">Ver de novo</button>';
    return '<section class="stv-slide s-' + RB.esc(s.theme || 'ink') + (s.cover ? ' cover' : '') + (k === 0 ? ' active' : '') + '">' + inner + '</section>';
  }

  // ---------- visualizador ----------
  ST.open = function (k) {
    var h = ST.list[k]; if (!h || !(h.slides || []).length) return;
    ST.play(h.slides);
    // marca como visto (o aro fica cinza em todos os aparelhos)
    var kk = key(h);
    if (RB.ms && !RB.ms.acked[kk]) {
      RB.ms.acked[kk] = true;
      sb.from('acks').upsert({ key: kk, user_id: RB.state.user.id }).then(function () {}, function () {});
    }
  };
  // abre qualquer sequência de slides (destaques ou relatório mensal)
  ST.play = function (slides) {
    if (!slides || !slides.length) return;
    var old = RB.$('stv'); if (old) old.remove();
    var h = { slides: slides };
    ST.cur = h; ST.i = 0;
    var n = h.slides.length;
    var el = document.createElement('div'); el.id = 'stv'; el.className = 'stv';
    el.innerHTML = '<div class="stv-card" id="stv-card"><div class="stv-bars">' + h.slides.map(function () { return '<i></i>'; }).join('') + '</div>' +
      '<div class="stv-top"><span class="stv-logo">RUNBASE</span><span id="stv-count"></span><button class="stv-x" onclick="RB.stories.close()" aria-label="Fechar">✕</button></div>' +
      h.slides.map(function (s, j) { return slideHtml(s, j, n); }).join('') +
      '<button class="stv-nav prev" onclick="RB.stories.go(RB.stories.i-1)" aria-label="Anterior"></button><button class="stv-nav next" onclick="RB.stories.go(RB.stories.i+1)" aria-label="Próximo"></button></div>';
    document.body.appendChild(el);
    document.body.classList.add('locked');
    var sx = null, c = el.querySelector('#stv-card');
    c.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    c.addEventListener('touchend', function (e) { if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 60) ST.go(ST.i + (dx < 0 ? 1 : -1)); }, { passive: true });
    document.addEventListener('keydown', ST.key);
    ST.go(0);
  };
  ST.key = function (e) {
    if (e.key === 'Escape') ST.close();
    else if (e.key === 'ArrowRight') ST.go(ST.i + 1);
    else if (e.key === 'ArrowLeft') ST.go(ST.i - 1);
  };
  ST.go = function (k) {
    var h = ST.cur, el = RB.$('stv'); if (!h || !el) return;
    var n = h.slides.length;
    if (k >= n) { ST.close(); return; }
    if (k < 0) k = 0;
    ST.i = k;
    var sl = el.querySelectorAll('.stv-slide');
    sl.forEach(function (s, j) { s.classList.toggle('active', j === k); });
    sl[k].scrollTop = 0;
    el.querySelectorAll('.stv-bars i').forEach(function (b, j) { b.classList.toggle('on', j <= k); });
    RB.$('stv-count').textContent = (k + 1) + '/' + n;
    el.querySelector('#stv-card').classList.toggle('light', h.slides[k].theme === 'cream');
  };
  ST.close = function () {
    var el = RB.$('stv'); if (el) el.remove();
    document.body.classList.remove('locked');
    document.removeEventListener('keydown', ST.key);
    ST.cur = null;
    var row = document.querySelector('.st-row');
    if (row && RB.athlete && RB.athlete.tab === 'home') { var t = document.createElement('div'); t.innerHTML = ST.row(); row.replaceWith(t.firstChild); }
  };
})();
