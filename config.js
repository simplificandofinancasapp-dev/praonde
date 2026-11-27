// Configuração pública do banco de dados (Supabase), usada pelo app (src/api/supabase.ts) e pelo admin.html.
//
// Copie do painel do Supabase (Project Settings > API Keys):
//   - Project URL                                  -> supabaseUrl
//   - chave "publishable" (sb_publishable_…, pública) -> supabaseAnonKey
//
// ATENÇÃO: nunca coloque aqui a chave "secret" (sb_secret_…) / "service_role" nem a conta de serviço
// do Firebase. Tudo o que está neste arquivo é público: vai para o site, para dentro do APK e para os
// pacotes de atualização. Quem protege os dados são as regras (RLS) dos arquivos em supabase/.
// O node montar-site.js recusa publicar se encontrar uma chave secreta ou uma configuração vazia/local.
//
// Projeto na nuvem: puyhovfpsswnowdaqpzg. Para testar com o Supabase local (Docker), use
//   supabaseUrl: 'http://127.0.0.1:54321' e a "Publishable key" mostrada por: npx supabase status
//
// Assinatura (RevenueCat > Project settings > API keys): só as chaves PÚBLICAS do SDK.
//   - Google Play -> revenueCatAndroidKey (goog_…)      - App Store -> revenueCatIosKey (appl_…)
// Enquanto as duas estiverem vazias, a tela mostra "Assinatura em preparação" e nada é vendido.
// NUNCA coloque aqui a chave secreta do RevenueCat (sk_…): ela fica só no segredo da Edge Function
// subscription-sync. Passo a passo em docs/ASSINATURA.md.
window.APP_CONFIG = {
  supabaseUrl: 'https://puyhovfpsswnowdaqpzg.supabase.co',
  supabaseAnonKey: 'sb_publishable_fVkZ89Xh8SHEOs7Z6OLo0Q_RXoPH4Bj',
  revenueCatAndroidKey: 'goog_ApNtnzinNSUQcdKlujGsKKHJRvN',
  revenueCatIosKey: '',
};
