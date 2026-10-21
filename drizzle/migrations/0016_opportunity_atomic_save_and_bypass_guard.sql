
-- Salvamento atômico da vaga + vínculos de termos, com validação de publicação no servidor
CREATE OR REPLACE FUNCTION public.save_opportunity(_id uuid, _expected_updated_at timestamptz, _values jsonb, _links jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); oid uuid := _id; cur public.opportunities%ROWTYPE; l jsonb; i int := 0; st text;
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid,'master') OR public.has_permission(uid,'forms')) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar vagas.';
  END IF;
  st := COALESCE(_values->>'status','rascunho');
  IF st NOT IN ('rascunho','publicada','pausada','encerrada','arquivada') THEN RAISE EXCEPTION 'Status inválido.'; END IF;
  IF length(trim(COALESCE(_values->>'title',''))) < 3 THEN RAISE EXCEPTION 'Informe o título da vaga.'; END IF;

  IF oid IS NULL THEN
    INSERT INTO public.opportunities (title, category, modality, modality_label, project, description, activities, requirements, profile, seats, state, city, dedication, benefits, selection_criteria, opens_at, closes_at, status, image_url, form_id, created_by)
    VALUES (_values->>'title', COALESCE(_values->>'category',''), COALESCE(_values->>'modality','voluntaria'), COALESCE(_values->>'modality_label',''), COALESCE(_values->>'project',''),
      COALESCE(_values->>'description',''), COALESCE(_values->>'activities',''), COALESCE(_values->>'requirements',''), COALESCE(_values->>'profile',''),
      NULLIF(_values->>'seats','')::int, COALESCE(_values->>'state',''), COALESCE(_values->>'city',''), COALESCE(_values->>'dedication',''), COALESCE(_values->>'benefits',''),
      COALESCE(_values->>'selection_criteria',''), NULLIF(_values->>'opens_at','')::timestamptz, NULLIF(_values->>'closes_at','')::timestamptz, st,
      NULLIF(_values->>'image_url',''), NULLIF(_values->>'form_id','')::uuid, uid)
    RETURNING id INTO oid;
  ELSE
    SELECT * INTO cur FROM public.opportunities WHERE id=oid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Vaga não encontrada.'; END IF;
    IF _expected_updated_at IS NOT NULL AND cur.updated_at <> _expected_updated_at THEN
      RAISE EXCEPTION 'Esta vaga foi alterada por outra pessoa. Recarregue antes de salvar.';
    END IF;
    UPDATE public.opportunities SET
      title=_values->>'title', category=COALESCE(_values->>'category',''), modality=COALESCE(_values->>'modality','voluntaria'), modality_label=COALESCE(_values->>'modality_label',''),
      project=COALESCE(_values->>'project',''), description=COALESCE(_values->>'description',''), activities=COALESCE(_values->>'activities',''),
      requirements=COALESCE(_values->>'requirements',''), profile=COALESCE(_values->>'profile',''), seats=NULLIF(_values->>'seats','')::int,
      state=COALESCE(_values->>'state',''), city=COALESCE(_values->>'city',''), dedication=COALESCE(_values->>'dedication',''), benefits=COALESCE(_values->>'benefits',''),
      selection_criteria=COALESCE(_values->>'selection_criteria',''), opens_at=NULLIF(_values->>'opens_at','')::timestamptz, closes_at=NULLIF(_values->>'closes_at','')::timestamptz,
      status=st, image_url=NULLIF(_values->>'image_url',''), form_id=NULLIF(_values->>'form_id','')::uuid
    WHERE id=oid;
  END IF;

  DELETE FROM public.opportunity_documents WHERE opportunity_id=oid;
  FOR l IN SELECT * FROM jsonb_array_elements(COALESCE(_links,'[]'::jsonb)) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.legal_document_versions v WHERE v.id=(l->>'version_id')::uuid AND v.document_id=(l->>'document_id')::uuid) THEN
      RAISE EXCEPTION 'Versão de documento inválida.';
    END IF;
    INSERT INTO public.opportunity_documents (opportunity_id, document_id, version_id, required, image_choice, position)
    VALUES (oid, (l->>'document_id')::uuid, (l->>'version_id')::uuid, COALESCE((l->>'required')::boolean,true), COALESCE((l->>'image_choice')::boolean,false), i);
    i := i + 1;
  END LOOP;

  IF st = 'publicada' THEN
    IF length(trim(COALESCE(_values->>'description',''))) = 0 THEN RAISE EXCEPTION 'Para publicar, informe a descrição da vaga.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.registration_forms f WHERE f.id=NULLIF(_values->>'form_id','')::uuid AND f.published) THEN
      RAISE EXCEPTION 'Para publicar, associe um formulário publicado à vaga.';
    END IF;
    IF i = 0 THEN RAISE EXCEPTION 'Para publicar, vincule ao menos um termo ou documento à vaga.'; END IF;
    IF EXISTS (SELECT 1 FROM public.opportunity_documents od JOIN public.legal_document_versions v ON v.id=od.version_id WHERE od.opportunity_id=oid AND NOT v.published) THEN
      RAISE EXCEPTION 'Para publicar, todos os termos vinculados precisam estar com a versão publicada.';
    END IF;
    IF NULLIF(_values->>'closes_at','') IS NOT NULL AND NULLIF(_values->>'opens_at','') IS NOT NULL
       AND (_values->>'closes_at')::timestamptz <= (_values->>'opens_at')::timestamptz THEN
      RAISE EXCEPTION 'O encerramento deve ser depois da abertura.';
    END IF;
  END IF;
  RETURN oid;
END $$;
REVOKE ALL ON FUNCTION public.save_opportunity(uuid, timestamptz, jsonb, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_opportunity(uuid, timestamptz, jsonb, jsonb) TO authenticated;

-- Bloqueia o atalho: formulários vinculados a uma vaga só aceitam inscrição pelo fluxo da vaga (com termos)
CREATE OR REPLACE FUNCTION public.guard_opportunity_form_bypass() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(current_setting('pnj.via_opportunity', true),'') <> '1'
     AND EXISTS (SELECT 1 FROM public.opportunities o WHERE o.form_id=NEW.form_id AND o.status <> 'arquivada') THEN
    RAISE EXCEPTION 'Este formulário pertence a uma vaga. Faça a candidatura pela página da vaga, após o aceite dos termos.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS registrations_opportunity_guard ON public.registrations;
CREATE TRIGGER registrations_opportunity_guard BEFORE INSERT ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.guard_opportunity_form_bypass();

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
  PERFORM set_config('pnj.via_opportunity', '1', true);
  SELECT * INTO r FROM public.submit_registration_with_dossier(o.form_id, _full_name, _email, _answers);
  PERFORM set_config('pnj.via_opportunity', '', true);
  UPDATE public.registrations reg SET opportunity_id=_opportunity_id WHERE reg.id=r.registration_id;
  UPDATE public.consent_events ce SET registration_id=r.registration_id
    WHERE ce.opportunity_id=_opportunity_id AND ce.session_hash=sh AND ce.registration_id IS NULL;
  protocol := r.protocol; registration_id := r.registration_id; document_token := r.document_token;
  RETURN NEXT;
END $$;
