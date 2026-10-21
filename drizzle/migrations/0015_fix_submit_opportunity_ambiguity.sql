
CREATE OR REPLACE FUNCTION public.submit_opportunity_registration(_opportunity_id uuid, _session text, _full_name text, _email text, _answers jsonb)
RETURNS TABLE(protocol text, registration_id uuid, document_token text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE o public.opportunities%ROWTYPE; g jsonb; r record; sh text;
BEGIN
  SELECT * INTO o FROM public.opportunities WHERE id=_opportunity_id;
  IF NOT FOUND OR o.status <> 'publicada' THEN RAISE EXCEPTION 'Esta vaga não está recebendo candidaturas no momento.'; END IF;
  IF o.opens_at IS NOT NULL AND o.opens_at > now() THEN RAISE EXCEPTION 'As candidaturas ainda não foram abertas.'; END IF;
  IF o.closes_at IS NOT NULL AND o.closes_at < now() THEN RAISE EXCEPTION 'As candidaturas desta vaga foram encerradas.'; END IF;
  IF o.form_id IS NULL THEN RAISE EXCEPTION 'Vaga sem formulário associado.'; END IF;
  g := public.opportunity_gate(_opportunity_id, _session);
  IF NOT (g->>'ok')::boolean THEN RAISE EXCEPTION 'Os termos obrigatórios ainda não foram aceitos para esta candidatura.'; END IF;
  sh := encode(extensions.digest(_session,'sha256'),'hex');
  SELECT * INTO r FROM public.submit_registration_with_dossier(o.form_id, _full_name, _email, _answers);
  UPDATE public.registrations reg SET opportunity_id=_opportunity_id WHERE reg.id=r.registration_id;
  UPDATE public.consent_events ce SET registration_id=r.registration_id
    WHERE ce.opportunity_id=_opportunity_id AND ce.session_hash=sh AND ce.registration_id IS NULL;
  protocol := r.protocol; registration_id := r.registration_id; document_token := r.document_token;
  RETURN NEXT;
END $$;
