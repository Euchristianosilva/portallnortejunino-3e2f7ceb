-- Modo de votação explícito por votação: true = voto único, false = votos ilimitados.
ALTER TABLE public.polls ADD COLUMN single_vote boolean NOT NULL DEFAULT true;
-- Votações existentes: as que permitiam só 1 voto continuam em voto único; as demais passam a ilimitadas.
UPDATE public.polls SET single_vote = (votes_per_user <= 1);
COMMENT ON COLUMN public.polls.votes_per_user IS 'DEPRECATED: replaced by single_vote';
COMMENT ON COLUMN public.polls.allow_repeat_option IS 'DEPRECATED: replaced by single_vote';

CREATE OR REPLACE FUNCTION public.cast_vote(_poll_id uuid, _option_ids uuid[]) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.polls; uid uuid := auth.uid(); used int; oid uuid; uemail text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para votar.'; END IF;
  IF _option_ids IS NULL OR array_length(_option_ids,1) IS NULL THEN RAISE EXCEPTION 'Selecione um candidato.'; END IF;
  IF array_length(_option_ids,1) > 50 THEN RAISE EXCEPTION 'Envie no máximo 50 votos por vez.'; END IF;
  -- Bloqueia a linha da votação: requisições simultâneas do mesmo participante são processadas em fila.
  SELECT * INTO p FROM public.polls WHERE id=_poll_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Votação não encontrada.'; END IF;
  IF p.status <> 'ativa' THEN RAISE EXCEPTION 'Esta votação não está aberta.'; END IF;
  IF p.starts_at IS NOT NULL AND now() < p.starts_at THEN RAISE EXCEPTION 'A votação ainda não começou.'; END IF;
  IF p.ends_at IS NOT NULL AND now() > p.ends_at THEN RAISE EXCEPTION 'A votação foi encerrada.'; END IF;
  IF p.audience='restrita' THEN
    SELECT lower(email) INTO uemail FROM auth.users WHERE id=uid;
    IF NOT EXISTS(SELECT 1 FROM public.poll_voters v WHERE v.poll_id=_poll_id AND lower(v.email)=uemail) THEN
      RAISE EXCEPTION 'Você não está habilitado para esta votação.';
    END IF;
  END IF;
  SELECT count(*) INTO used FROM public.votes WHERE poll_id=_poll_id AND user_id=uid;
  IF p.single_vote THEN
    IF used > 0 THEN RAISE EXCEPTION 'Você já votou nesta votação.'; END IF;
    IF array_length(_option_ids,1) > 1 THEN RAISE EXCEPTION 'Nesta votação cada participante registra apenas um voto.'; END IF;
  END IF;
  FOREACH oid IN ARRAY _option_ids LOOP
    IF NOT EXISTS(SELECT 1 FROM public.poll_options o WHERE o.id=oid AND o.poll_id=_poll_id AND o.active) THEN RAISE EXCEPTION 'Candidato inválido.'; END IF;
    INSERT INTO public.votes(poll_id, option_id, user_id) VALUES (_poll_id, oid, uid);
    INSERT INTO public.poll_tallies(option_id, poll_id, votes) VALUES (oid, _poll_id, 1)
      ON CONFLICT (option_id) DO UPDATE SET votes = public.poll_tallies.votes + 1, updated_at=now();
  END LOOP;
  IF used = 0 THEN
    INSERT INTO public.poll_participation(poll_id, voters) VALUES (_poll_id,1)
      ON CONFLICT (poll_id) DO UPDATE SET voters = public.poll_participation.voters + 1, updated_at=now();
  END IF;
  -- 0 = nenhum voto restante (voto único); -1 = votos ilimitados.
  RETURN CASE WHEN p.single_vote THEN 0 ELSE -1 END;
END $$;
REVOKE ALL ON FUNCTION public.cast_vote(uuid, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cast_vote(uuid, uuid[]) TO authenticated;