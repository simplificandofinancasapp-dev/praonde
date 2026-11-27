// Página instalar.html: mostra só o passo a passo do aparelho de quem abriu o link.
// Quando o app estiver na loja (acesso de produção aprovado), troque PLAY_URL pelo endereço público:
//   https://play.google.com/store/apps/details?id=br.com.marileilopes.simplificandofinancas
(function () {
  var PLAY_URL = 'https://play.google.com/apps/testing/br.com.marileilopes.simplificandofinancas';
  var ua = navigator.userAgent || '';
  var isAndroid = /Android/i.test(ua);
  // iPadOS 13+ se apresenta como Mac com tela de toque.
  var isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  var isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|Instagram|FBAN|FBAV|WhatsApp/i.test(ua);

  var play = document.getElementById('btn-play');
  if (play) play.href = PLAY_URL;

  function show(id, on) { var el = document.getElementById(id); if (el) el.hidden = !on; }
  show('android', isAndroid || (!isIOS && !isAndroid));
  show('iphone', isIOS || (!isIOS && !isAndroid));
  show('outro', !isIOS && !isAndroid);
  // Em celular, o cartão do outro sistema fica escondido; no computador mostramos os dois.
  if (isAndroid) show('iphone', false);
  if (isIOS) show('android', false);
  show('aviso-safari', isIOS && !isSafari);

  var botao = document.getElementById('btn-copiar'), aviso = document.getElementById('copiado');
  var endereco = location.href.split('#')[0];
  if (botao) botao.addEventListener('click', function () {
    function ok() { if (aviso) aviso.textContent = 'Endereço copiado. Cole no navegador do celular.'; }
    function falhou() { if (aviso) aviso.textContent = 'Não consegui copiar. Segure o endereço na barra do navegador para copiar.'; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(endereco).then(ok, falhou);
    else falhou();
  });
})();
