// Conexão com o banco na nuvem (Supabase › Project Settings › API).
// A chave "publishable"/"anon" é pública por natureza: quem protege os dados são as regras
// instaladas por supabase/instalar.sql. NUNCA coloque aqui a chave "service_role"/"secret".
// Com os campos vazios, os apps funcionam só no modo demonstração (dados neste navegador).
export const CONFIG = {
  supabaseUrl: 'https://sizbmkvzcqiukprdlxxr.supabase.co',
  supabaseKey: 'sb_publishable_q_RZZb3Uoz5DTweHbSueTA_MsvHJmVj',
};
