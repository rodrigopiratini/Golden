-- Golden CRM — instalação do banco no Supabase (gerado por supabase/gerar.mjs; não edite à mão)
-- Como usar: Supabase › SQL Editor › New query › cole este arquivo inteiro › Run. Pode rodar de novo sem perder dados.
-- Pasta (schema) deste app: golden. Depois de rodar, inclua "golden" em Project Settings › Data API › Exposed schemas.

create schema if not exists golden;
grant usage on schema golden to anon, authenticated, service_role;

-- =====================================================================
-- EasyApp Base — banco comum a todos os apps de segmento (uma instalação por segmento).
-- NÃO edite este arquivo num app de segmento: ele vem do repositório easyapp-base.
-- O que é específico do segmento fica em supabase/segmento.sql e em src/js/segmento.js.
-- Pode ser executado de novo sem perder dados (idempotente).
-- =====================================================================
--
-- Modelo
--   empresas  → cada cliente pagante (ex.: uma transportadora). Todos os dados levam empresa_id.
--   docs      → todos os registros do app como documentos JSON (coluna data), separados por coleção
--               (ex.: veiculos, viagens). Novas coleções não precisam de tabela nova: basta
--               declarar em src/js/segmento.js (o gerar.mjs grava as regras na tabela colecoes).
--   colecoes  → regras de acesso de cada coleção:
--                 leitura: gestao (só a gestão) | todos (gestão + usuários) | proprio (usuário vê só o dele)
--                 escrita: gestao | proprio (usuário grava só o dele)
--                 campo_ref: campo que diz a quem pertence o documento (ex.: motoristaId; 'id' = o próprio)
--                 protegidos: campos que o usuário não altera (ex.: valor do frete)
--                 trava: campo booleano; quando true o usuário não altera nem apaga mais (ex.: conferido)
--   perfis    → quem é quem: dono / gestor (e-mail e senha) ou usuario (código + PIN, login anônimo)
--   acessos   → código + PIN de cada usuário do app de campo (motorista, parceiro, técnico…)
--
-- Assinatura: empresas.situacao (teste | ativa | suspensa | cancelada). Fora do teste ou do
-- pagamento em dia, o banco recusa gravações (os dados continuam visíveis para exportar).
-- O administrador da plataforma (tabela plataforma_admins) gerencia as empresas pelo app de Gestão.

create extension if not exists pgcrypto;

-- ---------- Tabelas ----------
create table if not exists golden.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  plano text not null default 'teste',
  situacao text not null default 'teste' check (situacao in ('teste', 'ativa', 'suspensa', 'cancelada')),
  teste_ate date not null default (current_date + 30),
  pago_ate date,
  valor_mensal numeric(10,2),
  obs text
);

create table if not exists golden.colecoes (
  nome text primary key,
  leitura text not null default 'gestao' check (leitura in ('gestao', 'todos', 'proprio')),
  escrita text not null default 'gestao' check (escrita in ('gestao', 'proprio')),
  campo_ref text,
  protegidos text[] not null default '{}',
  trava text
);
insert into golden.colecoes (nome, leitura, escrita) values ('config', 'todos', 'gestao') on conflict (nome) do nothing;

create table if not exists golden.docs (
  empresa_id uuid not null references golden.empresas(id) on delete cascade,
  id text not null,
  colecao text not null references golden.colecoes(nome),
  data jsonb not null,
  ref text,                                  -- preenchido pelo banco (colecoes.campo_ref)
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  primary key (empresa_id, id)
);
create index if not exists docs_colecao_idx on golden.docs (empresa_id, colecao);
create index if not exists docs_ref_idx on golden.docs (empresa_id, colecao, ref);

create table if not exists golden.perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references golden.empresas(id) on delete cascade,
  papel text not null check (papel in ('dono', 'gestor', 'usuario')),
  ref text,                                  -- usuário: documento ao qual o aparelho está vinculado
  criado_em timestamptz not null default now()
);
create index if not exists perfis_empresa_idx on golden.perfis (empresa_id, papel);
alter table golden.perfis add column if not exists visto_em timestamptz;  -- presença: último sinal do app aberto

create table if not exists golden.acessos (
  codigo text primary key,
  empresa_id uuid not null references golden.empresas(id) on delete cascade,
  ref text not null,
  nome text,
  pin text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (empresa_id, ref)
);

create table if not exists golden.convites (
  codigo text primary key,
  empresa_id uuid not null references golden.empresas(id) on delete cascade,
  nome text,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days',
  usado_por uuid references auth.users(id) on delete set null,
  usado_em timestamptz
);
-- papel de quem usar o convite: gestor (usuário da Gestão, convidado pelo dono) ou dono (convite feito pelo desenvolvedor na Plataforma)
alter table golden.convites add column if not exists papel text not null default 'gestor' check (papel in ('dono', 'gestor'));

create table if not exists golden.tentativas_login (
  codigo text primary key,
  falhas int not null default 0,
  bloqueado_ate timestamptz
);

create table if not exists golden.plataforma_admins (email text primary key);

-- Visita de suporte: o administrador da plataforma abre uma empresa pelo próprio app (com o login dele,
-- verificação em duas etapas e prazo). Enquanto vale, o app enxerga aquela empresa como o dono enxerga.
create table if not exists golden.suporte_visitas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references golden.empresas(id) on delete cascade,
  modo text not null check (modo in ('leitura', 'edicao')),
  desde timestamptz not null default now(),
  ate timestamptz not null
);

create table if not exists golden.atividade (
  id bigint generated always as identity primary key,
  empresa_id uuid references golden.empresas(id) on delete cascade,
  em timestamptz not null default now(),
  user_id uuid,
  papel text,
  quem text,
  ref text,
  acao text not null,                        -- insert | update | delete | acesso
  colecao text,
  registro text,
  antes jsonb,
  depois jsonb
);
create index if not exists atividade_empresa_idx on golden.atividade (empresa_id, em desc);

-- ---------- Funções auxiliares ----------
create or replace function golden.eh_admin() returns boolean
language sql stable security definer set search_path = golden, public, extensions as
$$ select coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
      and exists (select 1 from golden.plataforma_admins where lower(email) = lower(auth.jwt()->>'email')) $$;

-- Visita de suporte em vigor: só para administrador, dentro do prazo e com a verificação em duas etapas
-- feita nesta sessão (aal2). Sem isso as funções abaixo ignoram a visita.
create or replace function golden.visita_empresa() returns uuid
language sql stable security definer set search_path = golden, public, extensions as
$$ select v.empresa_id from golden.suporte_visitas v
    where v.user_id = auth.uid() and v.ate > now() and coalesce(auth.jwt()->>'aal', '') = 'aal2' and golden.eh_admin() $$;

create or replace function golden.visita_modo(p_empresa uuid) returns text
language sql stable security definer set search_path = golden, public, extensions as
$$ select v.modo from golden.suporte_visitas v
    where v.user_id = auth.uid() and v.empresa_id = p_empresa and v.ate > now() and coalesce(auth.jwt()->>'aal', '') = 'aal2' and golden.eh_admin() $$;

-- Visita "só ver": o banco recusa qualquer gravação nessa empresa
create or replace function golden.so_leitura(p_empresa uuid) returns boolean
language sql stable security definer set search_path = golden, public, extensions as
$$ select coalesce(golden.visita_modo(p_empresa) = 'leitura', false) $$;

create or replace function golden.eh_gestao(p_empresa uuid) returns boolean
language sql stable security definer set search_path = golden, public, extensions as
$$ select exists (select 1 from golden.perfis where user_id = auth.uid() and empresa_id = p_empresa and papel in ('dono', 'gestor'))
       or golden.visita_modo(p_empresa) is not null $$;

create or replace function golden.eh_dono(p_empresa uuid) returns boolean
language sql stable security definer set search_path = golden, public, extensions as
$$ select exists (select 1 from golden.perfis where user_id = auth.uid() and empresa_id = p_empresa and papel = 'dono')
       or golden.visita_modo(p_empresa) is not null $$;

create or replace function golden.meu_ref(p_empresa uuid) returns text
language sql stable security definer set search_path = golden, public, extensions as
$$ select ref from golden.perfis where user_id = auth.uid() and empresa_id = p_empresa and papel = 'usuario' $$;

create or replace function golden.minha_empresa() returns uuid
language sql stable security definer set search_path = golden, public, extensions as
$$ select coalesce(golden.visita_empresa(), (select empresa_id from golden.perfis where user_id = auth.uid())) $$;

-- Empresa em dia: teste dentro do prazo, ou ativa com pagamento até 5 dias atrasado
create or replace function golden.empresa_liberada(p_empresa uuid) returns boolean
language sql stable security definer set search_path = golden, public, extensions as $$
  select exists (select 1 from golden.empresas e where e.id = p_empresa and (
    (e.situacao = 'teste' and e.teste_ate >= current_date) or
    (e.situacao = 'ativa' and (e.pago_ate is null or e.pago_ate >= current_date - 5))))
$$;

create or replace function golden.pode_ler(p_empresa uuid, p_colecao text, p_ref text) returns boolean
language plpgsql stable security definer set search_path = golden, public, extensions as $$
declare v_ref text; v_leitura text;
begin
  if golden.eh_gestao(p_empresa) then return true; end if;
  v_ref := golden.meu_ref(p_empresa);
  if v_ref is null then return false; end if;
  select leitura into v_leitura from golden.colecoes where nome = p_colecao;
  return v_leitura = 'todos' or (v_leitura = 'proprio' and p_ref = v_ref);
end $$;

create or replace function golden.pode_gravar(p_empresa uuid, p_colecao text, p_ref text, p_data jsonb) returns boolean
language plpgsql stable security definer set search_path = golden, public, extensions as $$
declare v_ref text; c golden.colecoes;
begin
  if golden.so_leitura(p_empresa) then return false; end if;
  if not golden.empresa_liberada(p_empresa) then return false; end if;
  if golden.eh_gestao(p_empresa) then return true; end if;
  v_ref := golden.meu_ref(p_empresa);
  if v_ref is null then return false; end if;
  select * into c from golden.colecoes where nome = p_colecao;
  if c.escrita <> 'proprio' or p_ref is distinct from v_ref then return false; end if;
  return c.trava is null or not coalesce((p_data->>c.trava)::boolean, false);
end $$;

-- Antes de gravar um documento: confere a coleção, preenche ref e protege campos do usuário
create or replace function golden.preparar_doc() returns trigger
language plpgsql security definer set search_path = golden, public, extensions as $$
declare c golden.colecoes; k text;
begin
  select * into c from golden.colecoes where nome = new.colecao;
  if c.nome is null then raise exception 'Coleção desconhecida: %', new.colecao; end if;
  if tg_op = 'UPDATE' and new.colecao <> old.colecao then raise exception 'Não é permitido mudar a coleção'; end if;
  if auth.uid() is not null and not golden.eh_gestao(new.empresa_id) then
    foreach k in array array_remove(c.protegidos || array[c.trava], null) loop
      if tg_op = 'UPDATE' and old.data ? k then new.data := jsonb_set(new.data, array[k], old.data->k);
      else new.data := new.data - k; end if;
    end loop;
    if tg_op = 'UPDATE' and c.trava is not null and coalesce((old.data->>c.trava)::boolean, false) then
      raise exception 'Este registro já foi conferido pela gestão';
    end if;
  end if;
  new.ref := case when c.campo_ref = 'id' then new.id when c.campo_ref is not null then new.data->>c.campo_ref end;
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end $$;
drop trigger if exists tg_preparar_doc on golden.docs;
create trigger tg_preparar_doc before insert or update on golden.docs for each row execute function golden.preparar_doc();

create or replace function golden.gerar_codigo(n int) returns text language sql volatile as
$$ select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, n) $$;

-- Acessos: código gerado pelo banco; PIN trocado ou acesso desativado desconecta os aparelhos
create or replace function golden.preparar_acesso() returns trigger
language plpgsql security definer set search_path = golden, public, extensions as $$
begin
  if tg_op = 'INSERT' then
    if new.codigo is null or new.codigo = '' then
      loop new.codigo := golden.gerar_codigo(6); exit when not exists (select 1 from golden.acessos where codigo = new.codigo); end loop;
    end if;
    new.codigo := upper(new.codigo);
    if new.pin is null or new.pin = '' then new.pin := lpad(floor(random() * 10000)::text, 4, '0'); end if;
  else
    new.codigo := old.codigo; new.empresa_id := old.empresa_id; new.ref := old.ref;
    if new.pin is distinct from old.pin or not new.ativo then
      delete from golden.perfis where empresa_id = old.empresa_id and papel = 'usuario' and ref = old.ref;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists tg_preparar_acesso on golden.acessos;
create trigger tg_preparar_acesso before insert or update on golden.acessos for each row execute function golden.preparar_acesso();

create or replace function golden.apagar_acesso() returns trigger
language plpgsql security definer set search_path = golden, public, extensions as $$
begin
  delete from golden.perfis where empresa_id = old.empresa_id and papel = 'usuario' and ref = old.ref;
  return old;
end $$;
drop trigger if exists tg_apagar_acesso on golden.acessos;
create trigger tg_apagar_acesso after delete on golden.acessos for each row execute function golden.apagar_acesso();

-- ---------- Entrada e cadastro ----------
create or replace function golden.meu_perfil() returns json
language sql stable security definer set search_path = golden, public, extensions as $$
  -- visita de suporte em vigor: o administrador vê a empresa visitada como o dono
  select json_build_object(
    'papel', 'dono', 'empresaId', e.id, 'ref', null, 'admin', true, 'email', auth.jwt()->>'email',
    'suporte', json_build_object('modo', v.modo, 'ate', v.ate),
    'empresa', json_build_object('nome', e.nome, 'situacao', e.situacao, 'plano', e.plano, 'testeAte', e.teste_ate,
                                 'pagoAte', e.pago_ate, 'liberada', golden.empresa_liberada(e.id)))
  from golden.suporte_visitas v join golden.empresas e on e.id = v.empresa_id
  where v.user_id = auth.uid() and v.empresa_id = golden.visita_empresa()
  union all
  select json_build_object(
    'papel', p.papel, 'empresaId', p.empresa_id, 'ref', p.ref, 'admin', golden.eh_admin(),
    'email', (select email from auth.users where id = auth.uid()),
    'empresa', json_build_object('nome', e.nome, 'situacao', e.situacao, 'plano', e.plano, 'testeAte', e.teste_ate,
                                 'pagoAte', e.pago_ate, 'liberada', golden.empresa_liberada(e.id)))
  from golden.perfis p join golden.empresas e on e.id = p.empresa_id where p.user_id = auth.uid() and golden.visita_empresa() is null
  union all
  select json_build_object('papel', null, 'admin', true, 'email', auth.jwt()->>'email')
  where golden.eh_admin() and golden.visita_empresa() is null and not exists (select 1 from golden.perfis where user_id = auth.uid())
$$;

-- Administrador: abre uma empresa no próprio app (só ver ou ver e corrigir) por 2 horas.
-- Exige a verificação em duas etapas nesta sessão. Fica no registro de atividades da empresa.
create or replace function golden.suporte_abrir(p_empresa uuid, p_modo text) returns json
language plpgsql security definer set search_path = golden, public, extensions as $$
declare v_modo text := case when p_modo = 'edicao' then 'edicao' else 'leitura' end;
begin
  if not golden.eh_admin() then raise exception 'Sem permissão'; end if;
  if coalesce(auth.jwt()->>'aal', '') <> 'aal2' then raise exception 'MFA: confirme o código de verificação em duas etapas'; end if;
  if not exists (select 1 from golden.empresas where id = p_empresa) then raise exception 'Empresa não encontrada'; end if;
  insert into golden.suporte_visitas (user_id, empresa_id, modo, desde, ate) values (auth.uid(), p_empresa, v_modo, now(), now() + interval '2 hours')
    on conflict (user_id) do update set empresa_id = excluded.empresa_id, modo = excluded.modo, desde = excluded.desde, ate = excluded.ate;
  insert into golden.atividade (empresa_id, user_id, papel, quem, acao, depois)
  values (p_empresa, auth.uid(), 'suporte', 'Suporte (' || coalesce(auth.jwt()->>'email', '') || ')', 'acesso', jsonb_build_object('modo', v_modo));
  return golden.meu_perfil();
end $$;

create or replace function golden.suporte_sair() returns void
language sql security definer set search_path = golden, public, extensions as
$$ delete from golden.suporte_visitas where user_id = auth.uid() $$;

-- Cadastro livre: quem cria a conta com e-mail cria a própria empresa (vira dono, em período de teste)
create or replace function golden.criar_empresa(p_nome text) returns uuid
language plpgsql security definer set search_path = golden, public, extensions as $$
declare v_id uuid;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then raise exception 'Entre com e-mail e senha'; end if;
  if exists (select 1 from golden.perfis where user_id = auth.uid()) then raise exception 'Esta conta já está ligada a uma empresa'; end if;
  if length(trim(coalesce(p_nome, ''))) < 2 then raise exception 'Informe o nome da empresa'; end if;
  insert into golden.empresas (nome, criado_por) values (trim(p_nome), auth.uid()) returning id into v_id;
  insert into golden.perfis (user_id, empresa_id, papel) values (auth.uid(), v_id, 'dono');
  return v_id;
end $$;

-- Convite de gestor (gerado pelo dono)
create or replace function golden.entrar_convite(p_codigo text) returns boolean
language plpgsql security definer set search_path = golden, public, extensions as $$
declare v_conv golden.convites;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then raise exception 'Entre com e-mail e senha'; end if;
  if exists (select 1 from golden.perfis where user_id = auth.uid()) then raise exception 'Esta conta já está ligada a uma empresa'; end if;
  select * into v_conv from golden.convites where codigo = upper(trim(p_codigo)) and usado_por is null and expira_em > now() for update;
  if v_conv.codigo is null then return false; end if;
  update golden.convites set usado_por = auth.uid(), usado_em = now() where codigo = v_conv.codigo;
  insert into golden.perfis (user_id, empresa_id, papel) values (auth.uid(), v_conv.empresa_id, coalesce(v_conv.papel, 'gestor'));
  return true;
end $$;

-- Desenvolvedor (administrador da plataforma): convite de DONO para uma empresa (ex.: empresa criada para o cliente)
create or replace function golden.plataforma_convite_dono(p_empresa uuid) returns text
language plpgsql security definer set search_path = golden, public, extensions as $$
declare v_codigo text := golden.gerar_codigo(8);
begin
  if not golden.eh_admin() then raise exception 'Sem permissão'; end if;
  if not exists (select 1 from golden.empresas where id = p_empresa) then raise exception 'Empresa não encontrada'; end if;
  insert into golden.convites (codigo, empresa_id, nome, criado_por, papel) values (v_codigo, p_empresa, 'Convite de dono', auth.uid(), 'dono');
  return v_codigo;
end $$;

-- Usuário do app de campo: login anônimo + código + PIN (bloqueio após 5 erros)
create or replace function golden.vincular_usuario(p_codigo text, p_pin text) returns text
language plpgsql security definer set search_path = golden, public, extensions as $$
declare v_codigo text := upper(trim(p_codigo)); v_a golden.acessos; v_t golden.tentativas_login;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  select * into v_t from golden.tentativas_login where codigo = v_codigo;
  if v_t.bloqueado_ate is not null and v_t.bloqueado_ate > now() then raise exception 'Muitas tentativas. Tente novamente em alguns minutos.'; end if;
  select * into v_a from golden.acessos where codigo = v_codigo and pin = trim(p_pin) and ativo;
  if v_a.codigo is null then
    insert into golden.tentativas_login as t (codigo, falhas) values (v_codigo, 1)
      on conflict (codigo) do update set falhas = t.falhas + 1,
        bloqueado_ate = case when t.falhas + 1 >= 5 then now() + interval '15 minutes' else null end;
    return null;
  end if;
  delete from golden.tentativas_login where codigo = v_codigo;
  if exists (select 1 from golden.perfis where user_id = auth.uid() and papel in ('dono', 'gestor')) then
    raise exception 'Este aparelho está conectado como gestão. Saia antes de entrar como usuário.';
  end if;
  insert into golden.perfis (user_id, empresa_id, papel, ref) values (auth.uid(), v_a.empresa_id, 'usuario', v_a.ref)
    on conflict (user_id) do update set empresa_id = excluded.empresa_id, papel = 'usuario', ref = excluded.ref;
  return v_a.ref;
end $$;

-- ---------- Equipe de gestão ----------
create or replace function golden.criar_convite(p_nome text) returns text
language plpgsql security definer set search_path = golden, public, extensions as $$
declare v_codigo text := golden.gerar_codigo(8); v_emp uuid := golden.minha_empresa();
begin
  if not golden.eh_dono(v_emp) or golden.so_leitura(v_emp) then raise exception 'Somente o dono pode convidar gestores'; end if;
  insert into golden.convites (codigo, empresa_id, nome, criado_por) values (v_codigo, v_emp, nullif(trim(p_nome), ''), auth.uid());
  return v_codigo;
end $$;

create or replace function golden.equipe() returns json
language plpgsql stable security definer set search_path = golden, public, extensions as $$
declare v_emp uuid := golden.minha_empresa();
begin
  if not golden.eh_gestao(v_emp) then raise exception 'Sem permissão'; end if;
  return json_build_object(
    'membros', coalesce((select json_agg(json_build_object('userId', p.user_id, 'papel', p.papel, 'email', u.email, 'desde', p.criado_em, 'eu', p.user_id = auth.uid()) order by p.criado_em)
                         from golden.perfis p join auth.users u on u.id = p.user_id where p.empresa_id = v_emp and p.papel in ('dono', 'gestor')), '[]'::json),
    'convites', case when golden.eh_dono(v_emp) then coalesce((select json_agg(json_build_object('codigo', codigo, 'nome', nome, 'expira', expira_em) order by criado_em desc)
                         from golden.convites where empresa_id = v_emp and usado_por is null and expira_em > now()), '[]'::json) else '[]'::json end);
end $$;

create or replace function golden.remover_gestor(p_user uuid) returns void
language plpgsql security definer set search_path = golden, public, extensions as $$
declare v_emp uuid := golden.minha_empresa();
begin
  if not golden.eh_dono(v_emp) or golden.so_leitura(v_emp) then raise exception 'Somente o dono pode remover gestores'; end if;
  delete from golden.perfis where user_id = p_user and empresa_id = v_emp and papel = 'gestor';
end $$;

create or replace function golden.cancelar_convite(p_codigo text) returns void
language plpgsql security definer set search_path = golden, public, extensions as $$
begin
  if not golden.eh_dono(golden.minha_empresa()) or golden.so_leitura(golden.minha_empresa()) then raise exception 'Sem permissão'; end if;
  delete from golden.convites where codigo = upper(p_codigo) and empresa_id = golden.minha_empresa() and usado_por is null;
end $$;

-- ---------- Registro de atividades ----------
create or replace function golden.atividade_autor(out o_papel text, out o_quem text, out o_ref text)
language plpgsql stable security definer set search_path = golden, public, extensions as $$
begin
  if auth.uid() is null then o_quem := 'Sistema'; return; end if;
  if golden.visita_empresa() is not null then o_papel := 'suporte'; o_quem := 'Suporte (' || coalesce(auth.jwt()->>'email', '') || ')'; return; end if;
  select papel, ref into o_papel, o_ref from golden.perfis where user_id = auth.uid();
  if o_papel = 'usuario' then o_quem := (select nome from golden.acessos where empresa_id = golden.minha_empresa() and ref = o_ref);
  else o_quem := (select email from auth.users where id = auth.uid()); end if;
end $$;

create or replace function golden.registrar_atividade() returns trigger
language plpgsql security definer set search_path = golden, public, extensions as $$
declare v_old jsonb; v_new jsonb; v_antes jsonb; v_depois jsonb; v_reg text; v_col text; v_emp uuid; a record;
begin
  begin -- o registro nunca impede a gravação do app
    if tg_table_name = 'docs' then
      v_old := case when tg_op <> 'INSERT' then old.data end; v_new := case when tg_op <> 'DELETE' then new.data end;
      v_reg := coalesce(new.id, old.id); v_col := coalesce(new.colecao, old.colecao); v_emp := coalesce(new.empresa_id, old.empresa_id);
    elsif tg_table_name = 'acessos' then
      v_old := case when tg_op <> 'INSERT' then to_jsonb(old) - 'pin' end; v_new := case when tg_op <> 'DELETE' then to_jsonb(new) - 'pin' end;
      if tg_op = 'UPDATE' and old.pin is distinct from new.pin then v_new := v_new || '{"pinTrocado": true}'; end if;
      v_reg := coalesce(new.ref, old.ref); v_col := 'acessos'; v_emp := coalesce(new.empresa_id, old.empresa_id);
    else
      v_old := case when tg_op <> 'INSERT' then to_jsonb(old) end; v_new := case when tg_op <> 'DELETE' then to_jsonb(new) end;
      v_reg := coalesce(new.user_id, old.user_id)::text; v_col := 'perfis'; v_emp := coalesce(new.empresa_id, old.empresa_id);
    end if;
    if tg_op = 'UPDATE' then
      select jsonb_object_agg(k, v_old->k), jsonb_object_agg(k, v_new->k) into v_antes, v_depois
        from (select jsonb_object_keys(v_old || v_new) k) x where v_old->k is distinct from v_new->k;
      if v_depois is null then return null; end if;
    else v_antes := v_old; v_depois := v_new; end if;
    select * into a from golden.atividade_autor();
    insert into golden.atividade (empresa_id, user_id, papel, quem, ref, acao, colecao, registro, antes, depois)
    values (v_emp, auth.uid(), a.o_papel, a.o_quem, a.o_ref, lower(tg_op), v_col, v_reg, v_antes, v_depois);
  exception when others then raise warning 'registrar_atividade: %', sqlerrm;
  end;
  return null;
end $$;

do $$ declare t text; begin
  foreach t in array array['docs', 'acessos', 'perfis'] loop
    execute format('drop trigger if exists tg_atividade on golden.%I', t);
    execute format('create trigger tg_atividade after insert or update or delete on golden.%I for each row execute function golden.registrar_atividade()', t);
  end loop;
end $$;

create or replace function golden.registrar_acesso() returns void
language plpgsql security definer set search_path = golden, public, extensions as $$
declare a record; v_emp uuid := golden.minha_empresa();
begin
  if v_emp is null then return; end if;
  if exists (select 1 from golden.atividade where user_id = auth.uid() and acao = 'acesso' and em > now() - interval '30 minutes') then return; end if;
  select * into a from golden.atividade_autor();
  insert into golden.atividade (empresa_id, user_id, papel, quem, ref, acao) values (v_emp, auth.uid(), a.o_papel, a.o_quem, a.o_ref, 'acesso');
  delete from golden.atividade where em < now() - interval '1 year';
end $$;

-- Presença: o app aberto manda um sinal a cada 2 minutos (o painel de gestão mostra quem está conectado)
create or replace function golden.sinal() returns void
language sql security definer set search_path = golden, public, extensions as $$
  update golden.perfis set visto_em = now() where user_id = auth.uid() and golden.visita_empresa() is null;
$$;

create or replace function golden.atividade_log(p_antes timestamptz default null, p_user uuid default null, p_desde timestamptz default null, p_limite int default 300) returns json
language plpgsql stable security definer set search_path = golden, public, extensions as $$
declare v_emp uuid := golden.minha_empresa();
begin
  if not golden.eh_dono(v_emp) then raise exception 'Somente o dono vê o registro de atividades'; end if;
  return json_build_object(
    'itens', coalesce((select json_agg(x order by x.em desc, x.id desc) from (
        select id, em, user_id "userId", papel, quem, ref, acao, colecao, registro, antes, depois from golden.atividade
         where empresa_id = v_emp and (p_antes is null or em < p_antes) and (p_user is null or user_id = p_user) and (p_desde is null or em >= p_desde)
         order by em desc, id desc limit least(greatest(p_limite, 1), 1000)) x), '[]'::json),
    'pessoas', coalesce((select json_agg(x order by x.ultimo desc) from (
        select user_id "userId", (array_agg(papel order by em desc))[1] papel, (array_agg(quem order by em desc))[1] quem,
               max(em) ultimo, count(*) filter (where acao <> 'acesso') acoes, count(*) filter (where acao = 'acesso') acessos
          from golden.atividade where empresa_id = v_emp and em > now() - interval '30 days' and user_id is not null group by user_id) x), '[]'::json));
end $$;

-- ---------- Plataforma (administrador da fábrica de apps) ----------
create or replace function golden.plataforma_empresas() returns json
language plpgsql stable security definer set search_path = golden, public, extensions as $$
begin
  if not golden.eh_admin() then raise exception 'Sem permissão'; end if;
  return coalesce((select json_agg(x order by x."criadoEm" desc) from (
    select e.id, e.nome, e.plano, e.situacao, e.teste_ate "testeAte", e.pago_ate "pagoAte", e.valor_mensal "valorMensal", e.obs, e.criado_em "criadoEm",
           golden.empresa_liberada(e.id) liberada,
           (select u.email from golden.perfis p join auth.users u on u.id = p.user_id where p.empresa_id = e.id and p.papel = 'dono' limit 1) dono,
           (select count(*) from golden.perfis p where p.empresa_id = e.id and p.papel in ('dono', 'gestor')) gestores,
           (select count(*) from golden.acessos a where a.empresa_id = e.id and a.ativo) usuarios,
           (select count(*) from golden.docs d where d.empresa_id = e.id) registros,
           (select max(em) from golden.atividade a where a.empresa_id = e.id) "ultimoUso"
      from golden.empresas e) x), '[]'::json);
end $$;

create or replace function golden.plataforma_atualizar(p_empresa uuid, p_situacao text, p_plano text, p_teste_ate date, p_pago_ate date, p_valor numeric, p_obs text) returns void
language plpgsql security definer set search_path = golden, public, extensions as $$
begin
  if not golden.eh_admin() then raise exception 'Sem permissão'; end if;
  update golden.empresas set situacao = p_situacao, plano = coalesce(nullif(trim(p_plano), ''), plano), teste_ate = coalesce(p_teste_ate, teste_ate),
         pago_ate = p_pago_ate, valor_mensal = p_valor, obs = nullif(trim(p_obs), '') where id = p_empresa;
end $$;

-- ---------- Permissões das funções ----------
do $$ declare f text; begin
  foreach f in array array['criar_empresa(text)', 'entrar_convite(text)', 'vincular_usuario(text, text)', 'criar_convite(text)', 'equipe()',
    'remover_gestor(uuid)', 'cancelar_convite(text)', 'registrar_acesso()', 'sinal()', 'atividade_log(timestamptz, uuid, timestamptz, int)',
    'plataforma_empresas()', 'plataforma_atualizar(uuid, text, text, date, date, numeric, text)', 'meu_perfil()',
    'suporte_abrir(uuid, text)', 'suporte_sair()', 'plataforma_convite_dono(uuid)'] loop
    execute format('revoke all on function golden.%s from public, anon', f);
    execute format('grant execute on function golden.%s to authenticated', f);
  end loop;
end $$;
revoke all on function golden.atividade_autor() from public, anon, authenticated;

-- ---------- Row Level Security ----------
alter table golden.empresas enable row level security;
alter table golden.colecoes enable row level security;
alter table golden.docs enable row level security;
alter table golden.perfis enable row level security;
alter table golden.acessos enable row level security;
alter table golden.convites enable row level security;
alter table golden.tentativas_login enable row level security;
alter table golden.plataforma_admins enable row level security;
alter table golden.atividade enable row level security;
alter table golden.suporte_visitas enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'golden' and policyname like 'ea_%' loop
    execute format('drop policy %I on golden.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy ea_ler on golden.docs for select to authenticated using (golden.pode_ler(empresa_id, colecao, ref));
create policy ea_inserir on golden.docs for insert to authenticated with check (golden.pode_gravar(empresa_id, colecao, ref, data));
create policy ea_alterar on golden.docs for update to authenticated using (golden.pode_gravar(empresa_id, colecao, ref, data)) with check (golden.pode_gravar(empresa_id, colecao, ref, data));
create policy ea_apagar on golden.docs for delete to authenticated using (golden.pode_gravar(empresa_id, colecao, ref, data));

create policy ea_empresa on golden.empresas for select to authenticated using (id = golden.minha_empresa());
create policy ea_empresa_nome on golden.empresas for update to authenticated using (golden.eh_dono(id) and not golden.so_leitura(id)) with check (golden.eh_dono(id) and not golden.so_leitura(id));
create policy ea_colecoes on golden.colecoes for select to authenticated using (true);
create policy ea_perfil on golden.perfis for select to authenticated using (user_id = auth.uid() or golden.eh_gestao(empresa_id));
create policy ea_acessos_ler on golden.acessos for select to authenticated using (golden.eh_gestao(empresa_id));
create policy ea_acessos on golden.acessos for all to authenticated using (golden.eh_gestao(empresa_id) and not golden.so_leitura(empresa_id))
  with check (golden.eh_gestao(empresa_id) and not golden.so_leitura(empresa_id) and golden.empresa_liberada(empresa_id));

grant select, insert, update, delete on golden.docs, golden.acessos to authenticated;
grant select on golden.colecoes, golden.perfis to authenticated;
grant select, update (nome) on golden.empresas to authenticated;
revoke all on golden.convites, golden.tentativas_login, golden.plataforma_admins, golden.atividade, golden.suporte_visitas from anon, authenticated;

-- ---------- Tempo real ----------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'golden' and tablename = 'docs') then
    alter publication supabase_realtime add table golden.docs;
  end if;
end $$;

-- ---------- Coleções do segmento (src/js/segmento.js) ----------
insert into golden.colecoes (nome, leitura, escrita, campo_ref, protegidos, trava) values ('contatos', 'gestao', 'gestao', null, array[]::text[], null)
  on conflict (nome) do update set leitura = excluded.leitura, escrita = excluded.escrita, campo_ref = excluded.campo_ref, protegidos = excluded.protegidos, trava = excluded.trava;
insert into golden.colecoes (nome, leitura, escrita, campo_ref, protegidos, trava) values ('mensagens', 'gestao', 'gestao', null, array[]::text[], null)
  on conflict (nome) do update set leitura = excluded.leitura, escrita = excluded.escrita, campo_ref = excluded.campo_ref, protegidos = excluded.protegidos, trava = excluded.trava;
insert into golden.colecoes (nome, leitura, escrita, campo_ref, protegidos, trava) values ('modelos', 'gestao', 'gestao', null, array[]::text[], null)
  on conflict (nome) do update set leitura = excluded.leitura, escrita = excluded.escrita, campo_ref = excluded.campo_ref, protegidos = excluded.protegidos, trava = excluded.trava;
insert into golden.colecoes (nome, leitura, escrita, campo_ref, protegidos, trava) values ('campanhas', 'gestao', 'gestao', null, array[]::text[], null)
  on conflict (nome) do update set leitura = excluded.leitura, escrita = excluded.escrita, campo_ref = excluded.campo_ref, protegidos = excluded.protegidos, trava = excluded.trava;
insert into golden.colecoes (nome, leitura, escrita, campo_ref, protegidos, trava) values ('produtos', 'gestao', 'gestao', null, array[]::text[], null)
  on conflict (nome) do update set leitura = excluded.leitura, escrita = excluded.escrita, campo_ref = excluded.campo_ref, protegidos = excluded.protegidos, trava = excluded.trava;
insert into golden.colecoes (nome, leitura, escrita, campo_ref, protegidos, trava) values ('cliques', 'gestao', 'gestao', null, array[]::text[], null)
  on conflict (nome) do update set leitura = excluded.leitura, escrita = excluded.escrita, campo_ref = excluded.campo_ref, protegidos = excluded.protegidos, trava = excluded.trava;
insert into golden.colecoes (nome, leitura, escrita, campo_ref, protegidos, trava) values ('atividades', 'gestao', 'gestao', null, array[]::text[], null)
  on conflict (nome) do update set leitura = excluded.leitura, escrita = excluded.escrita, campo_ref = excluded.campo_ref, protegidos = excluded.protegidos, trava = excluded.trava;

-- ---------- Período de teste das empresas novas (segmento.js › diasTeste) ----------
alter table golden.empresas alter column teste_ate set default (current_date + 365);

-- ---------- Administradores da plataforma ----------

-- ---------- Regras específicas do segmento (supabase/segmento.sql) ----------
-- Regras específicas da Golden CRM.
-- As coleções e regras de acesso ficam em src/js/segmento.js (o gerar.mjs grava na tabela colecoes).

-- Catálogo público (sem login): cada contato tem um código (token) no link do catálogo.
create index if not exists docs_contato_token_idx on golden.docs ((data->>'token')) where colecao = 'contatos';

create or replace function golden.catalogo_publico(p_empresa uuid default null, p_token text default null) returns json
language plpgsql stable security definer set search_path = golden, public, extensions as $$
declare v_emp uuid := p_empresa; v_c jsonb;
begin
  if coalesce(p_token, '') <> '' then
    select empresa_id, data into v_emp, v_c from golden.docs
     where colecao = 'contatos' and data->>'token' = p_token and (p_empresa is null or empresa_id = p_empresa) limit 1;
    v_emp := coalesce(v_emp, p_empresa);
  end if;
  if v_emp is null then return null; end if;
  return json_build_object(
    'empresa', (select nome from golden.empresas where id = v_emp),
    'config', (select json_build_object('whatsapp', data->>'whatsapp', 'siteUrl', data->>'siteUrl') from golden.docs where empresa_id = v_emp and colecao = 'config' and id = 'geral'),
    'contato', case when v_c is null then null else json_build_object('nome', split_part(v_c->>'nome', ' ', 1)) end,
    'produtos', coalesce((select json_agg(data order by coalesce(nullif(data->>'ordem', '')::numeric, 0)) from golden.docs
                          where empresa_id = v_emp and colecao = 'produtos' and coalesce((data->>'ativo')::boolean, true)), '[]'::json));
end $$;

-- Clique no catálogo: visita, "Quero este" (whatsapp) ou "Comprar no site" (site).
-- Clique em produto leva o contato para "Interessado" (só para a frente) e entra na linha do tempo.
create or replace function golden.registrar_clique(p_empresa uuid, p_token text, p_produto text, p_tipo text) returns void
language plpgsql volatile security definer set search_path = golden, public, extensions as $$
declare v_emp uuid := p_empresa; v_cid text; v_c jsonb; v_id text := 'ck' || replace(gen_random_uuid()::text, '-', ''); v_at text := 'at' || replace(gen_random_uuid()::text, '-', ''); v_agora text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if p_tipo not in ('visita', 'whatsapp', 'site') then return; end if;
  if coalesce(p_token, '') <> '' then
    select empresa_id, id, data into v_emp, v_cid, v_c from golden.docs where colecao = 'contatos' and data->>'token' = p_token and (p_empresa is null or empresa_id = p_empresa) limit 1;
    v_emp := coalesce(v_emp, p_empresa);
  end if;
  if v_emp is null or not exists (select 1 from golden.empresas where id = v_emp) then return; end if;
  -- proteção simples contra repetição: no máximo 60 registros por hora para o mesmo link
  if (select count(*) from golden.docs where empresa_id = v_emp and colecao = 'cliques' and atualizado_em > now() - interval '1 hour'
        and data->>'contatoId' is not distinct from v_cid) >= 60 then return; end if;
  if p_tipo = 'visita' and v_cid is not null and exists (select 1 from golden.docs where empresa_id = v_emp and colecao = 'cliques' and data->>'contatoId' = v_cid
        and data->>'tipo' = 'visita' and atualizado_em > now() - interval '30 minutes') then return; end if;
  insert into golden.docs (empresa_id, id, colecao, data) values (v_emp, v_id, 'cliques',
    jsonb_build_object('id', v_id, 'tipo', p_tipo, 'contatoId', v_cid, 'produtoId', nullif(p_produto, ''), 'em', v_agora));
  if p_tipo <> 'visita' and v_cid is not null and coalesce(v_c->>'etapa', 'novo') in ('novo', 'enviado', 'lido', 'respondeu') then
    update golden.docs set data = data || jsonb_build_object('etapa', 'interessado', 'ultimaInteracao', v_agora) where empresa_id = v_emp and id = v_cid;
    insert into golden.docs (empresa_id, id, colecao, data) values (v_emp, v_at, 'atividades',
      jsonb_build_object('id', v_at, 'contatoId', v_cid, 'tipo', 'etapa', 'em', v_agora,
        'texto', 'Clicou em produto no catálogo → Interessado'));
  end if;
end $$;

grant execute on function golden.catalogo_publico(uuid, text), golden.registrar_clique(uuid, text, text, text) to anon, authenticated;


select 'Instalação concluída' as resultado;