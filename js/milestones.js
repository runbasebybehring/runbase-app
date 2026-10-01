// Run Base — avisos de marcos: 4 semanas de planilha concluídas e 4 semanas no mesmo treino de força
(function () {
  var sb = RB.sb;
  var M = RB.ms = { EVERY: 4, acked: {} };

  M.loadAcks = async function () {
    var r = await sb.from('acks').select('key');
    M.acked = {};
    (r.data || []).forEach(function (a) { M.acked[a.key] = true; });
  };
  M.ack = async function (key, el) {
    M.acked[key] = true;
    if (el) { var card = el.closest('.ms-card'); if (card) card.remove(); }
    await sb.from('acks').upsert({ key: key, user_id: RB.state.user.id });
  };

  // semanas concluídas: semanas anteriores com pelo menos metade dos treinos com feedback,
  // mais a semana atual se estiver 100% feita
  M.completedWeeks = function (weeks, hasFb) {
    var cur = weeks.find(function (w) { return w.is_current; });
    if (!cur) return 0;
    return weeks.filter(function (w) {
      var tot = (w.workouts || []).length; if (!tot) return false;
      var done = w.workouts.filter(function (wo) { return hasFb(wo.id); }).length;
      if (w.week_number < cur.week_number) return done >= Math.ceil(tot / 2);
      if (w.id === cur.id) return done === tot;
      return false;
    }).length;
  };
  M.level = function (n) { return Math.floor(n / M.EVERY); };
  M.strengthWeeks = function (plan) { return plan && plan.strength && plan.strength_started_at ? RB.weeksSince(plan.strength_started_at) : 0; };

  // cartões do aluno (home)
  M.athleteCards = function (A) {
    var out = '';
    var n = M.completedWeeks(A.weeks, function (id) { return !!A.byWorkout[id]; });
    var lvl = M.level(n);
    if (lvl >= 1) {
      var k = 'plan:' + lvl;
      if (!M.acked[k]) {
        var w = lvl * M.EVERY;
        out += '<div class="card ms-card ms-win">' + RB.ew('🎉 Marco', 'green') +
          '<div class="ms-big">' + w + ' semanas completas</div>' +
          '<div class="p">' + (w === 4 ? 'Primeiro bloco fechado. A base está sendo construída, treino a treino.' : 'Mais um bloco fechado. Constância assim faz diferença no dia da prova.') +
          ' Seu coach já foi avisado para revisar o próximo bloco com você.</div>' +
          '<button class="btn btn-r sm" onclick="RB.ms.ack(\'' + k + '\', this)">VALEU! 👊</button></div>';
      }
    }
    var sw = M.strengthWeeks(A.plan);
    if (sw >= M.EVERY) {
      var gk = 'gym:' + A.plan.strength_started_at.slice(0, 10) + ':' + M.level(sw);
      if (!M.acked[gk]) {
        out += '<div class="card ms-card rl">' + RB.ew('🔁 Treino de força') +
          '<div class="ms-big">' + sw + ' semanas no mesmo treino</div>' +
          '<div class="p">Hora de evoluir: carga, estrutura ou exercícios novos. Seu coach já foi avisado. Registre as cargas e o feedback dos treinos para ajudar no ajuste.</div>' +
          '<button class="btn btn-o sm" onclick="RB.ms.ack(\'' + gk + '\', this)">ENTENDI</button></div>';
      }
    }
    return out;
  };

  // avisos do coach (painel)
  M.coachLoad = async function () {
    var r = await Promise.all([
      sb.from('weeks').select('id,athlete_id,week_number,is_current,workouts(id)'),
      sb.from('feedbacks').select('workout_id').not('workout_id', 'is', null),
      sb.from('athlete_plans').select('athlete_id,strength_started_at').not('strength', 'is', null),
      M.loadAcks()
    ]);
    var fb = {}; (r[1].data || []).forEach(function (f) { fb[f.workout_id] = 1; });
    var byAth = {}; (r[0].data || []).forEach(function (w) { (byAth[w.athlete_id] = byAth[w.athlete_id] || []).push(w); });
    M.coach = { plan: {}, gym: {} };
    M.coach.cur = {};
    Object.keys(byAth).forEach(function (id) {
      M.coach.plan[id] = M.completedWeeks(byAth[id], function (wid) { return !!fb[wid]; });
      var c = byAth[id].find(function (w) { return w.is_current; });
      M.coach.cur[id] = { n: c ? c.week_number : null, last: Math.max.apply(null, byAth[id].map(function (w) { return w.week_number; })) };
    });
    (r[2].data || []).forEach(function (p) { M.coach.gym[p.athlete_id] = { weeks: RB.weeksSince(p.strength_started_at), start: p.strength_started_at }; });
  };
  M.coachCards = function (athletes) {
    if (!M.coach) return '';
    var items = [];
    athletes.forEach(function (a) {
      var first = RB.esc(a.name.split(' ')[0]);
      var n = M.coach.plan[a.id] || 0, lvl = M.level(n);
      if (lvl >= 1) {
        var k = 'c-plan:' + a.id + ':' + lvl;
        if (!M.acked[k]) items.push('<div class="ms-item ms-card">' + RB.av(a.img, 30) + '<div class="ms-t"><b>' + first + '</b> completou <b>' + (lvl * M.EVERY) + ' semanas</b> de planilha. Hora de revisar o bloco e fazer o relatório.' +
          '<div class="ms-a"><button class="mini" onclick="RB.coach.newReport(\'' + a.id + '\')">Criar relatório</button><button class="mini ghost" onclick="RB.ms.ack(\'' + k + '\', this)">OK</button></div></div></div>');
      }
      var g = M.coach.gym[a.id];
      if (g && g.weeks >= M.EVERY) {
        var gk = 'c-gym:' + a.id + ':' + g.start.slice(0, 10) + ':' + M.level(g.weeks);
        if (!M.acked[gk]) items.push('<div class="ms-item ms-card">' + RB.av(a.img, 30) + '<div class="ms-t"><b>' + first + '</b> está há <b>' + g.weeks + ' semanas</b> no mesmo treino de força. Hora de progredir ou trocar os exercícios.' +
          '<div class="ms-a"><button class="mini" onclick="RB.coach.open(\'' + a.id + '\')">Ver aluno</button><button class="mini ghost" onclick="RB.ms.ack(\'' + gk + '\', this)">OK</button></div></div></div>');
      }
    });
    return items.length ? '<div class="card ms-box">' + RB.ew('Avisos · ' + items.length, 'blue') + items.join('') + '</div>' : '';
  };
})();
