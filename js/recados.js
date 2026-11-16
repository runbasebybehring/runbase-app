// Run Base — recados da treinadora: cartão na Home do aluno até ele fechar.
// Recado com ação (ex.: 'ciclo') traz um botão que leva direto pra ação e some sozinho quando ela é feita.
(function () {
  var sb = RB.sb;
  var R = RB.recados = { list: [] };
  var ACOES = { ciclo: { lbl: '☾ ATIVAR MEU CICLO', go: 'RB.ciclo.setup()', feito: function () { return RB.ciclo && RB.ciclo.on(); } } };

  R.load = async function (uid) {
    try {
      var r = await sb.from('recados').select('*').eq('athlete_id', uid).is('dismissed_at', null).order('created_at');
      R.list = r.data || [];
    } catch (e) { R.list = []; }
  };
  var pend = function () { return R.list.filter(function (m) { var a = ACOES[m.action]; return !(a && a.feito()); }); };

  R.homeCard = function () {
    // recado com ação já feita: marca como lido sem incomodar
    R.list.forEach(function (m) { var a = ACOES[m.action]; if (a && a.feito()) R.dismiss(m.id, true); });
    return pend().map(function (m) {
      var a = ACOES[m.action];
      return '<div class="card rc" id="rc-' + m.id + '"><div class="rc-top">' + RB.ew('Recado da treinadora', 'red') + '<button class="x" onclick="RB.recados.dismiss(\'' + m.id + '\')" aria-label="Fechar">✕</button></div>' +
        '<div class="rc-t">' + RB.esc(m.title) + '</div><div class="rc-b">' + RB.esc(m.body).replace(/\n/g, '<br>') + '</div>' +
        (a ? '<button class="btn btn-r" style="margin-top:14px" onclick="' + a.go + '">' + a.lbl + '</button><button class="btn-link" onclick="RB.recados.dismiss(\'' + m.id + '\')">Agora não</button>'
          : '<button class="btn btn-o" style="margin-top:14px" onclick="RB.recados.dismiss(\'' + m.id + '\')">OK, ENTENDI</button>') + '</div>';
    }).join('');
  };
  R.dismiss = function (id, quiet) {
    R.list = R.list.filter(function (m) { return m.id !== id; });
    if (!quiet) { var el = RB.$('rc-' + id); if (el) el.remove(); }
    sb.from('recados').update({ dismissed_at: new Date().toISOString() }).eq('id', id).then(function () {}, function () {});
  };
})();
