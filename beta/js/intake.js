// Run Base — ficha de entrada (anamnese): o aluno preenche no primeiro acesso; a coach lê no perfil
(function () {
  var sb = RB.sb;
  var I = RB.intake = { data: null };
  var esc = function (s) { return RB.esc(s); };
  var DAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
  // [chave, rótulo, tipo, opções/placeholder]
  var SECTIONS = [
    ['Sobre você', [
      ['nascimento', 'Data de nascimento', 'date'],
      ['rotina', 'Profissão e rotina de trabalho', 'text', 'Advogada, 9h–19h, muito tempo sentada'],
      ['altura', 'Altura (cm)', 'num', '168'], ['peso', 'Peso (kg)', 'num', '62']]],
    ['Corrida', [
      ['tempo_corrida', 'Há quanto tempo você corre?', 'one', ['Estou começando', 'Menos de 1 ano', '1 a 3 anos', '3 a 5 anos', 'Mais de 5 anos']],
      ['volume', 'Quantos km por semana, hoje?', 'text', '20 km'],
      ['tempos', 'Melhores tempos (5K, 10K, 21K, 42K)', 'area', '5K 27:30 · 10K 58:00'],
      ['onde', 'Onde você corre?', 'many', ['Rua', 'Parque', 'Esteira', 'Pista', 'Trilha']],
      ['relogio', 'Relógio ou app que usa', 'text', 'Garmin, Strava, Apple Watch...']]],
    ['Objetivos', [
      ['objetivo', 'Seu principal objetivo com a assessoria', 'area', 'Correr minha primeira meia, melhorar o pace, voltar de lesão...'],
      ['provas', 'Provas que já tem em mente (nome e data)', 'area', 'Meia de SP — abril']]],
    ['Disponibilidade', [
      ['dias', 'Dias que pode treinar', 'many', DAYS],
      ['horario', 'Melhor horário', 'many', ['Bem cedo', 'Manhã', 'Almoço', 'Tarde', 'Noite']],
      ['academia', 'Tem acesso a academia?', 'one', ['Sim', 'Não', 'Só em casa']],
      ['outras', 'Outras atividades que pratica', 'text', 'Pilates, yoga, futebol...']]],
    ['Saúde', [
      ['lesoes_atuais', 'Sente alguma dor ou lesão hoje?', 'area', 'Onde, há quanto tempo, o que piora'],
      ['lesoes_antes', 'Lesões ou cirurgias anteriores', 'area', 'Ex.: canelite em 2024, cirurgia no joelho...'],
      ['saude', 'Algo de saúde que a coach precisa saber', 'area', 'Condições, medicamentos, liberação médica...']]],
    ['Equipamento', [
      ['tenis', 'Tênis que usa (modelo e mais ou menos quantos km)', 'text', 'Nike Pegasus 41, ~300 km']]],
    ['Para fechar', [
      ['extra', 'Mais alguma coisa que eu deva saber?', 'area', '']]]
  ];
  I.SECTIONS = SECTIONS;

  I.load = async function (athleteId) {
    var r = await sb.from('anamnesis').select('*').eq('athlete_id', athleteId).maybeSingle();
    I.row = r.data || null; I.data = (r.data && r.data.data) || {};
    return I.row;
  };

  function field(f) {
    var k = f[0], v = I.data[k];
    var h = '<div class="fld"><div class="fld-l">' + esc(f[1]) + '</div>';
    if (f[2] === 'area') h += '<textarea class="ft" rows="2" data-k="' + k + '" placeholder="' + esc(f[3] || '') + '">' + esc(v || '') + '</textarea>';
    else if (f[2] === 'one' || f[2] === 'many') h += '<div class="chips-sel" data-k="' + k + '" data-m="' + (f[2] === 'many' ? 1 : 0) + '">' + f[3].map(function (o) {
      var on = f[2] === 'many' ? (v || []).indexOf(o) >= 0 : v === o;
      return '<button type="button" class="csel' + (on ? ' on' : '') + '" onclick="RB.intake.pick(this)">' + esc(o) + '</button>';
    }).join('') + '</div>';
    else h += '<input class="fi" data-k="' + k + '" type="' + (f[2] === 'date' ? 'date' : 'text') + '"' + (f[2] === 'num' ? ' inputmode="decimal"' : '') + ' value="' + esc(v || '') + '" placeholder="' + esc(f[3] || '') + '">';
    return h + '</div>';
  }
  I.pick = function (b) {
    var box = b.parentNode, many = box.dataset.m === '1';
    if (!many) box.querySelectorAll('.csel').forEach(function (x) { if (x !== b) x.classList.remove('on'); });
    b.classList.toggle('on');
  };
  function collect() {
    var d = {};
    document.querySelectorAll('#in-body [data-k]').forEach(function (el) {
      var k = el.dataset.k;
      if (el.classList.contains('chips-sel')) {
        var on = Array.prototype.map.call(el.querySelectorAll('.csel.on'), function (b) { return b.textContent; });
        d[k] = el.dataset.m === '1' ? on : (on[0] || '');
      } else d[k] = el.value.trim();
    });
    return d;
  }

  // aluno: formulário em tela cheia
  I.open = async function () {
    var A = RB.athlete;
    if (!I.row || I.aid !== A.me.id) { I.aid = A.me.id; await I.load(A.me.id); }
    var ov = document.createElement('div');
    ov.className = 'preview-overlay ed-ov'; ov.id = 'in-ov';
    ov.innerHTML = '<div class="preview-bar"><span>Ficha de entrada</span><span class="ed-btns"><button onclick="RB.intake.close()">Depois</button><button class="save" onclick="RB.intake.save()">Enviar</button></span></div>' +
      '<div class="preview-body" id="in-body"><div class="in-hello"><div class="sh-t">Oi, ' + esc(A.me.name.split(' ')[0]) + '! 👋</div><div class="p">Antes de montar seus treinos, quero te conhecer melhor. Leva uns 5 minutos e só a coach vê suas respostas.</div></div>' +
      SECTIONS.map(function (s) { return '<div class="card in-sec">' + RB.ew(s[0], 'blue') + s[1].map(field).join('') + '</div>'; }).join('') +
      '<button class="btn btn-r" onclick="RB.intake.save()">ENVIAR FICHA</button></div>';
    document.body.appendChild(ov); document.body.classList.add('locked');
  };
  I.close = function () { var o = RB.$('in-ov'); if (o) o.remove(); document.body.classList.remove('locked'); if (RB.athlete.tab === 'home') RB.athlete.go('home'); };
  I.save = async function () {
    var A = RB.athlete, d = collect();
    if (!d.objetivo) { RB.toast('Conta pelo menos o seu objetivo', false); return; }
    var r = await sb.from('anamnesis').upsert({ athlete_id: A.me.id, data: d, completed_at: (I.row && I.row.completed_at) || new Date().toISOString(), updated_at: new Date().toISOString() }).select().single();
    if (r.error) { RB.toast('Não deu para enviar', false); return; }
    I.row = r.data; I.data = d;
    if (A.me.needs_anamnesis) { await sb.from('athletes').update({ needs_anamnesis: false }).eq('id', A.me.id); A.me.needs_anamnesis = false; }
    I.close(); RB.toast('Ficha enviada ✓ Obrigada!');
  };
  // card na home enquanto não preencher
  I.homeCard = function () {
    var me = RB.athlete.me;
    if (!me || !me.needs_anamnesis) return '';
    return '<div class="card rl">' + RB.ew('📋 Ficha de entrada') + '<div class="p" style="margin-bottom:10px">Conta um pouco sobre você para a coach montar seus treinos. Leva 5 minutos.</div><button class="btn btn-r sm" onclick="RB.intake.open()">PREENCHER AGORA</button></div>';
  };

  // coach: resumo e leitura completa
  var show = function (v) { return Array.isArray(v) ? v.join(', ') : v; };
  I.coachSection = function (athlete) {
    var row = I.row, d = I.data || {};
    var body = row && row.completed_at
      ? (d.objetivo ? '<b>Objetivo:</b> ' + esc(d.objetivo) + '<br>' : '') + (d.lesoes_atuais ? '<span class="in-alert">⚠ Dor/lesão hoje: ' + esc(d.lesoes_atuais) + '</span><br>' : '') +
        '<span class="muted-s">Preenchida em ' + RB.fmtDate(row.completed_at) + (row.updated_at && row.updated_at.slice(0, 10) !== row.completed_at.slice(0, 10) ? ' · atualizada em ' + RB.fmtDate(row.updated_at) : '') + '</span>'
      : athlete.needs_anamnesis ? 'Pedida ao aluno — ainda não preenchida.' : 'Não preenchida.';
    var btn = row && row.completed_at ? '<button class="mini" onclick="RB.intake.view()">Ver ficha</button>'
      : '<span class="in-btns">' + (athlete.needs_anamnesis ? '' : '<button class="mini" onclick="RB.intake.ask()">Pedir ao aluno</button>') + '<button class="mini ghost" onclick="RB.intake.preview()">Ver perguntas</button></span>';
    return '<div class="card pl-sec"><div class="pl-h">' + RB.ew('Ficha de entrada', 'blue') + btn + '</div><div class="pl-b">' + body + '</div></div>';
  };
  I.view = function () {
    var d = I.data || {}, a = RB.coach.athlete;
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('Ficha de entrada') + '<div class="sh-t">' + esc(a.name) + '</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      SECTIONS.map(function (s) {
        var items = s[1].filter(function (f) { var v = d[f[0]]; return v && (!Array.isArray(v) || v.length); });
        if (!items.length) return '';
        return '<div class="in-v">' + RB.ew(s[0], 'blue') + items.map(function (f) {
          var v = d[f[0]]; if (f[2] === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(v)) v = v.split('-').reverse().join('/');
          return '<div class="in-q">' + esc(f[1]) + '</div><div class="in-a">' + esc(show(v)).replace(/\n/g, '<br>') + '</div>';
        }).join('') + '</div>';
      }).join('') + '<button class="btn btn-o" style="margin-top:12px" onclick="RB.closeSheet()">FECHAR</button>');
  };
  // coach: vê as perguntas que o aluno vai responder
  I.preview = function () {
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('Ficha de entrada') + '<div class="sh-t">Perguntas que o aluno responde</div><div class="sh-s">Aparece sozinha no primeiro acesso de quem você cadastra pelo app. Para alunos antigos, use "Pedir ao aluno".</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      SECTIONS.map(function (s) { return '<div class="in-v">' + RB.ew(s[0], 'blue') + s[1].map(function (f) { return '<div class="in-a">• ' + esc(f[1]) + (f[2] === 'one' || f[2] === 'many' ? ' <span class="muted-s">(' + f[3].join(' / ') + ')</span>' : '') + '</div>'; }).join('') + '</div>'; }).join('') +
      '<button class="btn btn-o" style="margin-top:12px" onclick="RB.closeSheet()">FECHAR</button>');
  };
  I.ask = async function () {
    var a = RB.coach.athlete;
    var r = await sb.from('athletes').update({ needs_anamnesis: true }).eq('id', a.id);
    if (r.error) { RB.toast('Erro', false); return; }
    a.needs_anamnesis = true;
    RB.toast('Pedido feito: a ficha aparece no próximo acesso de ' + a.name.split(' ')[0]);
    RB.coach.dt('plano');
  };
})();
