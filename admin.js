'use strict';
/* PraOnde (antigo Simplificando Finanças) — painel de administração (admin.html), JavaScript puro.
   Modo REAL: lê do Supabase com a conta logada, que precisa estar em sf_private.admins
   (supabase/admin.sql, ota.sql e 003_push.sql). Modo DEMONSTRAÇÃO (admin.html?demo ou sem acesso):
   dados fictícios gerados no navegador; nada é gravado nem enviado.
   Privacidade: o painel NUNCA lê lançamentos, valores, metas, preferências ou o nome de exibição. */

const DAY = 86400000;
const PREFIXO_PACOTE = 'simplificando-financas-';
const TZ = 'America/Sao_Paulo';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('pt-BR', {timeZone: TZ}) : '—');
const fmtDay = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');     // 'AAAA-MM-DD' sem fuso
const fmtDateTime = (d) => new Date(d).toLocaleString('pt-BR', {timeZone: TZ, dateStyle: 'short', timeStyle: 'short'});
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const ago = (d) => { if (!d) return 'nunca'; const n = Math.floor((Date.now() - new Date(d)) / DAY); return n <= 0 ? 'hoje' : n === 1 ? 'ontem' : `há ${n} dias`; };
const hoje = () => new Intl.DateTimeFormat('en-CA', {timeZone: TZ}).format(new Date());   // AAAA-MM-DD
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
const ok = (res) => { if (res.error) throw res.error; return res.data; };
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200);
}

// ---------- conexão ----------
const CFG = window.APP_CONFIG || {};
let sb = null;
try {
  if (CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase) {
    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: false}});
  }
} catch { sb = null; }

let me = null;            // usuário logado (a sessão é a mesma do app, no mesmo endereço)
let isAdmin = false;      // confirmado pelo banco (sfc_is_admin)
let realError = '';       // por que o modo real não está disponível
let mode = 'demo';        // 'demo' | 'real'
let data = null;          // { users, feedback, releases, push }
let tab = 'usuarios';
let userQuery = '';
let enviando = false;
const envios = [];        // notificações enviadas nesta sessão do painel

// ---------- dados fictícios ----------
function demoData() {
  let seed = 20261114;
  const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const first = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elaine', 'Fábio', 'Gabriela', 'Heitor', 'Isabela', 'João', 'Karina', 'Lucas', 'Mariana', 'Nelson', 'Olívia', 'Paulo', 'Rafaela'];
  const last = ['Almeida', 'Barros', 'Cardoso', 'Dias', 'Ferraz', 'Gomes', 'Lima', 'Moraes', 'Nunes', 'Oliveira', 'Pires', 'Ramos', 'Souza', 'Teixeira'];
  const now = Date.now(), iso = (t) => new Date(t).toISOString(), dia = (t) => new Date(t).toISOString().slice(0, 10);
  const users = [];
  for (let i = 0; i < 17; i++) {
    const inicio = now - Math.floor(rnd() * 40) * DAY;
    const fim = new Date(inicio); fim.setMonth(fim.getMonth() + 1);
    const parou = rnd() < 0.25;
    const visto = parou ? inicio + rnd() * (now - inicio) * 0.5 : now - rnd() * 6 * DAY;
    const f = first[i], l = pick(last);
    users.push({
      user_id: 'demo-' + i, name: `${f} ${l}`, participant: true,
      email: `${f}.${l}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '@exemplo.com',
      start_date: dia(inicio), end_date: dia(fim), created_at: iso(inicio), last_seen_at: iso(visto),
      app_version: parou ? pick(['1.0.0', '1.0.1']) : rnd() < 0.7 ? '1.0.2' : '1.0.1',
      platform: pick(['android', 'android', 'android', 'ios', 'web']),
    });
  }
  users.push({user_id: 'demo-admin', name: '', participant: false, email: 'administracao@exemplo.com', start_date: null, end_date: null,
    created_at: iso(now - 80 * DAY), last_seen_at: iso(now), app_version: '1.0.2', platform: 'web'});
  users.sort((a, b) => String(b.start_date || '').localeCompare(String(a.start_date || '')));

  const textos = [
    ['Ver para onde o dinheiro vai no fim do mês.', 'Queria lembrete das contas a vencer.', 'Pela primeira vez consegui guardar um pouco todo mês.'],
    ['O registro por voz economiza tempo.', 'Às vezes a voz entende o valor errado.', 'Uso no ônibus, na volta do trabalho.'],
    ['A divisão em prioridades.', '', 'Me ajudou a conversar sobre dinheiro em casa.'],
    ['Os avisos do diagnóstico do mês.', 'Gráficos maiores no celular.', 'Estou mais tranquila com as contas.'],
    ['Simples de usar.', 'Importar o extrato do banco.', 'Comecei a anotar tudo, até o cafezinho.'],
    ['O sonho com prazo e valor.', 'Mais exemplos de metas.', 'Já juntei a primeira parte da reserva.'],
    ['', 'Tema escuro mais contrastado.', 'Gostei, mas esqueço de abrir o app.'],
    ['Separar o salário bruto dos descontos.', 'Explicar melhor o FGTS.', 'Entendi meu contracheque.'],
  ];
  const feedback = textos.map(([helpful, improvement, experience], k) => {
    const u = users[k * 2 % 17];
    return {id: 'fb-' + k, owner: u.user_id, created: iso(now - (k * 4 + rnd() * 3) * DAY), rating: k === 6 ? 3 : k === 1 || k === 4 ? 4 : 5, helpful, improvement, experience};
  });
  const releases = [
    {id: uid(), version: '1.0.2', notes: 'Ajustes no diagnóstico do mês.', mandatory: false, active: true, min_native: 1, size_bytes: 412000, created_at: iso(now - 5 * DAY), bundle_url: '#', checksum: ''},
    {id: uid(), version: '1.0.1', notes: 'Correção no registro por voz.', mandatory: true, active: true, min_native: 1, size_bytes: 409000, created_at: iso(now - 26 * DAY), bundle_url: '#', checksum: ''},
  ];
  const perUser = users.filter((u) => u.platform !== 'web' && u.participant).map((u) => ({user_id: u.user_id, devices: rnd() < 0.2 ? 2 : 1, updated_at: u.last_seen_at}));
  const plataformas = {};
  for (const p of perUser) { const pl = users.find((u) => u.user_id === p.user_id).platform; plataformas[pl] = (plataformas[pl] || 0) + p.devices; }
  const push = {devices: perUser.reduce((s, p) => s + p.devices, 0), users: perUser.length, platforms: plataformas, per_user: perUser};
  return {users, feedback, releases, push};
}

// ---------- dados reais ----------
async function realData() {
  const [users, fb, rel, push] = await Promise.all([
    sb.rpc('sfc_admin_users'),
    sb.from('sfc_pilot_feedback').select('id,owner,created,rating,helpful,improvement,experience').order('created', {ascending: false}),
    sb.from('app_releases').select('*').order('created_at', {ascending: false}),
    sb.rpc('sfc_admin_push_summary'),
  ]);
  if (users.error) throw new Error(/sfc_admin_users/.test(users.error.message || '') ? 'rode supabase/admin.sql no banco' : users.error.message);
  return {
    users: users.data || [],
    feedback: fb.error ? null : fb.data,
    releases: rel.error ? null : rel.data,
    push: push.error ? null : push.data,
  };
}

// ---------- cálculos ----------
function situacao(u) {
  if (!u.participant) return {txt: 'sem inscrição', cls: ''};
  const h = hoje();
  if (u.start_date && h < u.start_date) return {txt: 'a começar', cls: ''};
  if (u.end_date && h >= u.end_date) return {txt: 'encerrado', cls: 'bad'};
  return {txt: 'em teste', cls: 'ok'};
}
const aparelhosDe = (id) => (data.push && data.push.per_user ? (data.push.per_user.find((p) => p.user_id === id) || {}).devices || 0 : 0);
const pessoa = (id) => data.users.find((u) => u.user_id === id);
const nomeDe = (id) => { const u = pessoa(id); return u ? u.name || u.email : 'Conta removida'; };
const newerVersion = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
const PLATAFORMA = {android: 'Android', ios: 'iOS', web: 'Navegador'};

// ---------- pedaços de tela ----------
const kpi = (label, value, sub = '', hero = false) => `<div class="kpi${hero ? ' hero' : ''}"><small>${esc(label)}</small><b>${esc(value)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
const meter = (label, value, total) => `<div class="meter"><div><span>${esc(label)}</span><span><b>${value}</b> · ${pct(value, total)}%</span></div><div class="bar"><i style="width:${pct(value, total)}%"></i></div></div>`;
const estrelas = (n) => `<span class="stars" aria-label="${n} de 5">${'★'.repeat(n)}${'☆'.repeat(Math.max(0, 5 - n))}</span>`;
const falta = (arquivo) => `<div class="card"><p>Esta parte ainda não existe no banco. Rode <b>${esc(arquivo)}</b> no SQL Editor do Supabase.</p></div>`;

const TABS = [['usuarios', 'Usuários'], ['avaliacoes', 'Avaliações'], ['versoes', 'Versões'], ['notificacoes', 'Notificações']];

function render() {
  $('#who').innerHTML = me
    ? `▸ ${esc(me.email)}${isAdmin ? ' · administradora' : ''} <button class="btn small" data-action="logout">Sair</button>`
    : '▸ Sem login';
  $('#modeChips').innerHTML = `<button aria-pressed="${mode === 'demo'}" data-mode="demo">Demonstração</button><button aria-pressed="${mode === 'real'}" data-mode="real">Dados reais</button>`;
  $('#banner').innerHTML = (mode === 'demo'
    ? `<div class="banner"><b>Demonstração:</b> nomes, e-mails e números desta tela são fictícios. As ações funcionam, mas nada é gravado nem enviado.${realError ? ` <span>Dados reais indisponíveis: ${esc(realError)}.</span>` : ''}</div>`
    : '') + (sb && !me ? loginForm() : '');
  if (!data) { $('#nav').innerHTML = ''; $('#view').innerHTML = '<p class="muted">Carregando…</p>'; return; }
  $('#nav').innerHTML = TABS.map(([id, l]) => `<button role="tab" aria-pressed="${tab === id}" data-tab="${id}">${l}</button>`).join('');
  $('#view').innerHTML = ({usuarios: viewUsuarios, avaliacoes: viewAvaliacoes, versoes: viewVersoes, notificacoes: viewNotificacoes})[tab]();
}

function loginForm() {
  return `<div class="card login"><h2>Entrar como administradora</h2>
    <p class="muted" style="margin-top:0">Use o mesmo e-mail e senha do app. A conta precisa estar cadastrada como administradora no banco.</p>
    <form id="loginForm"><label>E-mail<input type="email" name="email" autocomplete="username" required></label>
      <label>Senha<input type="password" name="password" autocomplete="current-password" required></label>
      <div class="actions"><button class="btn primary">Entrar</button></div></form></div>`;
}

function viewUsuarios() {
  const q = userQuery.trim().toLowerCase();
  const list = data.users.filter((x) => !q || `${x.name} ${x.email}`.toLowerCase().includes(q));
  const part = data.users.filter((u) => u.participant);
  const ativos = (dias) => data.users.filter((u) => u.last_seen_at && Date.now() - new Date(u.last_seen_at) <= dias * DAY).length;
  const emTeste = part.filter((u) => situacao(u).txt === 'em teste').length;
  const encerrados = part.filter((u) => situacao(u).txt === 'encerrado').length;
  return `
    <div class="kpis">
      ${kpi('Participantes do teste', part.length, `${data.users.length} conta(s) no total`, true)}
      ${kpi('Em teste agora', emTeste)}
      ${kpi('Teste encerrado', encerrados)}
      ${kpi('Ativos em 7 dias', ativos(7), `${ativos(30)} em 30 dias`)}
    </div>
    <div class="card">
      <header><h2>Pessoas cadastradas</h2><button class="btn small" data-action="csv">Exportar contatos (CSV)</button></header>
      <input id="userSearch" type="search" placeholder="Buscar por nome ou e-mail" value="${esc(userQuery)}" aria-label="Buscar por nome ou e-mail">
      <div class="tablewrap" style="margin-top:10px"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Início do teste</th><th>Fim do teste</th><th>Situação</th><th>Último acesso</th><th>Versão do app</th><th>Plataforma</th><th>Aparelhos com aviso</th></tr></thead><tbody>
      ${list.map((x) => { const s = situacao(x); return `<tr><td>${esc(x.name || '—')}</td><td>${esc(x.email)}</td><td>${fmtDay(x.start_date)}</td><td>${fmtDay(x.end_date)}</td>
        <td><span class="tag ${s.cls}">${s.txt}</span></td><td title="${x.last_seen_at ? esc(fmtDateTime(x.last_seen_at)) : ''}">${ago(x.last_seen_at)}</td>
        <td>${esc(x.app_version || '—')}</td><td>${esc(PLATAFORMA[x.platform] || '—')}</td><td>${aparelhosDe(x.user_id) || '—'}</td></tr>`; }).join('') || '<tr><td colspan="9">Ninguém encontrado.</td></tr>'}
      </tbody></table></div>
      <small>${list.length} de ${data.users.length} conta(s). O teste vale do início até o dia anterior ao fim. Lançamentos, valores e metas não aparecem para a administração.</small>
    </div>`;
}

function viewAvaliacoes() {
  if (!data.feedback) return falta('supabase/001_sfc_schema.sql');
  const fb = data.feedback, n = fb.length;
  const media = n ? fb.reduce((s, f) => s + Number(f.rating || 0), 0) / n : 0;
  const pessoas = new Set(fb.map((f) => f.owner)).size;
  return `
    <div class="kpis">
      ${kpi('Avaliações recebidas', n, '', true)}
      ${kpi('Nota média', n ? media.toFixed(1).replace('.', ',') + ' de 5' : '—')}
      ${kpi('Pessoas que avaliaram', pessoas, `${pct(pessoas, data.users.filter((u) => u.participant).length)}% dos participantes`)}
    </div>
    <div class="cols">
      <div class="card"><h2>Notas</h2>${[5, 4, 3, 2, 1].map((k) => meter(`${k} estrela${k > 1 ? 's' : ''}`, fb.filter((f) => Number(f.rating) === k).length, n)).join('')}</div>
      <div class="card"><h2>Como ler</h2><p class="muted" style="margin:0">As respostas vêm do formulário de avaliação do app. Elas não são publicadas automaticamente. Para responder, use a conversa com a participante dentro do app.</p></div>
    </div>
    <div class="card"><h2>Respostas</h2>
      ${fb.map((f) => `<div class="feedback">
        <p>${estrelas(Number(f.rating) || 0)} <b>${esc(nomeDe(f.owner))}</b> <small>${esc((pessoa(f.owner) || {}).email || '')} · ${fmtDateTime(f.created)}</small></p>
        ${f.helpful ? `<p><b>O que ajudou:</b> ${esc(f.helpful)}</p>` : ''}
        ${f.improvement ? `<p><b>O que melhorar:</b> ${esc(f.improvement)}</p>` : ''}
        ${f.experience ? `<p>${esc(f.experience)}</p>` : ''}
      </div>`).join('') || '<p class="muted">Nenhuma avaliação ainda.</p>'}
    </div>`;
}

function viewVersoes() {
  if (!data.releases) return falta('supabase/ota.sql');
  const rel = [...data.releases].sort((a, b) => (newerVersion(a.version, b.version) ? -1 : 1));
  const current = rel.find((r) => r.active);
  const known = data.users.filter((u) => u.app_version);
  const byVersion = {};
  for (const u of known) byVersion[u.app_version] = (byVersion[u.app_version] || 0) + 1;
  const next = current ? current.version.replace(/(\d+)$/, (n) => String(+n + 1)) : '1.0.1';
  return `
    <div class="kpis">
      ${kpi('Versão em distribuição', current ? current.version : '—', current ? 'publicada em ' + fmtDate(current.created_at) : 'nenhuma versão ativa', true)}
      ${kpi('Pessoas nessa versão', current ? (byVersion[current.version] || 0) : 0, known.length ? pct(current ? byVersion[current.version] || 0 : 0, known.length) + '% das que informaram versão' : 'sem dados ainda')}
      ${kpi('Versões publicadas', rel.length)}
    </div>
    <div class="cols">
      <div class="card"><h2>Publicar atualização</h2>
        <p class="muted">Gere o pacote com <b>node empacotar-atualizacao.js ${esc(next)}</b> e envie o arquivo .zip da pasta <b>atualizacoes</b>.</p>
        <form id="releaseForm">
          <label>Pacote (.zip)<input class="field" type="file" name="file" accept=".zip,application/zip" required></label>
          <div class="row"><label>Versão<input class="field" name="version" required pattern="\\d+\\.\\d+\\.\\d+" placeholder="${esc(next)}"></label>
            <label>Versão mínima do app instalado<input class="field" name="min_native" inputmode="decimal" value="1.0"></label></div>
          <label>O que mudou<textarea name="notes" rows="2" maxlength="500" placeholder="Resumo para o seu controle."></textarea></label>
          <label class="check"><input type="checkbox" name="mandatory"><span>Obrigatória (aplica na hora, sem esperar reabrir)</span></label>
          <div class="actions"><span class="grow"></span><button class="btn primary">Publicar</button></div>
        </form></div>
      <div class="card"><h2>Pessoas por versão</h2>
        ${Object.keys(byVersion).sort((a, b) => (newerVersion(a, b) ? -1 : 1)).map((v) => meter('Versão ' + v, byVersion[v], known.length)).join('') || '<p class="muted">Ainda sem dados. A versão é registrada quando a pessoa entra no app.</p>'}
        <small>O app troca de versão quando vai para segundo plano ou na abertura seguinte, então a adoção leva alguns dias.</small></div>
    </div>
    <div class="card"><h2>Histórico</h2><div class="tablewrap"><table><thead><tr><th>Versão</th><th>Publicada</th><th>Tamanho</th><th>App mín.</th><th>Tipo</th><th>Situação</th><th></th></tr></thead><tbody>
      ${rel.map((r) => `<tr><td><b>${esc(r.version)}</b></td><td>${fmtDate(r.created_at)}</td><td>${Math.round((r.size_bytes || 0) / 1024)} KB</td><td>${esc(r.min_native)}</td>
        <td>${r.mandatory ? 'obrigatória' : 'normal'}</td><td><span class="tag ${r.active ? 'ok' : 'bad'}">${r.active ? 'ativa' : 'pausada'}</span></td>
        <td><button class="btn small" data-release="${esc(r.id)}">${r.active ? 'Pausar' : 'Reativar'}</button></td></tr>
        ${r.notes ? `<tr><td colspan="7" class="wrap muted" style="border-top:0">${esc(r.notes)}</td></tr>` : ''}`).join('') || '<tr><td colspan="7">Nenhuma versão publicada.</td></tr>'}
    </tbody></table></div>
    <small>Pausar uma versão faz os aparelhos que estão nela voltarem para a versão que veio no app instalado e depois buscarem a versão ativa mais recente.</small></div>`;
}

function viewNotificacoes() {
  if (!data.push) return falta('supabase/003_push.sql');
  const p = data.push, pl = p.platforms || {};
  const comAparelho = (p.per_user || []).map((x) => ({...x, u: pessoa(x.user_id)})).sort((a, b) => nomeDe(a.user_id).localeCompare(nomeDe(b.user_id), 'pt-BR'));
  return `
    <div class="kpis">
      ${kpi('Aparelhos registrados', p.devices || 0, 'recebem notificações', true)}
      ${kpi('Pessoas com aparelho', p.users || 0, `${pct(p.users || 0, data.users.length)}% das contas`)}
      ${kpi('Android', pl.android || 0)}
      ${kpi('iOS', pl.ios || 0)}
    </div>
    <div class="cols">
      <div class="card"><h2>Enviar notificação</h2>
        <form id="pushForm">
          <label>Para quem<select name="target">
            <option value="">Todos os aparelhos (${p.devices || 0})</option>
            ${comAparelho.map((x) => `<option value="${esc(x.user_id)}">${esc(x.u ? (x.u.name ? `${x.u.name} — ${x.u.email}` : x.u.email) : x.user_id)} (${x.devices} aparelho${x.devices > 1 ? 's' : ''})</option>`).join('')}
          </select></label>
          <label>Título<input class="field" name="title" maxlength="65" required placeholder="Ex.: Nova versão do app"></label>
          <label>Mensagem<textarea name="body" rows="3" maxlength="240" required placeholder="Texto curto. Não inclua valores, senhas ou dados pessoais."></textarea></label>
          <div class="actions"><small class="grow">Chega como notificação do sistema no celular.</small><button class="btn primary" ${enviando ? 'disabled' : ''}>${enviando ? 'Enviando…' : 'Enviar'}</button></div>
        </form>
        ${envios.length ? `<div class="result" role="status">${resumoEnvio(envios[0])}</div>` : ''}
      </div>
      <div class="card"><h2>Como funciona</h2>
        <p class="muted" style="margin-top:0">O aparelho aparece aqui depois que a pessoa entra no app instalado e permite notificações. Quem usa só o navegador não recebe.</p>
        <p class="muted">O envio passa pela função <b>send-push</b> do Supabase, que confere se você é administradora e usa o Firebase Cloud Messaging. Aparelhos que não existem mais (app desinstalado) são removidos sozinhos.</p>
        ${envios.length ? `<h3 style="font-size:1rem;margin-top:14px">Enviadas nesta sessão</h3>${envios.map((e) => `<p style="margin:.3em 0"><b>${esc(e.titulo)}</b> <small>${esc(e.para)} · ${fmtDateTime(e.em)} · ${e.resultado.enviados} de ${e.resultado.aparelhos}</small></p>`).join('')}` : ''}
      </div>
    </div>`;
}
function resumoEnvio(e) {
  const r = e.resultado;
  return `<b>${esc(e.titulo)}</b> → ${esc(e.para)}<br>${r.enviados} enviada(s) de ${r.aparelhos} aparelho(s)` +
    `${r.falhas ? `, ${r.falhas} falha(s)` : ''}${r.removidos ? `, ${r.removidos} aparelho(s) sem o app removido(s)` : ''}.` +
    `${(r.erros || []).length ? `<br><small>${r.erros.map(esc).join('<br>')}</small>` : ''}${e.demo ? '<br><small>Demonstração: nada foi enviado.</small>' : ''}`;
}

// ---------- ações ----------
async function setMode(next) {
  if (next === 'real' && !isAdmin) { toast(realError ? 'Dados reais indisponíveis: ' + realError + '.' : 'Dados reais indisponíveis.'); return; }
  mode = next; data = null; render();
  try { data = mode === 'real' ? await realData() : demoData(); }
  catch (e) { realError = 'falha ao carregar (' + (e.message || e) + ')'; mode = 'demo'; data = demoData(); }
  render();
}

async function verificarAcesso() {
  isAdmin = false; realError = '';
  if (!sb) { realError = 'config.js sem a URL e a chave pública do Supabase'; return; }
  try {
    const s = await sb.auth.getSession();
    me = s.data && s.data.session ? s.data.session.user : null;
    if (!me) { realError = 'entre com uma conta de administradora'; return; }
    const r = await sb.rpc('sfc_is_admin');
    if (r.error) realError = 'o banco ainda não tem a estrutura do PraOnde (rode supabase/001_sfc_schema.sql)';
    else if (!r.data) realError = 'esta conta não está na lista de administradoras (sf_private.admins)';
    else isAdmin = true;
  } catch { realError = 'sem conexão com o servidor'; }
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset;
  if (d.mode) setMode(d.mode);
  else if (d.tab) { tab = d.tab; render(); }
  else if (d.release) toggleRelease(d.release);
  else if (d.action === 'logout') {
    try { await sb.auth.signOut(); } catch { /* sessão local some de qualquer jeito */ }
    me = null; await verificarAcesso(); await setMode('demo');
  } else if (d.action === 'csv') exportarCsv();
});

function exportarCsv() {
  const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  const rows = [['Nome', 'E-mail', 'Início do teste', 'Fim do teste', 'Situação', 'Último acesso', 'Versão do app']]
    .concat(data.users.map((x) => [x.name, x.email, fmtDay(x.start_date), fmtDay(x.end_date), situacao(x).txt, x.last_seen_at ? fmtDate(x.last_seen_at) : '', x.app_version]));
  const csv = '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
  const fileName = `contatos-praonde${mode === 'demo' ? '-demonstracao' : ''}.csv`;
  const P = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() ? (window.Capacitor.Plugins || {}) : null;
  if (P) {   // dentro do app: usa o "Compartilhar" do sistema
    if (!P.Filesystem || !P.Share) return toast('Para exportar, abra o painel no navegador.');
    P.Filesystem.writeFile({path: fileName, data: csv, directory: 'CACHE', encoding: 'utf8'})
      .then((r) => P.Share.share({title: fileName, files: [r.uri], dialogTitle: 'Salvar ou enviar o arquivo'}))
      .catch((err) => { if (!/cancel/i.test(String((err && err.message) || err))) toast('Não foi possível exportar o arquivo.'); });
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
  a.download = fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function toggleRelease(id) {
  const r = data.releases.find((x) => x.id === id); if (!r) return;
  if (r.active && !confirm('Pausar a versão ' + r.version + '? Os aparelhos que estão nela voltam para a versão do app instalado.')) return;
  try {
    if (mode === 'real') ok(await sb.from('app_releases').update({active: !r.active}).eq('id', id));
    r.active = !r.active; render(); toast('Versão ' + r.version + (r.active ? ' reativada' : ' pausada') + (mode === 'real' ? '.' : ' (demonstração).'));
  } catch (err) { toast('Não foi possível alterar: ' + (err.message || err)); }
}

async function publishRelease(form) {
  const file = form.file.files[0], version = form.version.value.trim();
  if (!file) return toast('Escolha o arquivo .zip.');
  if (!/^\d+\.\d+\.\d+$/.test(version)) return toast('Use a versão no formato 1.2.3.');
  if (data.releases.some((r) => r.version === version)) return toast('A versão ' + version + ' já foi publicada. Use um número maior.');
  const row = {version, notes: form.notes.value.trim(), mandatory: form.mandatory.checked, min_native: parseFloat(String(form.min_native.value).replace(',', '.')) || 1, size_bytes: file.size, active: true};
  try {
    toast('Enviando pacote…');
    const buf = await file.arrayBuffer();
    row.checksum = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map((b) => b.toString(16).padStart(2, '0')).join('');
    if (mode === 'real') {
      const name = PREFIXO_PACOTE + version + '.zip';
      ok(await sb.storage.from('app-bundles').upload(name, file, {contentType: 'application/zip', upsert: false}));
      row.bundle_url = sb.storage.from('app-bundles').getPublicUrl(name).data.publicUrl;
      data.releases.push(ok(await sb.from('app_releases').insert(row).select().single()));
    } else {
      data.releases.push({id: uid(), bundle_url: '#', created_at: new Date().toISOString(), ...row});
    }
    render(); toast('Versão ' + version + ' publicada' + (mode === 'real' ? '.' : ' (demonstração).'));
  } catch (err) { toast('Não foi possível publicar: ' + (err.message || err)); }
}

async function enviarPush(form) {
  const title = form.title.value.trim(), body = form.body.value.trim(), target = form.target.value;
  if (!title || !body) return toast('Preencha título e mensagem.');
  const alvo = target ? (data.push.per_user || []).find((x) => x.user_id === target) : null;
  const qtd = alvo ? alvo.devices : data.push.devices || 0;
  const para = target ? nomeDe(target) : 'todos';
  if (!qtd) return toast('Nenhum aparelho registrado para esse destino.');
  if (!confirm(`Enviar "${title}" para ${qtd} aparelho(s) (${para})?`)) return;
  enviando = true; render();
  try {
    let resultado;
    if (mode === 'real') {
      const {data: res, error} = await sb.functions.invoke('send-push', {body: {title, body, ...(target ? {user_id: target} : {})}});
      if (error) {
        let msg = error.message || String(error);
        try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch { /* resposta sem JSON */ }
        throw new Error(msg);
      }
      resultado = res;
      if (resultado.removidos) data.push = ok(await sb.rpc('sfc_admin_push_summary'));
    } else {
      resultado = {aparelhos: qtd, enviados: qtd, falhas: 0, removidos: 0, erros: []};
    }
    envios.unshift({titulo: title, para, em: new Date().toISOString(), resultado, demo: mode !== 'real'});
    form.reset();
    toast(`${resultado.enviados} notificação(ões) enviada(s)${mode === 'real' ? '.' : ' (demonstração).'}`);
  } catch (err) {
    toast('Não foi possível enviar: ' + (err.message || err));
  } finally { enviando = false; render(); }
}

document.addEventListener('change', (e) => {
  // preenche a versão a partir do nome do arquivo (simplificando-financas-1.0.1.zip)
  if (e.target.name === 'file' && e.target.form && e.target.form.id === 'releaseForm' && e.target.files[0]) {
    const m = e.target.files[0].name.match(/(\d+\.\d+\.\d+)/);
    if (m && !e.target.form.version.value) e.target.form.version.value = m[1];
  }
});
document.addEventListener('submit', async (e) => {
  const f = e.target;
  if (!['releaseForm', 'pushForm', 'loginForm'].includes(f.id)) return;
  e.preventDefault();
  if (f.id === 'releaseForm') return publishRelease(f);
  if (f.id === 'pushForm') return enviarPush(f);
  try {
    const r = await sb.auth.signInWithPassword({email: f.email.value.trim(), password: f.password.value});
    if (r.error) throw r.error;
    await verificarAcesso();
    if (!isAdmin) toast('Entrou, mas ' + realError + '.');
    await setMode(isAdmin ? 'real' : 'demo');
  } catch (err) { toast('Não foi possível entrar: ' + (err.message || err)); }
});
document.addEventListener('input', (e) => {
  if (e.target.id !== 'userSearch') return;
  userQuery = e.target.value; render();
  const s = $('#userSearch'); s.focus(); s.setSelectionRange(s.value.length, s.value.length);
});

// ---------- início ----------
(async function init() {
  await verificarAcesso();
  const wantDemo = new URLSearchParams(location.search).has('demo');
  await setMode(isAdmin && !wantDemo ? 'real' : 'demo');
})();
