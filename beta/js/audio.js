// Run Base — áudio no feedback e na conversa: gravar, enviar e ouvir
(function () {
  var sb = RB.sb;
  var A = RB.audio = { blob: null, mime: '', id: null };
  var BUCKET = 'feedback-audio', MAX_SEC = 180;
  var mr = null, stream = null, chunks = [], timer = null, t0 = 0;

  A.supported = function () { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); };
  function pickMime() {
    var opts = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    for (var i = 0; i < opts.length; i++) { try { if (MediaRecorder.isTypeSupported(opts[i])) return opts[i]; } catch (e) {} }
    return '';
  }
  var fmt = function (s) { return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };

  // bloco de gravação (id único por tela)
  A.recorder = function (id, label) {
    if (!A.supported()) return '';
    A.reset();
    return '<div class="rec" id="rec-' + id + '"><button type="button" class="rec-b" onclick="RB.audio.toggle(\'' + id + '\')">🎤 ' + (label || 'Gravar áudio') + '</button><span class="rec-t"></span></div>';
  };
  A.reset = function () { A.blob = null; A.mime = ''; A.id = null; if (mr && mr.state === 'recording') { try { mr.stop(); } catch (e) {} } stopStream(); };
  function stopStream() { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; clearInterval(timer); }
  function box(id) { return RB.$('rec-' + id); }
  A.toggle = async function (id) {
    var el = box(id); if (!el) return;
    if (mr && mr.state === 'recording') { mr.stop(); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) { RB.toast('Libere o microfone para gravar', false); return; }
    var mime = pickMime();
    try { mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); } catch (e) { mr = new MediaRecorder(stream); }
    chunks = []; A.id = id;
    mr.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
    mr.onstop = function () {
      stopStream();
      A.mime = (mr.mimeType || mime || 'audio/webm').split(';')[0];
      A.blob = new Blob(chunks, { type: A.mime });
      var e2 = box(id); if (!e2) return;
      e2.classList.remove('on');
      e2.innerHTML = '<audio controls src="' + URL.createObjectURL(A.blob) + '"></audio><button type="button" class="mini ghost" onclick="RB.audio.discard(\'' + id + '\')">Descartar</button>';
      if (A.onReady) A.onReady(id);
    };
    mr.start(250); t0 = Date.now();
    el.classList.add('on');
    el.querySelector('.rec-b').textContent = '■ Parar';
    var tt = el.querySelector('.rec-t');
    timer = setInterval(function () {
      var s = (Date.now() - t0) / 1000; tt.textContent = 'gravando ' + fmt(s);
      if (s >= MAX_SEC) mr.stop();
    }, 250);
  };
  A.discard = function (id) {
    A.blob = null; var el = box(id); if (!el) return;
    el.outerHTML = A.recorder(id);
    if (A.onReady) A.onReady(id);
  };
  // envia o áudio gravado; a pasta é sempre a do aluno do feedback (assim aluno e coach conseguem ouvir)
  A.upload = async function (athleteId) {
    if (!A.blob) return null;
    var ext = /mp4|aac|m4a/.test(A.mime) ? 'm4a' : /ogg/.test(A.mime) ? 'ogg' : /mpeg/.test(A.mime) ? 'mp3' : 'webm';
    var type = ext === 'm4a' ? 'audio/mp4' : A.mime;
    var path = athleteId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.' + ext;
    var r = await sb.storage.from(BUCKET).upload(path, A.blob, { contentType: type, upsert: false });
    if (r.error) throw r.error;
    A.blob = null;
    return path;
  };

  // player: <audio data-path> ganha o link assinado quando aparece na tela
  A.player = function (path) { return path ? '<div class="aud" onclick="event.stopPropagation()"><audio controls preload="none" data-path="' + RB.esc(path) + '"></audio></div>' : ''; };
  var cache = {};
  async function hydrate(a) {
    var p = a.getAttribute('data-path'); if (!p || a.dataset.ok) return;
    a.dataset.ok = '1';
    if (cache[p] && cache[p].exp > Date.now()) { a.src = cache[p].url; return; }
    var r = await sb.storage.from(BUCKET).createSignedUrl(p, 3600);
    if (r.data && r.data.signedUrl) { cache[p] = { url: r.data.signedUrl, exp: Date.now() + 3500e3 }; a.src = r.data.signedUrl; }
  }
  A.hydrate = function (root) { (root || document).querySelectorAll('audio[data-path]').forEach(hydrate); };
  if (window.MutationObserver) {
    new MutationObserver(function () { A.hydrate(); }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
