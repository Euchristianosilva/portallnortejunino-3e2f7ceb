DROP POLICY "image read published or admin" ON storage.objects;
DROP POLICY "image delete unused admin" ON storage.objects;

CREATE POLICY "image read published or admin" ON storage.objects FOR SELECT TO anon, authenticated USING(
  bucket_id = 'portal-images' AND (
    public.has_permission(auth.uid(), 'forms') OR public.has_permission(auth.uid(), 'polls')
    OR EXISTS (SELECT 1 FROM public.registration_forms f WHERE f.image_url = 'storage:' || objects.name AND f.published)
    OR EXISTS (SELECT 1 FROM public.polls p WHERE p.image_url = 'storage:' || objects.name AND p.status <> 'rascunho')
    OR EXISTS (SELECT 1 FROM public.poll_options o JOIN public.polls p ON p.id = o.poll_id WHERE o.image_url = 'storage:' || objects.name AND p.status <> 'rascunho')
  )
);

CREATE POLICY "image delete unused admin" ON storage.objects FOR DELETE TO authenticated USING(
  bucket_id = 'portal-images'
  AND (public.has_permission(auth.uid(), 'forms') OR public.has_permission(auth.uid(), 'polls'))
  AND NOT EXISTS (SELECT 1 FROM public.registration_forms f WHERE f.image_url = 'storage:' || objects.name)
  AND NOT EXISTS (SELECT 1 FROM public.polls p WHERE p.image_url = 'storage:' || objects.name)
  AND NOT EXISTS (SELECT 1 FROM public.poll_options o WHERE o.image_url = 'storage:' || objects.name)
);