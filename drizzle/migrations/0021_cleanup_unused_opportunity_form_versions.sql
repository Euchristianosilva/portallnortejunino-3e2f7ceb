CREATE OR REPLACE FUNCTION public.cleanup_opportunity_candidacy_schema() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.registration_forms f WHERE f.id=OLD.form_id AND f.opportunity_managed) AND NOT EXISTS(SELECT 1 FROM public.opportunities o WHERE o.form_id=OLD.form_id) AND NOT EXISTS(SELECT 1 FROM public.registrations r WHERE r.form_id=OLD.form_id) THEN
  DELETE FROM public.form_versions WHERE form_id=OLD.form_id;
  DELETE FROM public.registration_forms WHERE id=OLD.form_id AND opportunity_managed;
 END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.cleanup_opportunity_candidacy_schema() FROM PUBLIC;