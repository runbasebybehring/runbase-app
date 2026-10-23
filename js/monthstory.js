// Run Base — relatório mensal em formato de stories.
// RB.mstory.data(): junta os números do mês (fica salvo em reports.auto_stats.story).
// RB.mstory.slides(): monta os slides a partir desses números + escolhas da treinadora (reports.story_opts).
(function () {
  var sb = RB.sb;
  var M = RB.mstory = {};
  var MESC = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function localDay(iso) { return ymd(new Date(iso)); }
  function dm(s) { return s.slice(8, 10) + '/' + s.slice(5, 7); }
  function first(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
  M.time = function (sec) {
    sec = Math.round(sec || 0);
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') : m + ':' + String(s).padStart(2, '0');
  };
  M.hours = function (sec) { var h = Math.floor(sec / 3600), m = Math.round(sec % 3600 / 60); return h ? h + 'h' + String(m).padStart(2, '0') : m + 'min'; };
  M.pace = function (sec, km) { if (!sec || !km) return ''; var p = Math.round(sec / km); return Math.floor(p / 60) + ':' + String(p % 60).padStart(2, '0'); };
  function km1(v) { return (Math.round(v * 10) / 10).toString().replace('.', ','); }
  function num(v) { return String(v).replace('.', ','); }
  // maior número de uma carga como "15 / 15 / 12,5" ou "17,5kg"; 0 ou texto puro = sem carga
  function loadVal(c) {
    var m = String(c || '').match(/\d+(?:[.,]\d+)?/g);
    if (!m) return 0;
    return Math.max.apply(null, m.map(function (x) { return parseFloat(x.replace(',', '.')); }));
  }

  // ---------- dados do mês ----------
  M.data = async function (athleteId, period, ad) {
    var R = RB.reports.monthRange(period);
    var start = new Date(R.start + 'T00:00:00'), end = new Date(R.end + 'T00:00:00');
    var prevStart = ymd(new Date(start.getFullYear(), start.getMonth() - 1, 1));
    var gymFrom = new Date(start.getTime() - 150 * 864e5).toISOString();
    var q = await Promise.all([
      sb.from('athletes').select('name,goal,race').eq('id', athleteId).single(),
      sb.from('feedbacks').select('id,performed_at,kind,distance_km,duration_sec,rpe,dor,comment,pain_exercises,workouts(type,description)')
        .eq('athlete_id', athleteId).gte('performed_at', prevStart).lt('performed_at', R.end).order('performed_at'),
      sb.from('gym_logs').select('exercise_key,exercise_name,carga,created_at').eq('athlete_id', athleteId)
        .gte('created_at', gymFrom).lt('created_at', end.toISOString()).order('created_at'),
      sb.from('athlete_plans').select('strength_started_at').eq('athlete_id', athleteId).maybeSingle()
    ]);
    var ath = q[0].data || {}, all = q[1].data || [], gym = q[2].data || [];
    var fbs = all.filter(function (f) { return f.performed_at >= R.start; });
    var prevRuns = all.filter(function (f) { return f.performed_at < R.start && f.kind === 'run'; });
    var runs = fbs.filter(function (f) { return f.kind === 'run'; }).map(function (f) {
      return { id: f.id, d: f.performed_at, km: +f.distance_km || 0, sec: f.duration_sec || 0, rpe: f.rpe, dor: !!f.dor, type: f.workouts ? f.workouts.type : '', desc: f.workouts ? f.workouts.description : '', comment: f.comment || '' };
    });

    // dias de força: feedback de força + registros de carga (um treino lançado em dois dias seguidos conta uma vez)
    var gymByDay = {};
    gym.forEach(function (g) { var d = localDay(g.created_at); if (d >= R.start && d < R.end) (gymByDay[d] = gymByDay[d] || {})[g.exercise_key || g.exercise_name] = 1; });
    var gDays = Object.keys(gymByDay).sort(), strDays = [], merged = false;
    gDays.forEach(function (d) {
      var prev = strDays[strDays.length - 1];
      var yest = ymd(new Date(new Date(d + 'T12:00:00').getTime() - 864e5));
      var overlap = prev === yest && Object.keys(gymByDay[d]).some(function (k) { return gymByDay[prev][k]; });
      if (prev === yest && !overlap && !merged) { merged = true; return; }
      merged = false; strDays.push(d);
    });
    fbs.forEach(function (f) { if (f.kind === 'strength' && strDays.indexOf(f.performed_at) < 0) strDays.push(f.performed_at); });
    strDays.sort();

    // cargas: compara com a última carga antes do mês (ou a primeira do mês). Só entra o que subiu.
    var byEx = {};
    gym.forEach(function (g) { var k = g.exercise_key || g.exercise_name; (byEx[k] = byEx[k] || { name: g.exercise_name, logs: [] }).logs.push({ d: localDay(g.created_at), v: loadVal(g.carga) }); });
    var lifts = [], held = 0;
    Object.keys(byEx).forEach(function (k) {
      var e = byEx[k], before = e.logs.filter(function (l) { return l.d < R.start && l.v > 0; }), inM = e.logs.filter(function (l) { return l.d >= R.start && l.d < R.end && l.v > 0; });
      if (!inM.length) return;
      var base = before.length ? before[before.length - 1].v : inM[0].v, fin = inM[inM.length - 1].v;
      if (fin > base) {
        var when = inM.find(function (l) { return l.v === fin; });
        lifts.push({ name: e.name, from: base, to: fin, d: when ? when.d : null, pct: (fin - base) / base });
      } else if (fin === base) held++;
    });
    lifts.sort(function (a, b) { return b.pct - a.pct; });

    // prova
    var rd = RB.raceDate(ath), raceRun = runs.find(function (r) { return /prova/i.test(r.type); });
    var totalKm = runs.reduce(function (a, r) { return a + r.km; }, 0), totalSec = runs.reduce(function (a, r) { return a + r.sec; }, 0);
    var longest = runs.filter(function (r) { return r !== raceRun; }).sort(function (a, b) { return b.km - a.km; })[0] || null;
    var prevLong = prevRuns.reduce(function (a, r) { return Math.max(a, +r.distance_km || 0); }, 0);
    var timed = function (list) { return list.filter(function (r) { return (+r.distance_km || r.km) >= 3 && (r.duration_sec || r.sec); }); };
    var paceOf = function (list) { var k = 0, s = 0; list.forEach(function (r) { k += +r.distance_km || r.km; s += r.duration_sec || r.sec; }); return k ? s / k : 0; };

    // mesma distância, mais rápido
    var same = null, groups = {};
    timed(runs).forEach(function (r) { var k = Math.round(r.km * 2) / 2; (groups[k] = groups[k] || []).push(r); });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k]; if (g.length < 2) return;
      var a = g[0], best = g.slice(1).sort(function (x, y) { return x.sec / x.km - y.sec / y.km; })[0];
      if (best.sec / best.km < a.sec / a.km && (!same || +k > same.km)) same = { km: +k, a: { d: a.d, sec: a.sec, km: a.km }, b: { d: best.d, sec: best.sec, km: best.km } };
    });

    var sid = R.start;
    if (ad === undefined) ad = null;
    var sessions = runs.length + strDays.length;
    var profile = raceRun ? 'prova-feita' : (rd && rd >= end) ? 'prova' : (!runs.length && strDays.length) ? 'forca' : (sessions <= 3 || (ad != null && ad < 50)) ? 'retomada' : 'corrida';
    var started = q[3].data && q[3].data.strength_started_at;
    var refEnd = Math.min(Date.now(), end.getTime());

    return {
      v: 1, period: sid, month: start.getMonth(), year: start.getFullYear(), until: Date.now() < end.getTime() ? new Date().getDate() : null,
      first: first(ath.name), goal: /definir/i.test(ath.goal || '') ? '' : (ath.goal || ''), race: ath.race || '', race_date: rd ? ymd(rd) : null,
      profile: profile, adesao: ad,
      runs: runs.map(function (r) { return { d: r.d, km: r.km, sec: r.sec, dor: r.dor }; }),
      run_days: runs.map(function (r) { return +r.d.slice(8, 10); }),
      str_days: strDays.map(function (d) { return +d.slice(8, 10); }),
      total_km: Math.round(totalKm * 10) / 10, total_sec: totalSec,
      longest: longest && longest.km ? { d: longest.d, km: longest.km, sec: longest.sec, type: longest.type, rpe: longest.rpe, comment: longest.comment.length <= 140 ? longest.comment : '' } : null,
      prev_longest: prevLong || null,
      pace: totalSec && timed(runs).length ? Math.round(paceOf(timed(runs))) : null,
      prev_pace: timed(prevRuns).length ? Math.round(paceOf(timed(prevRuns))) : null,
      same: same,
      race_run: raceRun ? { d: raceRun.d, km: raceRun.km, sec: raceRun.sec, desc: raceRun.desc } : null,
      lifts: lifts.slice(0, 4), held: held,
      str_weeks: started ? Math.floor((refEnd - new Date(started).getTime()) / (7 * 864e5)) : null,
      pain_runs: runs.filter(function (r) { return r.dor; }).map(function (r) { return +r.d.slice(8, 10); }),
      comments: fbs.filter(function (f) { return f.comment && f.comment.trim(); }).map(function (f) { return { id: f.id, d: f.performed_at, text: f.comment.trim() }; })
    };
  };

  // ---------- slides ----------
  var KEYS = [['numeros', 'Números do mês'], ['calendario', 'Calendário'], ['perfil', 'Objetivo / evolução'], ['forca', 'Força'], ['destaque', 'Destaque'], ['corpo', 'Incômodos'], ['frase', 'Frase do mês']];
  M.KEYS = KEYS;
  M.defaultWord = function (s) {
    return { 'prova-feita': 'Dia de prova', prova: 'Rumo à prova', forca: 'Mais forte', retomada: 'Retomada', corrida: s.adesao >= 80 ? 'Constância' : 'Base' }[s.profile] || 'Base';
  };

  function profileSlide(s) {
    var mes = RB.MES[s.month].toLowerCase();
    if (s.profile === 'prova-feita' && s.race_run) {
      var r = s.race_run;
      return { theme: 'green', blocks: [{ t: 'kick', text: 'Dia de prova · ' + dm(r.d) }, { t: 'title', text: r.desc ? r.desc.split(/[.·—]/)[0] : 'Prova' },
        { t: 'big', value: r.sec ? M.time(r.sec) : km1(r.km) + ' km', text: r.sec ? km1(r.km) + ' km\n' + M.pace(r.sec, r.km) + '/km' : '' },
        { t: 'text', text: 'Prova concluída' + (r.sec ? ', pace médio de **' + M.pace(r.sec, r.km) + '/km**.' : '.') }] };
    }
    if (s.profile === 'prova' && s.race_date) {
      var rd = new Date(s.race_date + 'T12:00:00'), days = Math.max(0, RB.daysTo(rd));
      return { theme: 'green', blocks: [{ t: 'kick', text: 'Rumo à prova' }, { t: 'title', text: s.goal || s.race },
        { t: 'big', value: String(days), text: 'dias\npara a largada' },
        { t: 'rows', items: [['Prova', s.race || '—'], ['Data', dm(s.race_date) + '/' + s.race_date.slice(0, 4)]].concat(s.longest ? [['Maior treino', km1(s.longest.km) + ' km em ' + dm(s.longest.d)]] : []) }] };
    }
    if (s.profile === 'forca') {
      return { theme: 'green', blocks: [{ t: 'kick', text: 'Seu objetivo' }, { t: 'title', text: s.goal || 'Fortalecimento' },
        { t: 'big', value: String(s.str_days.length), text: 'treinos\nde força' },
        { t: 'text', text: s.lifts.length ? '**' + s.lifts.length + ' exercício' + (s.lifts.length > 1 ? 's' : '') + '** com carga maior que no início do mês.' : 'Mês de base: técnica e constância antes de subir carga.' }] };
    }
    if (s.profile === 'retomada') {
      return { theme: 'green', blocks: [{ t: 'kick', text: 'O que você manteve' }, { t: 'title', text: 'Cada treino\nconta' },
        { t: 'big', value: String(s.runs.length + s.str_days.length), text: 'treino' + (s.runs.length + s.str_days.length === 1 ? '' : 's') + '\nem ' + mes },
        { t: 'text', text: 'O plano pro próximo mês é retomar o ritmo aos poucos, sem querer compensar o que ficou pra trás.' }] };
    }
    // corrida sem prova: a melhor evolução que os dados mostram
    if (s.same) {
      var a = s.same.a, b = s.same.b, diff = Math.round(a.sec / a.km * s.same.km - b.sec / b.km * s.same.km);
      return { theme: 'green', blocks: [{ t: 'kick', text: s.goal || 'Sua evolução' }, { t: 'title', text: 'Mesmos ' + num(s.same.km) + ' km,\n' + (diff >= 60 ? Math.round(diff / 60) + ' min' : diff + 's') + ' a menos' },
        { t: 'vs', a: { label: dm(a.d), v: M.time(a.sec) }, b: { label: dm(b.d), v: M.time(b.sec) } },
        { t: 'rows', items: [['Pace', M.pace(a.sec, a.km) + ' → ' + M.pace(b.sec, b.km) + ' /km']] },
        { t: 'text', text: 'Mesma distância, mais rápido. É assim que a base aparece.' }] };
    }
    if (s.longest && s.prev_longest && s.longest.km > s.prev_longest) {
      return { theme: 'green', blocks: [{ t: 'kick', text: s.goal || 'Sua evolução' }, { t: 'title', text: 'Mais longe\nque no mês passado' },
        { t: 'vs', a: { label: 'mês passado', v: km1(s.prev_longest) + ' km' }, b: { label: mes, v: km1(s.longest.km) + ' km' } },
        { t: 'text', text: 'Seu treino mais longo de ' + mes + ' passou o do mês anterior.' }] };
    }
    if (s.pace && s.prev_pace && s.pace < s.prev_pace) {
      return { theme: 'green', blocks: [{ t: 'kick', text: s.goal || 'Sua evolução' }, { t: 'title', text: 'Pace médio\nmais rápido' },
        { t: 'vs', a: { label: 'mês passado', v: M.pace(s.prev_pace, 1) }, b: { label: mes, v: M.pace(s.pace, 1) } },
        { t: 'text', text: 'Pace médio por km nas corridas de 3 km ou mais.' }] };
    }
    return { theme: 'green', blocks: [{ t: 'kick', text: 'Seu objetivo' }, { t: 'title', text: s.goal || 'Base' },
      { t: 'big', value: String(s.runs.length), text: 'corridas\nem ' + mes },
      { t: 'text', text: 'Mês de construção. A evolução vem da soma das semanas.' }] };
  }

  M.available = function (s) {
    return {
      numeros: true, calendario: true, perfil: true,
      forca: !!(s.lifts.length || s.str_days.length),
      destaque: !!(s.longest || (s.profile === 'forca' && s.lifts.length)),
      corpo: s.pain_runs.length > 0,
      frase: true
    };
  };

  // r = linha de reports (auto_stats.story, story_opts, coach_note)
  M.slides = function (r) {
    var s = r.auto_stats && r.auto_stats.story; if (!s) return [];
    var o = r.story_opts || {}, hide = o.hide || [], av = M.available(s);
    var on = function (k) { return av[k] && hide.indexOf(k) < 0; };
    var mes = RB.MES[s.month], mesl = mes.toLowerCase(), out = [];
    var sessions = s.runs.length + s.str_days.length;

    out.push({ theme: 'blue', cover: true, blocks: [{ t: 'kick', text: 'Relatório mensal · ' + mes + ' ' + s.year }, { t: 'title', size: 'huge', text: (o.word || M.defaultWord(s)).replace(/\s+/, '\n') },
      { t: 'pill', big: String(sessions), text: sessions === 1 ? ' treino no mês' : ' treinos no mês' }, { t: 'spacer' }, { t: 'ghost', text: String(s.month + 1).padStart(2, '0') },
      { t: 'foot', text: s.first + (s.goal ? ' · ' + s.goal : '') + (s.until ? '\nDados até ' + String(s.until).padStart(2, '0') + '/' + String(s.month + 1).padStart(2, '0') : '') }] });

    if (on('numeros')) {
      var tiles = [];
      if (s.runs.length) tiles.push({ v: String(s.runs.length), l: 'corridas' });
      if (s.str_days.length) tiles.push({ v: String(s.str_days.length), l: 'treinos de força' });
      if (s.total_km) tiles.push({ v: km1(s.total_km), l: 'km corridos' });
      if (s.total_sec) tiles.push({ v: M.hours(s.total_sec), l: 'tempo correndo' });
      if (tiles.length % 2 && s.adesao != null && s.profile !== 'retomada') tiles.push({ v: s.adesao + '%', l: 'do plano feito' });
      out.push({ theme: 'cream', blocks: [{ t: 'kick', text: 'O mês em números' }, { t: 'title', text: 'Seu ' + mesl }, { t: 'tiles', items: tiles }].concat(
        s.adesao != null && s.adesao >= 80 ? [{ t: 'text', text: 'Você fez **' + s.adesao + '% do que estava no plano**.' }] : []) });
    }
    if (on('calendario')) {
      out.push({ theme: 'ink', blocks: [{ t: 'kick', text: 'Constância' }, { t: 'title', text: 'Dia após dia' },
        { t: 'cal', year: s.year, month: s.month, run: s.run_days, str: s.str_days, until: s.until }, { t: 'spacer' },
        { t: 'text', text: (function () { var days = {}; s.run_days.concat(s.str_days).forEach(function (d) { days[d] = 1; }); var nd = Object.keys(days).length;
          return '**' + sessions + ' treino' + (sessions === 1 ? '' : 's') + '**' + (nd !== sessions ? ' em ' + nd + ' dias' : '') + ' em ' + mesl + '.'; })() }] });
    }
    if (on('perfil')) out.push(profileSlide(s));
    if (on('forca')) {
      var b = [{ t: 'kick', text: 'Fortalecimento' }, { t: 'title', text: s.lifts.length ? 'Carga que\nsubiu' : 'Força em dia' }];
      if (s.lifts.length) b.push({ t: 'lifts', items: s.lifts.map(function (l) { return { name: l.name, val: num(l.from) + ' → ' + num(l.to) + ' kg', sub: l.d ? 'subiu em ' + dm(l.d) : '' }; }) });
      else b.push({ t: 'big', value: String(s.str_days.length), text: 'treinos\nde força' });
      if (s.held) b.push({ t: 'text', text: s.held + ' exercício' + (s.held > 1 ? 's' : '') + ' com a carga firme o mês todo.', small: true });
      if (s.str_weeks != null && s.str_weeks >= 1) b.push({ t: 'mile', big: String(s.str_weeks), text: s.str_weeks >= RB.cfg.gymSwapWeeks ? '**semanas no mesmo programa.** Hora de renovar o treino.' : '**semana' + (s.str_weeks > 1 ? 's' : '') + ' no programa atual.**' });
      out.push({ theme: 'cream', blocks: b });
    }
    if (on('destaque')) {
      if (s.longest) {
        var L = s.longest, rows = [['Distância', km1(L.km) + ' km, ' + (s.profile === 'prova-feita' ? 'o treino mais longo' : 'a maior do mês')]];
        if (L.sec) rows.push(['Tempo', M.time(L.sec) + ' · ' + M.pace(L.sec, L.km) + '/km']);
        if (L.rpe) rows.push(['Esforço', 'RPE ' + L.rpe]);
        if (L.comment) rows.push(['Você disse', '"' + L.comment + '"']);
        out.push({ theme: 'red', blocks: [{ t: 'kick', text: (s.profile === 'prova-feita' ? 'Fora a prova · ' : 'Destaque do mês · ') + dm(L.d) }, { t: 'title', text: L.type || 'Treino mais longo' }, { t: 'big', value: km1(L.km), text: 'km' }, { t: 'rows', items: rows }] });
      } else {
        var top = s.lifts[0];
        out.push({ theme: 'red', blocks: [{ t: 'kick', text: 'Destaque do mês' }, { t: 'title', text: top.name }, { t: 'big', value: '+' + Math.round(top.pct * 100) + '%', text: 'de carga' },
          { t: 'rows', items: [['Carga', num(top.from) + ' → ' + num(top.to) + ' kg']].concat(top.d ? [['Quando', dm(top.d)]] : []) }] });
      }
    }
    if (on('corpo')) {
      out.push({ theme: 'ink', blocks: [{ t: 'kick', text: 'Como o corpo respondeu' }, { t: 'title', text: 'Incômodo\nno radar' },
        { t: 'meter', label: 'Corridas com incômodo', items: s.runs.map(function (r) { return { t: r.d.slice(8, 10), on: r.dor }; }) },
        { t: 'text', text: 'Apareceu em **' + s.pain_runs.length + ' de ' + s.runs.length + '** corridas. A gente segue acompanhando. Continue marcando no feedback.' }] });
    }
    if (on('frase') && o.quote && o.quote.text) {
      out.push({ theme: 'cream', blocks: [{ t: 'kick', text: 'Frase do mês' + (o.quote.d ? ' · ' + dm(o.quote.d) : '') }, { t: 'spacer' }, { t: 'quote', text: o.quote.text }, { t: 'spacer' },
        { t: 'text', text: 'Obrigada por contar como foi. É assim que eu ajusto cada semana.', small: true }] });
    }
    var fin = [];
    if (r.coach_note) fin.push({ t: 'kick', text: 'Recado da ' + RB.cfg.coachName }, { t: 'note', text: r.coach_note });
    var next = (o.next || []).filter(Boolean);
    if (next.length) {
      var nm = RB.MES[(s.month + 1) % 12];
      fin.push({ t: 'kick', text: 'Em ' + nm.toLowerCase() }, { t: 'bullets', items: next });
    }
    fin.push({ t: 'spacer' }, { t: 'title', size: 'h2', text: 'Bora,\n' + s.first + '.' });
    out.push({ theme: 'blue', blocks: fin });
    return out;
  };

  M.play = function (r) { var sl = M.slides(r); if (sl.length) RB.stories.play(sl); };
})();
