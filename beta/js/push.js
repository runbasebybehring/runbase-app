// Run Base — notificações no celular (web push)
(function () {
  var sb = RB.sb;
  var N = RB.push = {};
  var KEY = 'BNoyE5usu4SGtpHQ9FuJkc7shn2MCB70Cf0wgORYXjxAjT-dHvPtCvMBYrqxnDAMfE5IRvt4LxLQCpcYwgiN1dI';
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  N.supported = function () { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; };
  N.granted = function () { return N.supported() && Notification.permission === 'granted'; };
  var b64 = function (s) {
    var pad = '='.repeat((4 - s.length % 4) % 4), raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out;
  };
  var enc = function (buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };

  async function save(sub) {
    var j = sub.toJSON();
    await sb.from('push_subscriptions').delete().eq('endpoint', j.endpoint); // se outra conta usou este aparelho
    return sb.from('push_subscriptions').upsert({ endpoint: j.endpoint, user_id: RB.state.user.id, p256dh: j.keys.p256dh || enc(sub.getKey('p256dh')), auth: j.keys.auth || enc(sub.getKey('auth')) });
  }
  N.enable = async function (btn) {
    if (!N.supported()) {
      RB.toast(ios && !RB.isStandalone() ? 'No iPhone, instale o app na tela inicial primeiro' : 'Este navegador não aceita notificações', false);
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = 'ATIVANDO...'; }
    try {
      var perm = await Notification.requestPermission();
      if (perm !== 'granted') { RB.toast('Notificações bloqueadas. Libere nas configurações do navegador.', false); return; }
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(KEY) });
      var r = await save(sub);
      if (r.error) throw r.error;
      N.dismiss();
      RB.toast('Notificações ativadas ✓');
      N.notify({ type: 'test' });
    } catch (e) {
      RB.toast('Não foi possível ativar agora', false);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'ATIVAR'; }
    }
  };
  // garante que este aparelho está ligado à conta logada
  N.sync = async function () {
    if (!N.granted()) return;
    try { var reg = await navigator.serviceWorker.ready; var sub = await reg.pushManager.getSubscription(); if (sub) await save(sub); } catch (e) {}
  };
  // ao sair, este aparelho deixa de receber notificações da conta
  N.unlink = async function () {
    if (!N.supported()) return;
    try { var reg = await navigator.serviceWorker.getRegistration(); var sub = reg && await reg.pushManager.getSubscription(); if (sub) await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); } catch (e) {}
  };
  N.notify = function (body, okMsg) {
    return sb.functions.invoke('notify', { body: body }).then(function (r) { if (okMsg && !r.error) RB.toast(okMsg); }).catch(function () {});
  };

  N.dismiss = function () { try { localStorage.setItem('rb_push_card', '1'); } catch (e) {} var c = RB.$('push-card'); if (c) c.remove(); };
  N.card = function () {
    if (N.granted()) return '';
    try { if (localStorage.getItem('rb_push_card')) return ''; } catch (e) {}
    var needInstall = ios && !RB.isStandalone();
    if (!N.supported() && !needInstall) return '';
    var coach = RB.state.isCoach;
    var why = coach ? 'Saiba na hora quando um aluno der feedback ou relatar dor.' : 'Receba as respostas do coach, relatórios e lembretes do treino do dia.';
    return '<div class="card install" id="push-card">' + RB.ew('🔔 Notificações', 'blue') + '<div class="install-t">' + why +
      (needInstall ? '<br><br>No iPhone: primeiro toque em <strong>Compartilhar → Adicionar à Tela de Início</strong> e abra o app por lá.' : '') + '</div>' +
      '<div class="install-a">' + (needInstall ? '' : '<button class="btn btn-r sm" onclick="RB.push.enable(this)">ATIVAR</button>') +
      '<button class="btn btn-o sm" onclick="RB.push.dismiss()">Agora não</button></div></div>';
  };

  // clique na notificação com o app já aberto
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (ev) {
      if (ev.data && ev.data.tab) RB.openTab(ev.data.tab);
    });
  }
})();
