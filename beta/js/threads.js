// Run Base — feedback de treino: cartão e conversa coach ↔ aluno
(function () {
  var sb = RB.sb;
  var T = RB.threads = {};

  T.load = async function (feedbackIds) {
    var map = {};
    if (!feedbackIds.length) return map;
    var res = await sb.from('feedback_replies').select('*').in('feedback_id', feedbackIds).order('created_at');
    (res.data || []).forEach(function (r) { (map[r.feedback_id] = map[r.feedback_id] || []).push(r); });
    return map;
  };
  T.unread = function (replies) {
    var me = RB.state.user.id;
    return (replies || []).filter(function (r) { return r.author_id !== me && !r.seen_at; }).length;
  };
  // true quando a última palavra na conversa é do aluno (ou ninguém respondeu ainda)
  T.awaitingCoach = function (f, replies) {
    if (!replies || !replies.length) return true;
    return replies[replies.length - 1].author_id !== RB.cfg.coachId;
  };

  // Cartão do feedback. o = {athlete, replies, onclick, showDesc}
  RB.fbCard = function (f, o) {
    o = o || {};
    var w = f.workouts || {};
    var st = f.kind === 'strength';
    var wlabel = st ? (f.strength_day || (w.day_label ? w.day_label + ' — ' + w.type : 'Treino de força')) : (w.day_label ? w.day_label + ' — ' + w.type : '');
    var reps = o.replies || [];
    var unread = T.unread(reps);
    var head = o.athlete
      ? '<div class="fbc-h">' + RB.av(o.athlete.img, 34) + '<div class="fbc-who"><div class="fbc-n">' + RB.esc(o.athlete.name) + '</div><div class="fbc-m">' + (st ? '<span class="kind-f">FORÇA</span> ' : '') + RB.esc(wlabel) + ' · ' + RB.fmtDate(f.created_at, true) + '</div></div>'
      : '<div class="fbc-h"><div class="fbc-who"><div class="fbc-m">' + (st ? '<span class="kind-f">FORÇA</span> ' : '') + RB.esc(wlabel || 'Treino') + ' · ' + RB.fmtDate(f.performed_at || f.created_at) + '</div></div>';
    head += '<div class="fbc-rpe" style="color:' + RB.rpeColor(f.rpe) + '">' + (f.rpe || '–') + '<span>RPE</span></div></div>';
    var tags = st
      ? '<div class="fbc-tags">' + (f.completion ? RB.tag(f.completion === 'sim' ? 'completou' : f.completion === 'parcial' ? 'completou parcial' : 'não completou', f.completion === 'sim' ? 'g' : f.completion === 'parcial' ? 'm' : 'r') : '') +
        (f.load_trend ? RB.tag('carga ' + f.load_trend, f.load_trend === 'subiu' ? 'b' : 'm') : '') + (f.energia ? RB.tag('energia ' + f.energia, 'm') : '') +
        (f.dor ? ((f.pain_exercises || []).length ? f.pain_exercises.map(function (e) { return RB.tag('dor: ' + e, 'r'); }).join('') : RB.tag('dor', 'r')) : '') + '</div>'
      : '<div class="fbc-tags">' + (f.energia ? RB.tag('energia ' + f.energia, 'g') : '') + (f.dor ? RB.tag('dor', 'r') : '') +
      RB.fbExtras(f).map(function (e) { return RB.tag(e, 'm'); }).join('') + '</div>';
    var desc = o.showDesc && w.description ? '<div class="fbc-d">' + RB.esc(w.description) + '</div>' : '';
    var met = RB.pace.summary(f);
    if (met || f.strava_url) desc += '<div class="fbc-met">' + (met ? '<b>' + met + '</b>' : '') + (f.strava_url ? ' <a href="' + RB.esc(f.strava_url) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">Strava ↗</a>' : '') + '</div>';
    if (!RB.state.isCoach && f.distance_km && f.duration_sec && !o.static) desc += '<button class="mini share-b" onclick="event.stopPropagation();RB.share.openId(' + f.id + ')">↗ Compartilhar imagem</button>';
    var com = f.comment ? '<div class="fbc-c">“' + RB.esc(f.comment) + '”</div>' : '';
    if (f.audio_path) com += RB.audio.player(f.audio_path);
    var last = reps[reps.length - 1];
    var foot = '';
    if (last) {
      var fromCoach = last.author_id === RB.cfg.coachId;
      foot = '<div class="fbc-last' + (unread ? ' new' : '') + '"><span class="fbc-who2">' + (fromCoach ? 'Coach' : (o.athlete ? RB.esc(o.athlete.name.split(' ')[0]) : 'Você')) + '</span> ' +
        RB.esc(last.body.length > 90 ? last.body.slice(0, 90) + '…' : last.body) + (reps.length > 1 ? ' <span class="fbc-cnt">· ' + reps.length + ' mensagens</span>' : '') + '</div>';
    }
    var cta = '<div class="fbc-cta">' + (unread ? '<span class="dot"></span>' : '') +
      (reps.length ? 'Abrir conversa' : (RB.state.isCoach ? 'Responder' : 'Conversar com o coach')) + ' ›</div>';
    if (o.static) return '<div class="fbc static" style="border-left-color:' + RB.rpeColor(f.rpe) + '">' + head + desc + tags + com + '</div>';
    return '<div class="fbc" style="border-left-color:' + RB.rpeColor(f.rpe) + '" onclick="RB.threads.open(' + f.id + ')">' + head + desc + tags + com + foot + cta + '</div>';
  };

  var current = null;
  T.open = async function (fid, onClose) {
    RB.openSheet('<div class="ld"><div class="sp"></div></div>');
    var fr = await sb.from('feedbacks').select('*,athletes(name,img),workouts(day_label,type,description)').eq('id', fid).single();
    if (fr.error || !fr.data) { RB.closeSheet(); RB.toast('Não foi possível abrir', false); return; }
    current = { f: fr.data };
    RB.onSheetClose = onClose || T.onClose || null;
    await T.refresh();
    // marca como lidas as mensagens do outro lado
    sb.rpc('mark_replies_seen', { p_feedback_ids: [fid] }).then(function () {});
  };
  T.refresh = async function () {
    var f = current.f;
    var map = await T.load([f.id]);
    var reps = map[f.id] || [];
    current.replies = reps;
    var coach = RB.state.isCoach;
    var name = f.athletes ? f.athletes.name.split(' ')[0] : '';
    var msgs = reps.map(function (r) {
      var mine = r.author_id === RB.state.user.id;
      var who = mine ? 'Você' : (r.author_id === RB.cfg.coachId ? 'Coach' : name);
      var onlyAudio = r.audio_path && r.body === '🎤 Áudio';
      return '<div class="msg' + (mine ? ' me' : '') + '"><div class="msg-b">' + (onlyAudio ? '' : RB.md(r.body)) + (r.audio_path ? RB.audio.player(r.audio_path) : '') + '</div><div class="msg-m">' + RB.esc(who) + ' · ' + RB.ago(r.created_at) + '</div></div>';
    }).join('');
    var ph = coach ? 'Responder ' + RB.esc(name) + '...' : 'Escreva para o coach...';
    var quick = coach ? '<div class="quick">' + ['Boa! 👊', 'Segue o plano.', 'Vamos ajustar a próxima semana.', 'Me conta mais sobre a dor.'].map(function (q) {
      return '<button onclick="RB.threads.quick(this)">' + q + '</button>';
    }).join('') + '</div>' : '';
    RB.$('sheet-body').innerHTML =
      '<div class="sh-top"><div>' + RB.ew('Feedback do treino') + '</div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      RB.fbCard(f, { athlete: coach ? f.athletes : null, showDesc: true, static: true }) +
      '<div class="thread">' + (msgs || '<div class="muted-s" style="text-align:center;padding:12px 0">' + (coach ? 'Nenhuma resposta ainda.' : 'Seu coach vai ler e responder por aqui.') + '</div>') + '</div>' +
      quick + RB.audio.recorder('th', 'Mandar áudio') + '<div class="composer"><textarea id="reply-text" class="ft" rows="2" placeholder="' + ph + '"></textarea><button class="btn btn-r send" onclick="RB.threads.send()">ENVIAR</button></div>';
    var th = document.querySelector('#sheet-body .thread'); if (th) th.scrollTop = th.scrollHeight;
  };
  T.quick = function (b) { var t = RB.$('reply-text'); t.value = (t.value ? t.value + ' ' : '') + b.textContent; t.focus(); };
  T.send = async function () {
    var t = RB.$('reply-text'), body = t.value.trim();
    if (!body && !RB.audio.blob) return;
    var btn = document.querySelector('#sheet-body .send'); btn.disabled = true; btn.textContent = '...';
    var audioPath = null;
    try { audioPath = await RB.audio.upload(current.f.athlete_id); } catch (e) { btn.disabled = false; btn.textContent = 'ENVIAR'; RB.toast('Não deu para enviar o áudio', false); return; }
    var row = { feedback_id: current.f.id, body: body || '🎤 Áudio', author_id: RB.state.user.id };
    if (audioPath) row.audio_path = audioPath;
    var res = await sb.from('feedback_replies').insert(row).select('id').single();
    if (!res.error) RB.push.notify({ type: 'reply', reply_id: res.data.id });
    btn.disabled = false; btn.textContent = 'ENVIAR';
    if (res.error) { RB.toast('Erro ao enviar', false); return; }
    t.value = '';
    await T.refresh();
  };
})();
