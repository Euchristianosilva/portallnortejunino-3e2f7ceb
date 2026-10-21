CREATE OR REPLACE FUNCTION public.access_offboarding(_token text, _ip text, _submission jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
 req public.offboarding_requests; cfg public.offboarding_settings; p public.profiles;
 v_attempts integer; v_window timestamptz := date_trunc('hour',now()); v_iphash text;
 v_name text; v_email text; v_reason text; v_role text;
BEGIN
 v_iphash := encode(digest(coalesce(_ip,'unknown'),'sha256'),'hex');
 INSERT INTO public.offboarding_attempts(ip_hash,window_start,attempts) VALUES(v_iphash,v_window,1)
 ON CONFLICT(ip_hash,window_start) DO UPDATE SET attempts=public.offboarding_attempts.attempts+1 RETURNING attempts INTO v_attempts;
 DELETE FROM public.offboarding_attempts WHERE window_start<now()-interval '1 day';
 IF v_attempts>30 THEN RETURN jsonb_build_object('code','rate_limited','error','Muitas tentativas. Aguarde até a próxima hora.'); END IF;
 SELECT r.* INTO req FROM public.offboarding_requests r WHERE r.token_hash=encode(digest(_token,'sha256'),'hex') FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('code','invalid','error','Link inválido. Confira o endereço recebido ou solicite um novo link à administração.'); END IF;
 IF req.status IN ('recebida','em_analise','concluida') THEN
  IF _submission IS NOT NULL AND (lower(btrim(coalesce(_submission->>'email',''))) IS DISTINCT FROM req.contact_email OR btrim(coalesce(_submission->>'full_name','')) IS DISTINCT FROM req.full_name OR btrim(coalesce(_submission->>'reason','')) IS DISTINCT FROM req.reason OR coalesce(_submission->>'declaration','false')<>'true') THEN
   RETURN jsonb_build_object('code','already_confirmed','error','Esta solicitação já foi confirmada e não pode mais ser editada. Procure a administração para corrigir informações.');
  END IF;
  RETURN jsonb_build_object('code','already_confirmed','success',true,'status',req.status,'submitted_at',req.submitted_at);
 END IF;
 IF req.status='cancelada' THEN RETURN jsonb_build_object('code','cancelled','error','Esta solicitação foi cancelada. Solicite um novo link à administração.'); END IF;
 IF req.status='expirada' OR req.expires_at<=now() THEN
  IF req.status='aguardando' THEN UPDATE public.offboarding_requests SET status='expirada' WHERE id=req.id; END IF;
  RETURN jsonb_build_object('code','expired','error','Este link expirou. Solicite um novo link à administração.');
 END IF;
 IF req.status<>'aguardando' THEN RETURN jsonb_build_object('code','invalid','error','Esta solicitação não pode ser confirmada. Procure a administração.'); END IF;
 SELECT pr.* INTO p FROM public.profiles pr WHERE pr.id=req.user_id;
 IF NOT FOUND OR public.has_role(req.user_id,'master') THEN RETURN jsonb_build_object('code','permission','error','O vínculo desta solicitação não está disponível. Procure a administração.'); END IF;
 v_role := CASE WHEN public.has_role(req.user_id,'coordenacao') THEN 'Coordenação' WHEN public.has_role(req.user_id,'operador') THEN 'Operador' ELSE NULL END;
 IF v_role IS NULL OR v_role IS DISTINCT FROM req.role_label THEN RETURN jsonb_build_object('code','permission','error','O vínculo da equipe mudou. Solicite um novo link à administração.'); END IF;
 SELECT s.* INTO cfg FROM public.offboarding_settings s WHERE s.id=true;
 IF _submission IS NULL THEN RETURN jsonb_build_object('code','valid','title',coalesce(cfg.title,'Solicitação de desligamento voluntário'),'description',coalesce(cfg.description,''),'reason_options',coalesce(cfg.reason_options,'["Outro"]'::jsonb),'role_label',req.role_label,'state',req.state,'expires_at',req.expires_at); END IF;
 v_name:=btrim(coalesce(_submission->>'full_name','')); v_email:=lower(btrim(coalesce(_submission->>'email',''))); v_reason:=btrim(coalesce(_submission->>'reason',''));
 IF length(v_name)<3 OR length(v_name)>150 OR v_email IS DISTINCT FROM lower(btrim(p.email)) OR v_email='' THEN RETURN jsonb_build_object('code','identity','error','Informe seu nome completo e o e-mail vinculado à equipe.'); END IF;
 IF length(v_reason)<3 OR length(v_reason)>5000 OR coalesce(_submission->>'declaration','false')<>'true' THEN RETURN jsonb_build_object('code','validation','error','Informe o motivo e confirme o desligamento voluntário.'); END IF;
 UPDATE public.offboarding_requests SET full_name=v_name,contact_email=v_email,reason=v_reason,declaration=true,status='recebida',submitted_at=now() WHERE id=req.id;
 INSERT INTO public.audit_log(action,entity,entity_id,details) VALUES('request_received','offboarding_requests',req.id::text,jsonb_build_object('status','recebida'));
 RETURN jsonb_build_object('code','confirmed','success',true,'status','recebida','submitted_at',now());
END $$;
REVOKE ALL ON FUNCTION public.access_offboarding(text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.access_offboarding(text,text,jsonb) TO service_role;