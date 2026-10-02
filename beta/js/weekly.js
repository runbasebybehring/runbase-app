// Run Base — aluno: volume semanal (feito × planejado) e treinos da semana na agenda do celular (.ics)
(function () {
  var W = RB.wk = {};
  var DAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
  var esc = function (s) { return RB.esc(s); };
  var kmOf = function (txt) { var m = /(\d+(?:[.,]\d+)?)\s*(?:km|k\b)/i.exec(txt || '') || /^\s*~?\s*(\d+(?:[.,]\d+)?)/.exec(txt || ''); return m ? parseFloat(m[1].replace(',', '.')) : null; };

  // ---------- volume semanal ----------
  W.volumeCard = function () {
    var A = RB.athlete; if (!A.cur) return '';
    var list = A.weeks.filter(function (w) { return w.week_number <= A.cur.week_number; }).slice(-8);
    var rows = list.map(function (w) {
      var done = 0, n = 0;
      w.workouts.forEach(function (wo) { var f = A.byWorkout[wo.id]; if (f) { n++; done += +f.distance_km || 0; } });
      return { w: w, plan: kmOf(w.volume), done: done, n: n, tot: w.workouts.length };
    });
    if (!rows.some(function (r) { return r.plan || r.done; })) return '';
    var max = Math.max.apply(null, rows.map(function (r) { return Math.max(r.plan || 0, r.done); }).concat([1]));
    var SW = 340, H = 140, bw = (SW - 20) / rows.length;
    var bars = rows.map(function (r, i) {
      var x = 10 + i * bw, sc = (H - 34) / max, cur = r.w.id === A.cur.id;
      var hp = (r.plan || 0) * sc, hd = r.done * sc;
      return (r.plan ? '<rect x="' + (x + 5) + '" y="' + (H - 20 - hp) + '" width="' + (bw - 10) + '" height="' + hp + '" fill="none" stroke="var(--border)" stroke-width="1.5" stroke-dasharray="3 2"/>' : '') +
        '<rect x="' + (x + 9) + '" y="' + (H - 20 - hd) + '" width="' + (bw - 18) + '" height="' + hd + '" fill="' + (cur ? 'var(--red)' : 'var(--blue)') + '"/>' +
        (r.done ? '<text x="' + (x + bw / 2) + '" y="' + (H - 24 - Math.max(hd, hp)) + '" class="ch-ax" text-anchor="middle">' + Math.round(r.done) + '</text>' : '') +
        '<text x="' + (x + bw / 2) + '" y="' + (H - 6) + '" class="ch-ax" text-anchor="middle">S' + r.w.week_number + '</text>';
    }).join('');
    var last = rows[rows.length - 1];
    return '<div class="card">' + RB.ew('Volume semanal', 'blue') +
      '<div class="vol-top"><b>' + RB.pace.fmtKm(last.done || 0) + ' km</b>' + (last.plan ? ' de ' + RB.pace.fmtKm(last.plan) + ' km planejados' : '') + ' · ' + last.n + '/' + last.tot + ' treinos nesta semana</div>' +
      '<svg viewBox="0 0 ' + SW + ' ' + H + '" class="ld-svg" role="img" aria-label="Km por semana">' + bars + '</svg>' +
      '<div class="hint"><span class="vol-k plan"></span> planejado · <span class="vol-k done"></span> feito (soma dos km informados nos feedbacks)</div></div>';
  };

  // ---------- agenda (.ics) ----------
  function monday(d) { d = new Date(d.getFullYear(), d.getMonth(), d.getDate()); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d; }
  function weekStart(w) {
    var A = RB.athlete;
    if (A.me.plan_start) { var s = new Date(A.me.plan_start + 'T12:00:00'); s.setDate(s.getDate() + (w.week_number - 1) * 7); return monday(s); }
    var m = monday(new Date()); m.setDate(m.getDate() + (w.week_number - A.cur.week_number) * 7); return m;
  }
  var ymd = function (d) { return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };
  var icsEsc = function (s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); };
  function zonesText(desc) {
    var zs = RB.athlete.zones || [], out = [];
    (String(desc || '').match(/Z[1-5]/gi) || []).forEach(function (z) {
      var n = z.slice(1), zz = RB.pace.zone(zs, n);
      if (zz && out.indexOf(zz) < 0) out.push(zz);
    });
    return out.map(function (z) { return z.zone.split('·')[0].trim() + ' ' + RB.pace.show(z.pace); }).join(' · ');
  }
  W.ics = function (weeks) {
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RUNBASE//Treinos//PT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:RUNBASE'];
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'), n = 0;
    weeks.forEach(function (w) {
      var base = weekStart(w);
      w.workouts.forEach(function (wo) {
        var i = DAYS.indexOf(String(wo.day_label || '').toUpperCase().trim().slice(0, 3).replace('SAB', 'SÁB'));
        if (i < 0 || /DESCANSO|OFF/i.test(wo.type || '')) return;
        var d = new Date(base); d.setDate(d.getDate() + i);
        var e = new Date(d); e.setDate(e.getDate() + 1);
        var zt = zonesText(wo.description);
        lines.push('BEGIN:VEVENT', 'UID:rb-' + wo.id + '@runbase', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + ymd(d), 'DTEND;VALUE=DATE:' + ymd(e),
          'SUMMARY:' + icsEsc('RUNBASE · ' + (wo.type || 'Treino')), 'DESCRIPTION:' + icsEsc((wo.description || '') + (zt ? '\n' + zt : '') + '\n' + RB.appUrl()),
          'TRANSP:TRANSPARENT', 'END:VEVENT');
        n++;
      });
    });
    lines.push('END:VCALENDAR');
    return { text: lines.join('\r\n'), n: n };
  };
  W.addToCalendar = async function () {
    var A = RB.athlete;
    var next = A.weeks.find(function (w) { return w.week_number === A.cur.week_number + 1; });
    var c = W.ics(next ? [A.cur, next] : [A.cur]);
    if (!c.n) { RB.toast('Os treinos desta semana não têm dia da semana definido', false); return; }
    var file = new File([c.text], 'runbase-treinos.ics', { type: 'text/calendar' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Treinos RUNBASE' }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    var url = URL.createObjectURL(file), a = document.createElement('a');
    a.href = url; a.download = 'runbase-treinos.ics'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    RB.toast(c.n + ' treinos prontos — abra o arquivo para adicionar à agenda');
  };
  W.calButton = function () {
    var A = RB.athlete; if (!A.cur || !A.cur.workouts.length) return '';
    var next = A.weeks.some(function (w) { return w.week_number === A.cur.week_number + 1; });
    return '<button class="btn btn-o sm cal-b" onclick="RB.wk.addToCalendar()">📅 ADICIONAR À AGENDA DO CELULAR</button><div class="hint" style="text-align:center;margin:-4px 0 12px">Semana atual' + (next ? ' e a próxima' : '') + ' · eventos de dia inteiro</div>';
  };
})();
