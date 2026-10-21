ALTER TABLE public.registration_forms ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS form_version integer NOT NULL DEFAULT 1;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS fields_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE public.registrations r SET fields_snapshot=f.fields FROM public.registration_forms f WHERE f.id=r.form_id;
CREATE TABLE public.form_versions (form_id uuid NOT NULL REFERENCES public.registration_forms(id), version integer NOT NULL, title text NOT NULL, fields jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(form_id,version));
GRANT SELECT ON public.form_versions TO authenticated; GRANT ALL ON public.form_versions TO service_role;
ALTER TABLE public.form_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "versions admin read" ON public.form_versions FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'forms') OR public.has_permission(auth.uid(),'registrations'));
INSERT INTO public.form_versions(form_id,version,title,fields) SELECT id,version,title,fields FROM public.registration_forms;
CREATE FUNCTION public.version_registration_form() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE fld jsonb; keys text[] := '{}';
BEGIN
 IF new.opens_at IS NOT NULL AND new.closes_at IS NOT NULL AND new.closes_at<=new.opens_at THEN RAISE EXCEPTION 'O encerramento deve ser após a abertura.'; END IF;
 IF jsonb_typeof(new.fields)<>'array' THEN RAISE EXCEPTION 'Campos inválidos.'; END IF;
 FOR fld IN SELECT * FROM jsonb_array_elements(new.fields) LOOP
  IF coalesce(fld->>'key','') !~ '^[a-z0-9_]+$' OR length(btrim(coalesce(fld->>'label','')))=0 OR fld->>'key'=ANY(keys) THEN RAISE EXCEPTION 'Informe campos com rótulos e chaves únicas.'; END IF;
  IF fld->>'type' NOT IN ('text','textarea','email','phone','number','date','select','radio','multiselect','checkbox','file') THEN RAISE EXCEPTION 'Tipo de campo inválido.'; END IF;
  keys := array_append(keys,fld->>'key');
 END LOOP;
 IF TG_OP='UPDATE' THEN
  IF new.fields IS DISTINCT FROM old.fields OR new.title IS DISTINCT FROM old.title THEN new.version := old.version+1; ELSE new.version:=old.version; END IF;
 END IF;
 INSERT INTO public.form_versions(form_id,version,title,fields) VALUES(new.id,new.version,new.title,new.fields) ON CONFLICT DO NOTHING;
 RETURN new;
END $$;
CREATE TRIGGER forms_version BEFORE INSERT OR UPDATE ON public.registration_forms FOR EACH ROW EXECUTE FUNCTION public.version_registration_form();
-- The version row is inserted before the form exists; defer the foreign key until commit.
ALTER TABLE public.form_versions ALTER CONSTRAINT form_versions_form_id_fkey DEFERRABLE INITIALLY DEFERRED;
CREATE FUNCTION public.capture_registration_version() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.registration_forms; fld jsonb; v text; selected text; arr jsonb;
BEGIN
 SELECT * INTO f FROM public.registration_forms WHERE id=new.form_id;
 new.form_version:=f.version; new.fields_snapshot:=f.fields;
 FOR fld IN SELECT * FROM jsonb_array_elements(f.fields) LOOP
  v:=btrim(coalesce(new.answers->>(fld->>'key'),''));
  IF coalesce((fld->>'required')::boolean,false) AND (v='' OR (fld->>'type'='checkbox' AND v<>'true') OR (fld->>'type'='multiselect' AND v='[]')) THEN RAISE EXCEPTION 'Campo obrigatório: %',fld->>'label'; END IF;
  IF v='' THEN CONTINUE; END IF;
  IF fld->>'type'='email' AND v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'E-mail inválido: %',fld->>'label'; END IF;
  IF fld->>'type'='number' AND v !~ '^-?[0-9]+(\.[0-9]+)?$' THEN RAISE EXCEPTION 'Número inválido: %',fld->>'label'; END IF;
  IF fld->>'type'='date' THEN BEGIN PERFORM v::date; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Data inválida: %',fld->>'label'; END; END IF;
  IF fld->>'type' IN ('select','radio') AND NOT (coalesce(fld->'options','[]') ? v) THEN RAISE EXCEPTION 'Alternativa inválida: %',fld->>'label'; END IF;
  IF fld->>'type'='multiselect' THEN
   BEGIN arr:=v::jsonb; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Seleção inválida.'; END;
   IF jsonb_typeof(arr)<>'array' THEN RAISE EXCEPTION 'Seleção inválida.'; END IF;
   FOR selected IN SELECT jsonb_array_elements_text(arr) LOOP IF NOT (coalesce(fld->'options','[]') ? selected) THEN RAISE EXCEPTION 'Alternativa inválida.'; END IF; END LOOP;
  END IF;
  IF fld->>'type'='file' AND (auth.uid() IS NULL OR v NOT LIKE auth.uid()::text||'/%' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='registration-files' AND name=v)) THEN RAISE EXCEPTION 'Envie um arquivo válido usando sua conta.'; END IF;
 END LOOP;
 RETURN new;
END $$;
CREATE TRIGGER registration_version BEFORE INSERT ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.capture_registration_version();
CREATE POLICY "image upload admin" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='portal-images' AND (public.has_permission(auth.uid(),'forms') OR public.has_permission(auth.uid(),'polls')) AND (storage.foldername(name))[1]=auth.uid()::text AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp') AND metadata->>'mimetype' IN ('image/jpeg','image/png','image/webp'));
CREATE POLICY "image read published or admin" ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='portal-images' AND (public.has_permission(auth.uid(),'forms') OR public.has_permission(auth.uid(),'polls') OR EXISTS(SELECT 1 FROM public.registration_forms f WHERE f.image_url='storage:'||name AND f.published) OR EXISTS(SELECT 1 FROM public.polls p WHERE p.image_url='storage:'||name AND p.status<>'rascunho') OR EXISTS(SELECT 1 FROM public.poll_options o JOIN public.polls p ON p.id=o.poll_id WHERE o.image_url='storage:'||name AND p.status<>'rascunho')));
CREATE POLICY "image delete unused admin" ON storage.objects FOR DELETE TO authenticated USING(bucket_id='portal-images' AND (public.has_permission(auth.uid(),'forms') OR public.has_permission(auth.uid(),'polls')) AND NOT EXISTS(SELECT 1 FROM public.registration_forms WHERE image_url='storage:'||name) AND NOT EXISTS(SELECT 1 FROM public.polls WHERE image_url='storage:'||name) AND NOT EXISTS(SELECT 1 FROM public.poll_options WHERE image_url='storage:'||name));
CREATE POLICY "registration file upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='registration-files' AND (storage.foldername(name))[1]=auth.uid()::text AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','pdf') AND metadata->>'mimetype' IN ('image/jpeg','image/png','image/webp','application/pdf'));
CREATE POLICY "registration file read" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='registration-files' AND ((storage.foldername(name))[1]=auth.uid()::text OR public.has_permission(auth.uid(),'registrations')));
CREATE TABLE public.offboarding_settings(id boolean PRIMARY KEY DEFAULT true CHECK(id), title text NOT NULL DEFAULT 'Solicitação de desligamento voluntário', description text NOT NULL DEFAULT 'Revise suas informações e confirme sua vontade de solicitar o desligamento.', reason_options jsonb NOT NULL DEFAULT '["Motivos pessoais","Disponibilidade","Outro"]', updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE ON public.offboarding_settings TO authenticated; GRANT ALL ON public.offboarding_settings TO service_role;
ALTER TABLE public.offboarding_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offboarding settings master" ON public.offboarding_settings FOR ALL TO authenticated USING(public.has_role(auth.uid(),'master')) WITH CHECK(public.has_role(auth.uid(),'master'));
CREATE TRIGGER offboarding_settings_touch BEFORE UPDATE ON public.offboarding_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER audit_offboarding_settings AFTER INSERT OR UPDATE ON public.offboarding_settings FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TABLE public.offboarding_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id), token_hash text NOT NULL UNIQUE, role_label text NOT NULL, state text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'aguardando' CHECK(status IN ('aguardando','recebida','em_analise','concluida','cancelada','expirada')), expires_at timestamptz NOT NULL, full_name text, contact_email text, reason text, declaration boolean NOT NULL DEFAULT false, admin_note text NOT NULL DEFAULT '', submitted_at timestamptz, completed_at timestamptz, created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.offboarding_requests TO authenticated; GRANT ALL ON public.offboarding_requests TO service_role;
ALTER TABLE public.offboarding_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offboarding master read" ON public.offboarding_requests FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'master'));
REVOKE SELECT ON public.offboarding_requests FROM authenticated;
GRANT SELECT(id,user_id,role_label,state,status,expires_at,full_name,contact_email,reason,declaration,admin_note,submitted_at,completed_at,created_by,created_at,updated_at) ON public.offboarding_requests TO authenticated;
CREATE TRIGGER offboarding_touch BEFORE UPDATE ON public.offboarding_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.offboarding_attempts(ip_hash text NOT NULL, window_start timestamptz NOT NULL, attempts integer NOT NULL DEFAULT 0, PRIMARY KEY(ip_hash,window_start));
GRANT ALL ON public.offboarding_attempts TO service_role;
ALTER TABLE public.offboarding_attempts ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.create_offboarding_invite(_user_id uuid,_days integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE token text; rid uuid; p public.profiles; role_name text;
BEGIN
 IF NOT public.has_role(auth.uid(),'master') THEN RAISE EXCEPTION 'Acesso restrito ao master.'; END IF;
 IF _days<1 OR _days>90 THEN RAISE EXCEPTION 'Validade entre 1 e 90 dias.'; END IF;
 SELECT * INTO p FROM public.profiles WHERE id=_user_id;
 IF NOT FOUND OR NOT public.is_staff(_user_id) OR public.has_role(_user_id,'master') THEN RAISE EXCEPTION 'Selecione uma pessoa da equipe ou coordenação que não seja master.'; END IF;
 IF EXISTS(SELECT 1 FROM public.offboarding_requests WHERE user_id=_user_id AND status IN ('aguardando','recebida','em_analise') AND expires_at>now()) THEN RAISE EXCEPTION 'Já existe uma solicitação em andamento. Cancele-a antes de gerar outro link.'; END IF;
 role_name:=CASE WHEN public.has_role(_user_id,'coordenacao') THEN 'Coordenação' ELSE 'Operador' END;
 token:=encode(gen_random_bytes(32),'hex');
 INSERT INTO public.offboarding_requests(user_id,token_hash,role_label,state,expires_at,created_by) VALUES(_user_id,encode(digest(token,'sha256'),'hex'),role_name,coalesce(p.state,''),now()+make_interval(days=>_days),auth.uid()) RETURNING id INTO rid;
 INSERT INTO public.audit_log(actor_id,action,entity,entity_id,details) VALUES(auth.uid(),'invite_created','offboarding_requests',rid::text,jsonb_build_object('user_id',_user_id,'days',_days));
 RETURN jsonb_build_object('id',rid,'token',token);
END $$;
REVOKE ALL ON FUNCTION public.create_offboarding_invite(uuid,integer) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.create_offboarding_invite(uuid,integer) TO authenticated;
CREATE FUNCTION public.access_offboarding(_token text,_ip text,_submission jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE req public.offboarding_requests; cfg public.offboarding_settings; p public.profiles; count_attempts integer; win timestamptz:=date_trunc('hour',now()); iphash text; n text; e text; reason text;
BEGIN
 iphash:=encode(digest(coalesce(_ip,'unknown'),'sha256'),'hex');
 INSERT INTO public.offboarding_attempts(ip_hash,window_start,attempts) VALUES(iphash,win,1) ON CONFLICT(ip_hash,window_start) DO UPDATE SET attempts=public.offboarding_attempts.attempts+1 RETURNING attempts INTO count_attempts;
 DELETE FROM public.offboarding_attempts WHERE window_start<now()-interval '1 day';
 IF count_attempts>30 THEN RETURN jsonb_build_object('error','Muitas tentativas. Aguarde até a próxima hora.'); END IF;
 SELECT * INTO req FROM public.offboarding_requests WHERE token_hash=encode(digest(_token,'sha256'),'hex') FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','Link inválido ou indisponível.'); END IF;
 IF req.status<>'aguardando' THEN RETURN jsonb_build_object('error','Este link já foi utilizado ou cancelado.'); END IF;
 IF req.expires_at<=now() THEN UPDATE public.offboarding_requests SET status='expirada' WHERE id=req.id; RETURN jsonb_build_object('error','Este link expirou. Solicite um novo link à administração.'); END IF;
 SELECT * INTO cfg FROM public.offboarding_settings WHERE id=true;
 IF _submission IS NULL THEN RETURN jsonb_build_object('title',coalesce(cfg.title,'Solicitação de desligamento voluntário'),'description',coalesce(cfg.description,''),'reason_options',coalesce(cfg.reason_options,'["Outro"]'::jsonb),'role_label',req.role_label,'state',req.state,'expires_at',req.expires_at); END IF;
 SELECT * INTO p FROM public.profiles WHERE id=req.user_id;
 n:=btrim(coalesce(_submission->>'full_name','')); e:=lower(btrim(coalesce(_submission->>'email',''))); reason:=btrim(coalesce(_submission->>'reason',''));
 IF length(n)<3 OR length(n)>150 OR e<>lower(p.email) OR e='' THEN RETURN jsonb_build_object('error','Informe seu nome completo e o e-mail vinculado à equipe.'); END IF;
 IF length(reason)<3 OR length(reason)>5000 OR coalesce(_submission->>'declaration','false')<>'true' THEN RETURN jsonb_build_object('error','Informe o motivo e confirme o desligamento voluntário.'); END IF;
 UPDATE public.offboarding_requests SET full_name=n,contact_email=e,reason=reason,declaration=true,status='recebida',submitted_at=now() WHERE id=req.id;
 INSERT INTO public.audit_log(action,entity,entity_id,details) VALUES('request_received','offboarding_requests',req.id::text,jsonb_build_object('status','recebida'));
 RETURN jsonb_build_object('success',true);
END $$;
REVOKE ALL ON FUNCTION public.access_offboarding(text,text,jsonb) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.access_offboarding(text,text,jsonb) TO service_role;
CREATE FUNCTION public.update_offboarding(_id uuid,_status text,_note text,_expected_updated_at timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE req public.offboarding_requests;
BEGIN
 IF NOT public.has_role(auth.uid(),'master') THEN RAISE EXCEPTION 'Acesso restrito ao master.'; END IF;
 SELECT * INTO req FROM public.offboarding_requests WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
 IF _expected_updated_at IS NULL OR date_trunc('milliseconds',req.updated_at)<>date_trunc('milliseconds',_expected_updated_at) THEN RAISE EXCEPTION 'Esta solicitação foi alterada. Atualize antes de salvar.'; END IF;
 IF req.status IN ('concluida','cancelada','expirada') THEN RAISE EXCEPTION 'Esta solicitação já foi finalizada.'; END IF;
 IF NOT ((req.status='aguardando' AND _status='cancelada') OR (req.status IN ('recebida','em_analise') AND _status IN ('recebida','em_analise','concluida','cancelada'))) THEN RAISE EXCEPTION 'Alteração de status não permitida.'; END IF;
 IF _status='concluida' THEN
  IF public.has_role(req.user_id,'master') THEN RAISE EXCEPTION 'Não é permitido desligar uma conta master.'; END IF;
  DELETE FROM public.user_permissions WHERE user_id=req.user_id;
  DELETE FROM public.user_roles WHERE user_id=req.user_id AND role IN ('coordenacao','operador');
 END IF;
 UPDATE public.offboarding_requests SET status=_status,admin_note=left(coalesce(_note,''),5000),completed_at=CASE WHEN _status='concluida' THEN now() ELSE NULL END WHERE id=_id;
 INSERT INTO public.audit_log(actor_id,action,entity,entity_id,details) VALUES(auth.uid(),'status_change','offboarding_requests',_id::text,jsonb_build_object('from',req.status,'to',_status));
END $$;
REVOKE ALL ON FUNCTION public.update_offboarding(uuid,text,text,timestamptz) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.update_offboarding(uuid,text,text,timestamptz) TO authenticated;
CREATE FUNCTION public.portal_report(_kind text,_from timestamptz DEFAULT NULL,_to timestamptz DEFAULT NULL,_category text DEFAULT '',_status text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.has_role(auth.uid(),'master') THEN RAISE EXCEPTION 'Relatórios restritos ao master.'; END IF;
 IF _kind='registrations' THEN
 SELECT coalesce(jsonb_agg(jsonb_build_object('registro',r.protocol,'nome',r.full_name,'email',r.email,'categoria',f.category,'formulario',f.title,'status',r.status,'data',r.created_at) ORDER BY r.created_at DESC),'[]') INTO result FROM public.registrations r JOIN public.registration_forms f ON f.id=r.form_id WHERE (_from IS NULL OR r.created_at>=_from) AND (_to IS NULL OR r.created_at<_to) AND (_category='' OR f.category=_category) AND (_status='' OR r.status::text=_status);
 ELSIF _kind='forms' THEN
 SELECT coalesce(jsonb_agg(jsonb_build_object('titulo',f.title,'categoria',f.category,'status',CASE WHEN f.published THEN 'Publicado' ELSE 'Rascunho' END,'envios',(SELECT count(*) FROM public.registrations r WHERE r.form_id=f.id AND (_from IS NULL OR r.created_at>=_from) AND (_to IS NULL OR r.created_at<_to)),'versao',f.version,'data',f.created_at)),'[]') INTO result FROM public.registration_forms f WHERE (_category='' OR f.category=_category) AND (_status='' OR CASE WHEN f.published THEN 'publicado' ELSE 'rascunho' END=_status);
 ELSIF _kind='polls' THEN
 SELECT coalesce(jsonb_agg(jsonb_build_object('titulo',p.title,'categoria',p.category,'status',p.status,'resultados',p.results_visibility,'inicio',p.starts_at,'encerramento',p.ends_at,'data',p.created_at)),'[]') INTO result FROM public.polls p WHERE (_from IS NULL OR p.created_at>=_from) AND (_to IS NULL OR p.created_at<_to) AND (_category='' OR p.category=_category) AND (_status='' OR p.status::text=_status);
 ELSIF _kind='results' THEN
 SELECT coalesce(jsonb_agg(jsonb_build_object('titulo',p.title,'categoria',p.category,'status',p.status,'resultados',p.results_visibility,'data',p.ends_at)),'[]') INTO result FROM public.polls p WHERE p.status NOT IN ('rascunho','cancelada') AND (p.results_visibility='ao_vivo' OR (p.results_visibility='apos_encerramento' AND (p.status='encerrada' OR p.ends_at<now()))) AND (_from IS NULL OR coalesce(p.ends_at,p.created_at)>=_from) AND (_to IS NULL OR coalesce(p.ends_at,p.created_at)<_to) AND (_category='' OR p.category=_category);
 ELSIF _kind='team' THEN
 SELECT coalesce(jsonb_agg(jsonb_build_object('nome',p.full_name,'email',p.email,'estado',p.state,'funcao',r.role,'data',r.created_at)),'[]') INTO result FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id WHERE r.role IN ('master','coordenacao','operador') AND (_from IS NULL OR r.created_at>=_from) AND (_to IS NULL OR r.created_at<_to) AND (_status='' OR r.role::text=_status);
 ELSIF _kind='offboarding' THEN
 SELECT coalesce(jsonb_agg(jsonb_build_object('nome',coalesce(r.full_name,p.full_name),'email',coalesce(r.contact_email,p.email),'funcao',r.role_label,'estado',r.state,'status',CASE WHEN r.status='aguardando' AND r.expires_at<=now() THEN 'expirada' ELSE r.status END,'data',r.created_at,'envio',r.submitted_at,'conclusao',r.completed_at)),'[]') INTO result FROM public.offboarding_requests r JOIN public.profiles p ON p.id=r.user_id WHERE (_from IS NULL OR r.created_at>=_from) AND (_to IS NULL OR r.created_at<_to) AND (_status='' OR r.status=_status);
 ELSE RAISE EXCEPTION 'Relatório inválido.'; END IF;
 INSERT INTO public.audit_log(actor_id,action,entity,details) VALUES(auth.uid(),'report_viewed','reports',jsonb_build_object('kind',_kind));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.portal_report(text,timestamptz,timestamptz,text,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.portal_report(text,timestamptz,timestamptz,text,text) TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.offboarding_requests,public.offboarding_settings,public.contact_messages,public.user_roles,public.user_permissions;
