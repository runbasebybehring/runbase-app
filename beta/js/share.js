// Run Base — imagem do treino para compartilhar (stories e feed), no estilo da marca
(function () {
  var sb = RB.sb;
  var SH = RB.share = {};
  var C = { red: '#C61721', blue: '#2C53A1', cream: '#F7F1EA', dark: '#1E1E1E' };
  var FORMATS = { story: [1080, 1920], post: [1080, 1350] };
  var STYLES = [['creme', 'Creme'], ['vermelho', 'Vermelho'], ['azul', 'Azul'], ['foto', 'Sua foto'], ['transparente', 'Sem fundo']];
  var MES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  var st = { f: null, format: 'story', style: 'creme', photo: null, bw: true };
  var fontsReady = null;

  function loadFonts() {
    if (fontsReady) return fontsReady;
    var defs = [['Aileron', 'fonts/aileron-latin-800-italic.woff2', { weight: '800', style: 'italic' }],
      ['Aileron', 'fonts/aileron-latin-800-normal.woff2', { weight: '800', style: 'normal' }],
      ['Aileron', 'fonts/aileron-latin-700-normal.woff2', { weight: '700', style: 'normal' }],
      ['Aileron', 'fonts/aileron-latin-400-normal.woff2', { weight: '400', style: 'normal' }]];
    fontsReady = Promise.all(defs.map(function (d) {
      try { var ff = new FontFace(d[0], 'url(' + d[1] + ')', d[2]); return ff.load().then(function (f) { document.fonts.add(f); }); } catch (e) { return null; }
    })).catch(function () {});
    return fontsReady;
  }

  SH.openId = async function (id) {
    var f = (RB.athlete.feedbacks || []).find(function (x) { return x.id === id; });
    if (!f) { var r = await sb.from('feedbacks').select('*,workouts(day_label,type,description,week_id)').eq('id', id).single(); f = r.data; }
    if (f) SH.open(f);
  };
  SH.open = async function (f) {
    st.f = f; st.photo = null;
    RB.openSheet('<div class="sh-top"><div>' + RB.ew('Compartilhar treino') + '<div class="sh-t">Sua imagem do treino</div></div><button class="x" onclick="RB.closeSheet()">✕</button></div>' +
      '<div class="sh-prev"><canvas id="share-cv"></canvas></div>' +
      '<div class="fld"><div class="fld-l">Formato</div><div class="opts" id="sh-format">' + [['story', 'Stories 9:16'], ['post', 'Feed 4:5']].map(function (o) { return '<button class="eb' + (st.format === o[0] ? ' sel' : '') + '" onclick="RB.share.set(\'format\',\'' + o[0] + '\')">' + o[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="fld"><div class="fld-l">Estilo</div><div class="opts sh-styles" id="sh-style">' + STYLES.map(function (o) { return '<button class="eb' + (st.style === o[0] ? ' sel' : '') + '" onclick="RB.share.set(\'style\',\'' + o[0] + '\')">' + o[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="fld" id="sh-photo" style="display:none"><label class="btn btn-o sh-pick">ESCOLHER FOTO<input type="file" accept="image/*" onchange="RB.share.photo(this)" hidden></label>' +
      '<label class="ck-l big" style="margin-top:8px"><input type="checkbox" id="sh-bw" ' + (st.bw ? 'checked' : '') + ' onchange="RB.share.set(\'bw\',this.checked)"> <span>Preto e branco</span></label></div>' +
      '<div class="hint" id="sh-hint" style="display:none;margin-bottom:8px">Fundo transparente: no Instagram, adicione como figurinha por cima da sua foto.</div>' +
      '<button class="btn btn-r" id="sh-go" onclick="RB.share.go()">COMPARTILHAR</button>' +
      '<button class="btn btn-o" onclick="RB.share.download()">BAIXAR IMAGEM</button>');
    await loadFonts();
    SH.draw();
  };
  SH.set = function (k, v) {
    st[k] = v;
    if (k === 'format' || k === 'style') document.querySelectorAll('#sh-' + k + ' .eb').forEach(function (b) { b.classList.toggle('sel', b.getAttribute('onclick').indexOf("'" + v + "'") > 0); });
    if (k === 'style' && v === 'foto' && !st.photo) { var inp = document.querySelector('#sh-photo input'); if (inp) inp.click(); }
    SH.draw();
  };
  SH.photo = function (inp) {
    var file = inp.files && inp.files[0]; if (!file) return;
    var img = new Image();
    img.onload = function () { st.photo = img; st.style = 'foto'; SH.set('style', 'foto'); };
    img.src = URL.createObjectURL(file);
  };

  function title(f) {
    if (f.kind === 'strength') return 'TREINO DE FORÇA';
    var t = (f.workouts && f.workouts.type) || 'CORRIDA';
    return t.toUpperCase();
  }
  function dateStr(f) {
    var d = new Date((f.performed_at || f.created_at.slice(0, 10)) + 'T12:00:00');
    return String(d.getDate()).padStart(2, '0') + ' ' + MES[d.getMonth()] + ' ' + d.getFullYear();
  }
  function fit(ctx, text, font, maxW, size) {
    do { ctx.font = font.replace('{s}', size); size -= 4; } while (ctx.measureText(text).width > maxW && size > 20);
    return size + 4;
  }
  function track(ctx, text, x, y, spacing, align) {
    // texto com espaçamento entre letras (estilo etiqueta)
    var w = 0, chars = text.split('');
    chars.forEach(function (c) { w += ctx.measureText(c).width + spacing; }); w -= spacing;
    var cx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    ctx.textAlign = 'left';
    chars.forEach(function (c) { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + spacing; });
    return w;
  }

  SH.render = function (cv) {
    var f = st.f, W = FORMATS[st.format][0], H = FORMATS[st.format][1];
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    var style = st.style === 'foto' && !st.photo ? 'creme' : st.style;
    var bg = { creme: C.cream, vermelho: C.red, azul: C.blue }[style];
    var ink = style === 'creme' ? C.dark : C.cream;           // números
    var accent = style === 'creme' ? C.red : C.cream;         // marca e destaques
    var soft = style === 'creme' ? 'rgba(30,30,30,.55)' : 'rgba(247,241,234,.78)';
    ctx.clearRect(0, 0, W, H);
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); }
    if (style === 'foto') {
      var im = st.photo, s = Math.max(W / im.width, H / im.height), iw = im.width * s, ih = im.height * s;
      ctx.drawImage(im, (W - iw) / 2, (H - ih) / 2, iw, ih);
      if (st.bw) {
        var data = ctx.getImageData(0, 0, W, H), p = data.data;
        for (var i = 0; i < p.length; i += 4) { var g = p[i] * .3 + p[i + 1] * .59 + p[i + 2] * .11; g = (g - 128) * 1.12 + 128; p[i] = p[i + 1] = p[i + 2] = g; }
        ctx.putImageData(data, 0, 0);
      }
      var gr = ctx.createLinearGradient(0, H * .35, 0, H);
      gr.addColorStop(0, 'rgba(20,20,20,0)'); gr.addColorStop(1, 'rgba(20,20,20,.82)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      var gt = ctx.createLinearGradient(0, 0, 0, 320); gt.addColorStop(0, 'rgba(20,20,20,.45)'); gt.addColorStop(1, 'rgba(20,20,20,0)');
      ctx.fillStyle = gt; ctx.fillRect(0, 0, W, 320);
    }
    if (style === 'transparente') { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 2; }
    var M = 84; // margem
    ctx.textBaseline = 'alphabetic';

    // topo: marca + data
    ctx.fillStyle = accent; ctx.font = 'italic 800 76px Aileron, "Barlow Condensed", sans-serif';
    ctx.textAlign = 'left'; ctx.fillText('RUNBASE', M, M + 60);
    ctx.fillStyle = soft; ctx.font = '700 30px Aileron, sans-serif';
    track(ctx, dateStr(f), W - M, M + 50, 4, 'right');

    // bloco de números, ancorado embaixo
    var km = f.distance_km ? RB.pace.fmtKm(+f.distance_km) : null;
    // fundo liso em stories: bloco no meio + frase da marca; foto/sem fundo: bloco embaixo
    var center = !!bg && st.format === 'story';
    var bottom = center ? Math.round(H * 0.64) : H - M - 96;
    var rowY = bottom - 40;                       // linha tempo / pace / rpe
    var bigY = rowY - 190;                         // distância
    // linhas finas estilo etiqueta vintage
    ctx.fillStyle = accent; ctx.fillRect(M, rowY - 112, W - 2 * M, 4);
    ctx.fillRect(M, bottom + 4, W - 2 * M, 4);

    // tipo do treino
    ctx.fillStyle = accent; ctx.font = '800 34px Aileron, sans-serif';
    var tY = bigY - (km ? 250 : 40);
    track(ctx, title(f), M, tY, 6);

    if (km) {
      ctx.fillStyle = ink;
      var size = fit(ctx, km, 'italic 800 {s}px Aileron, sans-serif', W - 2 * M - 170, 300);
      ctx.font = 'italic 800 ' + size + 'px Aileron, sans-serif';
      ctx.fillText(km, M - 6, bigY);
      var kw = ctx.measureText(km).width;
      ctx.fillStyle = accent; ctx.font = 'italic 800 80px Aileron, sans-serif';
      ctx.fillText('KM', M + kw + 14, bigY);
    } else {
      ctx.fillStyle = ink; ctx.font = 'italic 800 120px Aileron, sans-serif';
      ctx.fillText(f.kind === 'strength' ? 'FEITO.' : 'TREINO FEITO.', M - 4, bigY);
    }

    // tempo · pace · rpe
    var cols = [];
    if (f.duration_sec) cols.push(['TEMPO', RB.pace.fmtHMS(f.duration_sec)]);
    if (f.duration_sec && f.distance_km) cols.push(['PACE', RB.pace.fmtPace(f.duration_sec / f.distance_km) + '/km']);
    if (f.rpe) cols.push(['ESFORÇO', f.rpe + '/10']);
    var cw = (W - 2 * M) / Math.max(cols.length, 1);
    cols.forEach(function (c, i) {
      var x = M + i * cw;
      ctx.fillStyle = soft; ctx.font = '700 26px Aileron, sans-serif'; track(ctx, c[0], x, rowY - 56, 5);
      ctx.fillStyle = ink; ctx.font = 'italic 800 64px Aileron, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(c[1], x - 2, rowY + 14);
    });

    // rodapé
    if (center) {
      ctx.fillStyle = accent; ctx.font = 'italic 800 64px Aileron, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText("It's not about the pace.", M, bottom + 170);
      ctx.fillText("It's about the base.", M, bottom + 250);
    } else {
      ctx.fillStyle = soft; ctx.font = '400 28px Aileron, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText("It's not about the pace. It's about the base.", M, H - M + 6);
    }
    ctx.fillStyle = soft;
    ctx.font = '700 28px Aileron, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('@runbase__', W - M, H - M + 6);
    ctx.shadowColor = 'transparent';
    return cv;
  };
  SH.draw = function () {
    var cv = RB.$('share-cv'); if (!cv) return;
    SH.render(cv);
    var ph = RB.$('sh-photo'); if (ph) ph.style.display = st.style === 'foto' ? 'block' : 'none';
    var hint = RB.$('sh-hint'); if (hint) hint.style.display = st.style === 'transparente' ? 'block' : 'none';
    cv.parentNode.classList.toggle('checker', st.style === 'transparente');
  };

  function blob() {
    return new Promise(function (res) { RB.$('share-cv').toBlob(function (b) { res(b); }, 'image/png'); });
  }
  function fname() { return 'runbase-' + (st.f.performed_at || 'treino') + '-' + st.format + '.png'; }
  SH.go = async function () {
    var b = await blob(), file = new File([b], fname(), { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Meu treino · RUNBASE' }); } catch (e) { /* cancelado */ }
    } else {
      SH.download(); RB.toast('Imagem baixada — publique pela galeria');
    }
  };
  SH.download = async function () {
    var b = await blob(), url = URL.createObjectURL(b), a = document.createElement('a');
    a.href = url; a.download = fname(); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  };
})();
