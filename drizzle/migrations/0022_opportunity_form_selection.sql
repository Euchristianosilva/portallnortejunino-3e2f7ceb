CREATE OR REPLACE FUNCTION public.save_opportunity(_id uuid, _expected_updated_at timestamptz, _values jsonb, _links jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  uid uuid:=auth.uid();
  oid uuid:=_id;
  cur public.opportunities%ROWTYPE;
  l jsonb;
  i int:=0;
  st text;
  fid uuid;
  old_fid uuid;
  declared_fid uuid;
  form_row record;
  selected_states text[];
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid,'master') OR public.has_permission(uid,'forms')) THEN RAISE EXCEPTION 'Sem permissão para gerenciar vagas.'; END IF;
  st:=COALESCE(_values->>'status','rascunho');
  IF st NOT IN ('rascunho','publicada','pausada','encerrada','arquivada') THEN RAISE EXCEPTION 'Status inválido.'; END IF;
  IF length(trim(COALESCE(_values->>'title',''))) < 3 OR length(_values->>'title') > 150 THEN RAISE EXCEPTION 'Informe o título da vaga (3 a 150 caracteres).'; END IF;
  IF _values ? 'states' AND jsonb_typeof(_values->'states') <> 'array' THEN RAISE EXCEPTION 'Seleção de estados inválida.'; END IF;
  SELECT COALESCE(array_agg(DISTINCT value ORDER BY value),'{}'::text[]) INTO selected_states FROM jsonb_array_elements_text(COALESCE(_values->'states','[]'::jsonb));
  IF NOT selected_states <@ ARRAY['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']::text[] OR array_position(selected_states,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Selecione unidades federativas válidas.'; END IF;
  IF NULLIF(_values->>'seats','') IS NOT NULL AND (_values->>'seats')::int < 1 THEN RAISE EXCEPTION 'A quantidade de vagas deve ser maior que zero.'; END IF;
  IF NULLIF(_values->>'closes_at','') IS NOT NULL AND NULLIF(_values->>'opens_at','') IS NOT NULL AND (_values->>'closes_at')::timestamptz <= (_values->>'opens_at')::timestamptz THEN RAISE EXCEPTION 'O encerramento deve ser depois da abertura.'; END IF;
  IF oid IS NOT NULL THEN
    SELECT * INTO cur FROM public.opportunities WHERE id=oid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Vaga não encontrada.'; END IF;
    IF _expected_updated_at IS NULL OR cur.updated_at <> _expected_updated_at THEN RAISE EXCEPTION 'Esta vaga foi alterada por outra pessoa. Recarregue antes de salvar.'; END IF;
    old_fid:=cur.form_id;
  END IF;
  -- Formulário de inscrição: o administrador pode associar um formulário
  -- existente (não interno) ou manter o cadastro padrão da vaga.
  IF _values ? 'form_id' THEN
    declared_fid:=NULLIF(_values->>'form_id','')::uuid;
    IF declared_fid IS NOT NULL THEN
      SELECT f.id, f.published, f.opportunity_managed INTO form_row FROM public.registration_forms f WHERE f.id=declared_fid;
      IF NOT FOUND THEN RAISE EXCEPTION 'Formulário selecionado não encontrado.'; END IF;
      IF form_row.opportunity_managed THEN RAISE EXCEPTION 'Este formulário é interno de outra vaga e não pode ser selecionado.'; END IF;
      IF st='publicada' AND NOT form_row.published THEN RAISE EXCEPTION 'Para publicar, o formulário selecionado precisa estar publicado.'; END IF;
      fid:=declared_fid;
    ELSIF old_fid IS NOT NULL AND EXISTS(SELECT 1 FROM public.registration_forms f WHERE f.id=old_fid AND f.opportunity_managed) THEN
      fid:=old_fid;
    END IF;
  ELSE
    fid:=old_fid;
  END IF;
  -- Ao trocar a associação, remove o cadastro interno órfão (sem inscrições).
  IF old_fid IS NOT NULL AND fid IS DISTINCT FROM old_fid THEN
    DELETE FROM public.form_versions fv WHERE fv.form_id=old_fid AND EXISTS(SELECT 1 FROM public.registration_forms f WHERE f.id=old_fid AND f.opportunity_managed) AND NOT EXISTS(SELECT 1 FROM public.registrations r WHERE r.form_id=old_fid);
    DELETE FROM public.registration_forms f WHERE f.id=old_fid AND f.opportunity_managed AND NOT EXISTS(SELECT 1 FROM public.registrations r WHERE r.form_id=f.id);
  END IF;
  IF fid IS NULL THEN
    INSERT INTO public.registration_forms(title,description,category,fields,published,unique_per_email,require_login,created_by,opportunity_managed)
    VALUES(trim(_values->>'title'),COALESCE(_values->>'description',''),COALESCE(_values->>'category',''),'[]'::jsonb,true,true,false,uid,true) RETURNING id INTO fid;
  ELSE
    UPDATE public.registration_forms SET title=trim(_values->>'title'),description=COALESCE(_values->>'description',''),category=COALESCE(_values->>'category',''),published=true WHERE id=fid AND opportunity_managed;
  END IF;
  IF oid IS NULL THEN
    INSERT INTO public.opportunities(title,created_by,form_id) VALUES(trim(_values->>'title'),uid,fid) RETURNING id INTO oid;
  END IF;
  UPDATE public.opportunities SET title=trim(_values->>'title'),category=COALESCE(_values->>'category',''),modality=COALESCE(_values->>'modality','voluntaria'),modality_label=COALESCE(_values->>'modality_label',''),project=COALESCE(_values->>'project',''),description=COALESCE(_values->>'description',''),activities=COALESCE(_values->>'activities',''),requirements=COALESCE(_values->>'requirements',''),profile=COALESCE(_values->>'profile',''),seats=NULLIF(_values->>'seats','')::int,states=selected_states,state=CASE WHEN _values ? 'states' THEN '' ELSE COALESCE(cur.state,'') END,city=COALESCE(_values->>'city',''),dedication=COALESCE(_values->>'dedication',''),benefits=COALESCE(_values->>'benefits',''),selection_criteria=COALESCE(_values->>'selection_criteria',''),opens_at=NULLIF(_values->>'opens_at','')::timestamptz,closes_at=NULLIF(_values->>'closes_at','')::timestamptz,status=st,image_url=NULLIF(_values->>'image_url',''),form_id=fid WHERE id=oid;
  DELETE FROM public.opportunity_documents WHERE opportunity_id=oid;
  FOR l IN SELECT * FROM jsonb_array_elements(COALESCE(_links,'[]'::jsonb)) LOOP
    IF NOT EXISTS(SELECT 1 FROM public.legal_document_versions v WHERE v.id=(l->>'version_id')::uuid AND v.document_id=(l->>'document_id')::uuid) THEN RAISE EXCEPTION 'Versão de documento inválida.'; END IF;
    INSERT INTO public.opportunity_documents(opportunity_id,document_id,version_id,required,image_choice,position) VALUES(oid,(l->>'document_id')::uuid,(l->>'version_id')::uuid,COALESCE((l->>'required')::boolean,true),COALESCE((l->>'image_choice')::boolean,false),i);
    i:=i+1;
  END LOOP;
  IF st='publicada' THEN
    IF length(trim(COALESCE(_values->>'description','')))=0 THEN RAISE EXCEPTION 'Para publicar, informe a descrição da vaga.'; END IF;
    IF i=0 THEN RAISE EXCEPTION 'Para publicar, vincule ao menos um termo ou documento à vaga.'; END IF;
    IF EXISTS(SELECT 1 FROM public.opportunity_documents od JOIN public.legal_document_versions v ON v.id=od.version_id WHERE od.opportunity_id=oid AND NOT v.published) THEN RAISE EXCEPTION 'Para publicar, todos os termos vinculados precisam estar com a versão publicada.'; END IF;
  END IF;
  RETURN oid;
END $$;