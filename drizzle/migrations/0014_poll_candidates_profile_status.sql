
-- Novos campos de perfil e status dos candidatos (aditivo, preserva dados existentes)
ALTER TABLE public.poll_options
  ADD COLUMN artistic_name text NOT NULL DEFAULT '',
  ADD COLUMN code text NOT NULL DEFAULT '',
  ADD COLUMN social_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN active boolean NOT NULL DEFAULT true;

-- Voto recusa candidato inativo (validação no servidor)
CREATE OR REPLACE FUNCTION public.cast_vote(_poll_id uuid, _option_ids uuid[]) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.polls; uid uuid := auth.uid(); used int; oid uuid; uemail text; first_vote boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para votar.'; END IF;
  IF _option_ids IS NULL OR array_length(_option_ids,1) IS NULL THEN RAISE EXCEPTION 'Selecione uma opção.'; END IF;
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
  first_vote := used = 0;
  IF used + array_length(_option_ids,1) > p.votes_per_user THEN
    RAISE EXCEPTION 'Limite de votos atingido (% por participante).', p.votes_per_user;
  END IF;
  FOREACH oid IN ARRAY _option_ids LOOP
    IF NOT EXISTS(SELECT 1 FROM public.poll_options o WHERE o.id=oid AND o.poll_id=_poll_id AND o.active) THEN RAISE EXCEPTION 'Opção inválida.'; END IF;
    IF NOT p.allow_repeat_option AND EXISTS(SELECT 1 FROM public.votes v WHERE v.poll_id=_poll_id AND v.user_id=uid AND v.option_id=oid) THEN
      RAISE EXCEPTION 'Você já votou nesta opção.';
    END IF;
    INSERT INTO public.votes(poll_id, option_id, user_id) VALUES (_poll_id, oid, uid);
    INSERT INTO public.poll_tallies(option_id, poll_id, votes) VALUES (oid, _poll_id, 1)
      ON CONFLICT (option_id) DO UPDATE SET votes = public.poll_tallies.votes + 1, updated_at=now();
  END LOOP;
  IF (SELECT count(DISTINCT x) FROM unnest(_option_ids) x) <> array_length(_option_ids,1) AND NOT p.allow_repeat_option THEN
    RAISE EXCEPTION 'Opções repetidas.';
  END IF;
  IF first_vote THEN
    INSERT INTO public.poll_participation(poll_id, voters) VALUES (_poll_id,1)
      ON CONFLICT (poll_id) DO UPDATE SET voters = public.poll_participation.voters + 1, updated_at=now();
  END IF;
  RETURN p.votes_per_user - used - array_length(_option_ids,1);
END $$;
REVOKE ALL ON FUNCTION public.cast_vote(uuid, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cast_vote(uuid, uuid[]) TO authenticated;

-- Publicação exige ao menos 2 candidatos ativos (garantia no banco, não só na tela)
CREATE OR REPLACE FUNCTION public.require_min_active_options() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status IN ('ativa','agendada') AND OLD.status = 'rascunho' THEN
    IF (SELECT count(*) FROM public.poll_options WHERE poll_id=NEW.id AND active) < 2 THEN
      RAISE EXCEPTION 'A votação precisa de pelo menos 2 candidatos ativos para ser publicada.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS polls_min_options ON public.polls;
CREATE TRIGGER polls_min_options BEFORE UPDATE OF status ON public.polls
  FOR EACH ROW EXECUTE FUNCTION public.require_min_active_options();
