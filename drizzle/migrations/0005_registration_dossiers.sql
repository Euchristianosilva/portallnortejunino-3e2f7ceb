ALTER TABLE public.registration_forms ADD COLUMN legal_documents jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.registrations ADD COLUMN consent_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.registrations ADD COLUMN submission_snapshot jsonb;
CREATE TABLE public.registration_dossier_access(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE, token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL DEFAULT now()+interval '30 minutes');
GRANT ALL ON public.registration_dossier_access TO service_role;
ALTER TABLE public.registration_dossier_access ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.registration_dossiers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE, generated_at timestamptz NOT NULL DEFAULT now(), snapshot jsonb NOT NULL, hash text NOT NULL);
GRANT ALL ON public.registration_dossiers TO service_role;
ALTER TABLE public.registration_dossiers ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.validate_legal_documents() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ DECLARE d jsonb; ids text[]:='{}'; BEGIN
IF jsonb_typeof(new.legal_documents)<>'array' THEN RAISE EXCEPTION 'Documentos inválidos.'; END IF;
FOR d IN SELECT * FROM jsonb_array_elements(new.legal_documents) LOOP
IF coalesce(d->>'id','')='' OR d->>'id'=ANY(ids) OR coalesce(d->>'title','')='' OR coalesce(d->>'version','')='' OR coalesce(d->>'content','')='' OR d->>'kind' NOT IN ('terms','image','privacy','other') OR d->>'published_at' IS NULL THEN RAISE EXCEPTION 'Preencha integralmente o documento e sua versão.'; END IF;
PERFORM (d->>'published_at')::timestamptz; ids:=array_append(ids,d->>'id');
END LOOP; RETURN new; END $$;
CREATE TRIGGER legal_documents_validate BEFORE INSERT OR UPDATE ON public.registration_forms FOR EACH ROW EXECUTE FUNCTION public.validate_legal_documents();
CREATE OR REPLACE FUNCTION public.capture_registration_consents() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE f public.registration_forms; d jsonb; accepted boolean; BEGIN
SELECT * INTO f FROM public.registration_forms WHERE id=new.form_id FOR SHARE;
new.consent_snapshot:='[]'::jsonb;
FOR d IN SELECT * FROM jsonb_array_elements(f.legal_documents) LOOP
accepted:=coalesce(new.answers->>('consent_'||(d->>'id')),'')='true';
IF coalesce((d->>'required')::boolean,false) AND NOT accepted THEN RAISE EXCEPTION 'Aceite obrigatório: %',d->>'title'; END IF;
IF accepted THEN new.consent_snapshot:=new.consent_snapshot||jsonb_build_array(d||jsonb_build_object('agreed',true,'accepted_at',new.created_at)); END IF;
END LOOP;
new.submission_snapshot:=jsonb_build_object('full_name',new.full_name,'email',new.email,'answers',new.answers,'title',f.title,'category',f.category,'created_at',new.created_at);
RETURN new; END $$;
CREATE TRIGGER registration_consent_snapshot BEFORE INSERT ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.capture_registration_consents();
CREATE OR REPLACE FUNCTION public.protect_registration_snapshots() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF new.consent_snapshot IS DISTINCT FROM old.consent_snapshot OR new.submission_snapshot IS DISTINCT FROM old.submission_snapshot THEN RAISE EXCEPTION 'Registros históricos não podem ser alterados.'; END IF; RETURN new; END $$;
CREATE TRIGGER registration_snapshots_immutable BEFORE UPDATE ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.protect_registration_snapshots();
CREATE OR REPLACE FUNCTION public.authorize_registration_dossier(_protocol text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE rid uuid; BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na conta vinculada à inscrição.'; END IF;
SELECT r.id INTO rid FROM public.registrations r WHERE r.protocol=_protocol AND (r.user_id=auth.uid() OR EXISTS(SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL AND lower(u.email)=lower(r.email))) ORDER BY r.created_at DESC LIMIT 1;
IF rid IS NULL THEN RAISE EXCEPTION 'Nenhuma inscrição autorizada para esta conta.'; END IF; RETURN rid; END $$;
REVOKE ALL ON FUNCTION public.authorize_registration_dossier(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.authorize_registration_dossier(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.freeze_dossier() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Uma geração histórica não pode ser alterada.'; END $$;
CREATE TRIGGER dossier_immutable BEFORE UPDATE ON public.registration_dossiers FOR EACH ROW EXECUTE FUNCTION public.freeze_dossier();