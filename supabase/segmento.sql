-- Regras específicas da Golden CRM.
-- As coleções e regras de acesso ficam em src/js/segmento.js (o gerar.mjs grava na tabela colecoes).

-- Catálogo público (sem login): cada contato tem um código (token) no link do catálogo.
create index if not exists docs_contato_token_idx on public.docs ((data->>'token')) where colecao = 'contatos';

create or replace function public.catalogo_publico(p_empresa uuid default null, p_token text default null) returns json
language plpgsql stable security definer set search_path = public as $$
declare v_emp uuid := p_empresa; v_c jsonb;
begin
  if coalesce(p_token, '') <> '' then
    select empresa_id, data into v_emp, v_c from public.docs
     where colecao = 'contatos' and data->>'token' = p_token and (p_empresa is null or empresa_id = p_empresa) limit 1;
    v_emp := coalesce(v_emp, p_empresa);
  end if;
  if v_emp is null then return null; end if;
  return json_build_object(
    'empresa', (select nome from public.empresas where id = v_emp),
    'config', (select json_build_object('whatsapp', data->>'whatsapp', 'siteUrl', data->>'siteUrl') from public.docs where empresa_id = v_emp and colecao = 'config' and id = 'geral'),
    'contato', case when v_c is null then null else json_build_object('nome', split_part(v_c->>'nome', ' ', 1)) end,
    'produtos', coalesce((select json_agg(data order by coalesce(nullif(data->>'ordem', '')::numeric, 0)) from public.docs
                          where empresa_id = v_emp and colecao = 'produtos' and coalesce((data->>'ativo')::boolean, true)), '[]'::json));
end $$;

-- Clique no catálogo: visita, "Quero este" (whatsapp) ou "Comprar no site" (site).
-- Clique em produto leva o contato para "Interessado" (só para a frente) e entra na linha do tempo.
create or replace function public.registrar_clique(p_empresa uuid, p_token text, p_produto text, p_tipo text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare v_emp uuid := p_empresa; v_cid text; v_c jsonb; v_id text := 'ck' || replace(gen_random_uuid()::text, '-', ''); v_at text := 'at' || replace(gen_random_uuid()::text, '-', ''); v_agora text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if p_tipo not in ('visita', 'whatsapp', 'site') then return; end if;
  if coalesce(p_token, '') <> '' then
    select empresa_id, id, data into v_emp, v_cid, v_c from public.docs where colecao = 'contatos' and data->>'token' = p_token and (p_empresa is null or empresa_id = p_empresa) limit 1;
    v_emp := coalesce(v_emp, p_empresa);
  end if;
  if v_emp is null or not exists (select 1 from public.empresas where id = v_emp) then return; end if;
  -- proteção simples contra repetição: no máximo 60 registros por hora para o mesmo link
  if (select count(*) from public.docs where empresa_id = v_emp and colecao = 'cliques' and atualizado_em > now() - interval '1 hour'
        and data->>'contatoId' is not distinct from v_cid) >= 60 then return; end if;
  if p_tipo = 'visita' and v_cid is not null and exists (select 1 from public.docs where empresa_id = v_emp and colecao = 'cliques' and data->>'contatoId' = v_cid
        and data->>'tipo' = 'visita' and atualizado_em > now() - interval '30 minutes') then return; end if;
  insert into public.docs (empresa_id, id, colecao, data) values (v_emp, v_id, 'cliques',
    jsonb_build_object('id', v_id, 'tipo', p_tipo, 'contatoId', v_cid, 'produtoId', nullif(p_produto, ''), 'em', v_agora));
  if p_tipo <> 'visita' and v_cid is not null and coalesce(v_c->>'etapa', 'novo') in ('novo', 'enviado', 'lido', 'respondeu') then
    update public.docs set data = data || jsonb_build_object('etapa', 'interessado', 'ultimaInteracao', v_agora) where empresa_id = v_emp and id = v_cid;
    insert into public.docs (empresa_id, id, colecao, data) values (v_emp, v_at, 'atividades',
      jsonb_build_object('id', v_at, 'contatoId', v_cid, 'tipo', 'etapa', 'em', v_agora,
        'texto', 'Clicou em produto no catálogo → Interessado'));
  end if;
end $$;

grant execute on function public.catalogo_publico(uuid, text), public.registrar_clique(uuid, text, text, text) to anon, authenticated;
