
-- digest() vive no schema extensions; as funções com search_path=public não a encontravam
CREATE OR REPLACE FUNCTION public.record_consent(_opportunity_id uuid, _session text, _events jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev jsonb; vid uuid; etext text; o public.opportunities%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.opportunities WHERE id=_opportunity_id;
  IF NOT FOUND OR o.status <> 'publicada' THEN RAISE EXCEPTION 'Vaga indisponível.'; END IF;
  IF o.opens_at IS NOT NULL AND o.opens_at > now() THEN RAISE EXCEPTION 'Candidaturas ainda não abertas.'; END IF;
  IF o.closes_at IS NOT NULL AND o.closes_at < now() THEN RAISE EXCEPTION 'Candidaturas encerradas.'; END IF;
  IF _session !~ '^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  FOR ev IN SELECT * FROM jsonb_array_elements(_events) LOOP
    vid := (ev->>'version_id')::uuid; etext := ev->>'event';
    IF etext NOT IN ('viewed','accepted','refused') THEN RAISE EXCEPTION 'Evento inválido.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.opportunity_documents WHERE opportunity_id=_opportunity_id AND version_id=vid) THEN RAISE EXCEPTION 'Documento não pertence à vaga.'; END IF;
    INSERT INTO public.consent_events (opportunity_id, document_version_id, event, session_hash, actor_id)
    VALUES (_opportunity_id, vid, etext, encode(extensions.digest(_session,'sha256'),'hex'), auth.uid());
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.opportunity_gate(_opportunity_id uuid, _session text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE missing jsonb; image_state text;
BEGIN
  IF _session !~ '^[0-9a-f-]{36}$' THEN RETURN jsonb_build_object('ok', false, 'missing', '[]'::jsonb, 'image', null); END IF;
  SELECT COALESCE(jsonb_agg(od.version_id),'[]'::jsonb) INTO missing
  FROM public.opportunity_documents od
  WHERE od.opportunity_id=_opportunity_id AND od.required AND NOT od.image_choice
    AND NOT EXISTS (SELECT 1 FROM public.consent_events ce WHERE ce.opportunity_id=_opportunity_id AND ce.document_version_id=od.version_id AND ce.session_hash=encode(extensions.digest(_session,'sha256'),'hex') AND ce.event='accepted');
  SELECT CASE WHEN bool_or(ce.event='accepted') THEN 'authorized' WHEN bool_or(ce.event='refused') THEN 'refused' ELSE NULL END INTO image_state
  FROM public.opportunity_documents od JOIN public.consent_events ce ON ce.document_version_id=od.version_id AND ce.opportunity_id=od.opportunity_id
  WHERE od.opportunity_id=_opportunity_id AND od.image_choice AND ce.session_hash=encode(extensions.digest(_session,'sha256'),'hex');
  RETURN jsonb_build_object('ok', jsonb_array_length(missing)=0 AND (image_state IS NOT NULL OR NOT EXISTS (SELECT 1 FROM public.opportunity_documents WHERE opportunity_id=_opportunity_id AND image_choice)), 'missing', missing, 'image', image_state);
END $$;

CREATE OR REPLACE FUNCTION public.submit_opportunity_registration(_opportunity_id uuid, _session text, _full_name text, _email text, _answers jsonb)
RETURNS TABLE(protocol text, registration_id uuid, document_token text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.opportunities%ROWTYPE; g jsonb; r record;
BEGIN
  SELECT * INTO o FROM public.opportunities WHERE id=_opportunity_id;
  IF NOT FOUND OR o.status <> 'publicada' THEN RAISE EXCEPTION 'Esta vaga não está recebendo candidaturas no momento.'; END IF;
  IF o.opens_at IS NOT NULL AND o.opens_at > now() THEN RAISE EXCEPTION 'As candidaturas ainda não foram abertas.'; END IF;
  IF o.closes_at IS NOT NULL AND o.closes_at < now() THEN RAISE EXCEPTION 'As candidaturas desta vaga foram encerradas.'; END IF;
  IF o.form_id IS NULL THEN RAISE EXCEPTION 'Vaga sem formulário associado.'; END IF;
  g := public.opportunity_gate(_opportunity_id, _session);
  IF NOT (g->>'ok')::boolean THEN RAISE EXCEPTION 'Os termos obrigatórios ainda não foram aceitos para esta candidatura.'; END IF;
  SELECT * INTO r FROM public.submit_registration_with_dossier(o.form_id, _full_name, _email, _answers);
  UPDATE public.registrations SET opportunity_id=_opportunity_id WHERE id=r.registration_id;
  UPDATE public.consent_events SET registration_id=r.registration_id WHERE opportunity_id=_opportunity_id AND session_hash=encode(extensions.digest(_session,'sha256'),'hex') AND registration_id IS NULL;
  protocol := r.protocol; registration_id := r.registration_id; document_token := r.document_token;
  RETURN NEXT;
END $$;
