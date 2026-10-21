
-- ============ Documentos legais versionados ============
CREATE TABLE public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'other' CHECK (kind IN ('terms','image','privacy','truth','other')),
  active_version integer NOT NULL DEFAULT 0,
  legal_blockers jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.legal_documents TO anon, authenticated;
GRANT ALL ON public.legal_documents TO service_role;
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Documentos publicados legíveis" ON public.legal_documents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Equipe gerencia documentos" ON public.legal_documents FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'forms') OR public.has_role(auth.uid(),'master')) WITH CHECK (public.has_permission(auth.uid(),'forms') OR public.has_role(auth.uid(),'master'));

CREATE TABLE public.legal_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  version integer NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);
GRANT SELECT ON public.legal_document_versions TO anon, authenticated;
GRANT ALL ON public.legal_document_versions TO service_role;
ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Versões legíveis" ON public.legal_document_versions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Equipe gerencia versões" ON public.legal_document_versions FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'forms') OR public.has_role(auth.uid(),'master')) WITH CHECK (public.has_permission(auth.uid(),'forms') OR public.has_role(auth.uid(),'master'));

-- Versão publicada é imutável: edição exige nova versão
CREATE OR REPLACE FUNCTION public.freeze_legal_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.published AND (NEW.body IS DISTINCT FROM OLD.body OR NEW.title IS DISTINCT FROM OLD.title OR NEW.published IS DISTINCT FROM OLD.published) THEN
    RAISE EXCEPTION 'Versão publicada é imutável; crie uma nova versão.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER freeze_legal_version BEFORE UPDATE ON public.legal_document_versions FOR EACH ROW EXECUTE FUNCTION public.freeze_legal_version();

-- Publicar exige ausência de pendências jurídicas
CREATE OR REPLACE FUNCTION public.publish_legal_version(_document_id uuid, _version integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.legal_documents%ROWTYPE;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'forms') OR public.has_role(auth.uid(),'master')) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  SELECT * INTO d FROM public.legal_documents WHERE id=_document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento não encontrado.'; END IF;
  IF jsonb_array_length(d.legal_blockers) > 0 THEN RAISE EXCEPTION 'Existem pendências jurídicas que impedem a publicação: %', d.legal_blockers; END IF;
  UPDATE public.legal_document_versions SET published=true, published_at=now() WHERE document_id=_document_id AND version=_version;
  UPDATE public.legal_documents SET active_version=_version, updated_at=now() WHERE id=_document_id;
END $$;

-- ============ Vagas ============
CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT '',
  modality text NOT NULL DEFAULT 'voluntaria' CHECK (modality IN ('voluntaria','outra')),
  modality_label text NOT NULL DEFAULT 'Participação voluntária',
  project text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  activities text NOT NULL DEFAULT '',
  requirements text NOT NULL DEFAULT '',
  profile text NOT NULL DEFAULT '',
  seats integer,
  state text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  dedication text NOT NULL DEFAULT '',
  benefits text NOT NULL DEFAULT '',
  selection_criteria text NOT NULL DEFAULT '',
  opens_at timestamptz,
  closes_at timestamptz,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','publicada','pausada','encerrada','arquivada')),
  image_url text,
  form_id uuid REFERENCES public.registration_forms(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.opportunities TO anon, authenticated;
GRANT ALL ON public.opportunities TO service_role;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vagas publicadas visíveis" ON public.opportunities FOR SELECT TO anon, authenticated USING (status <> 'rascunho' AND status <> 'arquivada');
CREATE POLICY "Equipe gerencia vagas" ON public.opportunities FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'forms') OR public.has_role(auth.uid(),'master')) WITH CHECK (public.has_permission(auth.uid(),'forms') OR public.has_role(auth.uid(),'master'));
CREATE TRIGGER touch_opportunities BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Documentos vinculados à vaga, com versão fixada
CREATE TABLE public.opportunity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.legal_document_versions(id) ON DELETE RESTRICT,
  required boolean NOT NULL DEFAULT true,
  image_choice boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  UNIQUE (opportunity_id, document_id)
);
GRANT SELECT ON public.opportunity_documents TO anon, authenticated;
GRANT ALL ON public.opportunity_documents TO service_role;
ALTER TABLE public.opportunity_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vínculos legíveis" ON public.opportunity_documents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Equipe gerencia vínculos" ON public.opportunity_documents FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'forms') OR public.has_role(auth.uid(),'master')) WITH CHECK (public.has_permission(auth.uid(),'forms') OR public.has_role(auth.uid(),'master'));

-- ============ Eventos de consentimento (auditável) ============
CREATE TABLE public.consent_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  registration_id uuid REFERENCES public.registrations(id) ON DELETE SET NULL,
  document_version_id uuid NOT NULL REFERENCES public.legal_document_versions(id) ON DELETE RESTRICT,
  event text NOT NULL CHECK (event IN ('viewed','accepted','refused','revoked')),
  session_hash text NOT NULL,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.consent_events TO service_role;
ALTER TABLE public.consent_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe lê consentimentos" ON public.consent_events FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'registrations') OR public.has_role(auth.uid(),'master'));
CREATE INDEX consent_events_gate ON public.consent_events (opportunity_id, session_hash, document_version_id, created_at DESC);

ALTER TABLE public.registrations ADD COLUMN opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL;

-- ============ RPCs públicas ============
CREATE OR REPLACE FUNCTION public.list_public_opportunities() RETURNS SETOF public.opportunities LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.opportunities WHERE status IN ('publicada','pausada','encerrada') ORDER BY created_at DESC LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.opportunity_public_source(_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.opportunities%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.opportunities WHERE id=_id AND status <> 'rascunho' AND status <> 'arquivada';
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'opportunity', to_jsonb(o),
    'documents', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'link_id', od.id, 'document_id', od.document_id, 'version_id', od.version_id,
      'title', v.title, 'version', v.version, 'published_at', v.published_at,
      'body', v.body, 'required', od.required, 'image_choice', od.image_choice, 'kind', d.kind
    ) ORDER BY od.position) FROM public.opportunity_documents od
    JOIN public.legal_document_versions v ON v.id=od.version_id
    JOIN public.legal_documents d ON d.id=od.document_id
    WHERE od.opportunity_id=o.id), '[]'::jsonb)
  );
END $$;

-- Registra eventos de consentimento da sessão de candidatura
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
    VALUES (_opportunity_id, vid, etext, encode(digest(_session,'sha256'),'hex'), auth.uid());
  END LOOP;
END $$;

-- Estado do portão: quais termos obrigatórios faltam para esta sessão
CREATE OR REPLACE FUNCTION public.opportunity_gate(_opportunity_id uuid, _session text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE missing jsonb; image_state text;
BEGIN
  IF _session !~ '^[0-9a-f-]{36}$' THEN RETURN jsonb_build_object('ok', false, 'missing', '[]'::jsonb, 'image', null); END IF;
  SELECT COALESCE(jsonb_agg(od.version_id),'[]'::jsonb) INTO missing
  FROM public.opportunity_documents od
  WHERE od.opportunity_id=_opportunity_id AND od.required AND NOT od.image_choice
    AND NOT EXISTS (SELECT 1 FROM public.consent_events ce WHERE ce.opportunity_id=_opportunity_id AND ce.document_version_id=od.version_id AND ce.session_hash=encode(digest(_session,'sha256'),'hex') AND ce.event='accepted');
  SELECT CASE WHEN bool_or(ce.event='accepted') THEN 'authorized' WHEN bool_or(ce.event='refused') THEN 'refused' ELSE NULL END INTO image_state
  FROM public.opportunity_documents od JOIN public.consent_events ce ON ce.document_version_id=od.version_id AND ce.opportunity_id=od.opportunity_id
  WHERE od.opportunity_id=_opportunity_id AND od.image_choice AND ce.session_hash=encode(digest(_session,'sha256'),'hex');
  RETURN jsonb_build_object('ok', jsonb_array_length(missing)=0 AND (image_state IS NOT NULL OR NOT EXISTS (SELECT 1 FROM public.opportunity_documents WHERE opportunity_id=_opportunity_id AND image_choice)), 'missing', missing, 'image', image_state);
END $$;

-- Envio da candidatura: valida portão e status no servidor
CREATE OR REPLACE FUNCTION public.submit_opportunity_registration(_opportunity_id uuid, _session text, _full_name text, _email text, _answers jsonb)
RETURNS TABLE(protocol text, registration_id uuid, document_token text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.opportunities%ROWTYPE; g jsonb; r record; tok text;
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
  UPDATE public.consent_events SET registration_id=r.registration_id WHERE opportunity_id=_opportunity_id AND session_hash=encode(digest(_session,'sha256'),'hex') AND registration_id IS NULL;
  protocol := r.protocol; registration_id := r.registration_id; document_token := r.document_token;
  RETURN NEXT;
END $$;

-- ============ Documentos-base (rascunhos, com pendências jurídicas) ============
INSERT INTO public.legal_documents (slug, title, kind, legal_blockers) VALUES
('termo-participacao-voluntaria','Termo de Ciência e Adesão à Participação Voluntária','terms','["Informar a razão social/CNPJ da entidade responsável","Confirmar a modalidade jurídica da participação com assessoria jurídica","Definir o responsável legal signatário"]'::jsonb),
('autorizacao-uso-imagem','Termo de Autorização de Uso de Imagem, Voz e Nome','image','["Definir prazo de vigência da autorização","Definir finalidade e canais autorizados de uso","Informar a razão social/CNPJ da entidade responsável"]'::jsonb),
('aviso-privacidade','Aviso de Privacidade e Tratamento de Dados','privacy','["Definir o contato oficial do encarregado de dados (DPO)","Informar a razão social/CNPJ da entidade controladora","Definir a política de retenção dos dados"]'::jsonb),
('declaracao-veracidade','Declaração de Veracidade das Informações e Ciência das Regras da Candidatura','truth','["Revisão jurídica do texto antes da publicação"]'::jsonb);

INSERT INTO public.legal_document_versions (document_id, version, title, body)
SELECT id, 1, title,
CASE slug
WHEN 'termo-participacao-voluntaria' THEN 'RASCUNHO — sujeito a revisão jurídica antes da publicação.

1. Do objeto: a participação na atividade descrita na vaga ocorre na modalidade informada na página da vaga, observadas as condições reais da atividade.
2. Das condições: a dedicação, os horários e as responsabilidades são os descritos na vaga; qualquer alteração será comunicada previamente.
3. Declarações: o participante declara ter ciência das condições da atividade e das regras de convivência do projeto.
4. Este termo não constitui renúncia de direitos nem afasta a classificação jurídica que couber às condições reais da atividade.

[Pendente: razão social/CNPJ da entidade, modalidade jurídica confirmada e signatário responsável.]'
WHEN 'autorizacao-uso-imagem' THEN 'RASCUNHO — sujeito a revisão jurídica antes da publicação.

1. Objeto: autorização específica para uso de imagem, voz e nome do(a) participante.
2. Finalidade e canais: [a definir pelo administrador — finalidade real da atividade e canais autorizados].
3. Prazo: [a definir — prazo de vigência da autorização].
4. A autorização é gratuita, específica e pode ser revogada a qualquer tempo pelo canal oficial de contato, sem efeitos retroativos.
5. A não autorização não impede a candidatura quando a imagem não for necessária à atividade.

[Pendente: razão social/CNPJ, prazo, finalidade e canais.]'
WHEN 'aviso-privacidade' THEN 'RASCUNHO — sujeito a revisão jurídica antes da publicação.

1. Controlador: [razão social/CNPJ a definir].
2. Dados coletados: os informados no formulário de candidatura e os registros de aceite deste portal.
3. Finalidades: condução do processo de seleção, comunicação sobre a candidatura e cumprimento de obrigações legais.
4. Compartilhamento: restrito à equipe de seleção autorizada.
5. Direitos do titular: confirmação, acesso, correção, eliminação e revogação de consentimentos, pelo canal oficial.
6. Encarregado de dados (DPO): [contato oficial a definir].
7. Retenção: [política de retenção a definir].'
ELSE 'RASCUNHO — sujeito a revisão jurídica antes da publicação.

1. O(A) candidato(a) declara que as informações prestadas no formulário são verdadeiras e completas.
2. Declara ter ciência das regras da candidatura descritas na página da vaga, incluindo critérios de avaliação e prazos.
3. Declara que o texto deste documento foi disponibilizado integralmente antes do aceite e que teve oportunidade de consultá-lo.
4. Declarações falsas podem acarretar a desclassificação da candidatura, sem prejuízo de outras medidas cabíveis.'
END
FROM public.legal_documents;
