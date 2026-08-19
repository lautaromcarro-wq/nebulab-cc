-- Los 18 templates de tareas recurrentes. Se habían cargado a mano en junio
-- 2026 y no quedaron versionados, así que se perdían al reconstruir.
INSERT INTO public.task_templates (workspace_id, title, category, frequency, sort_order)
SELECT 'a0000000-0000-0000-0000-000000000001', v.title, v.cat, v.freq, v.ord
FROM (VALUES
  -- Semanal · Google Ads
  ('Revisión rendimiento de campañas',            'google_ads','weekly',   1),
  ('Revisión rendimiento de ad groups',           'google_ads','weekly',   2),
  ('Revisión rendimiento de keywords',            'google_ads','weekly',   3),
  ('Revisión términos de búsqueda + negativizar', 'google_ads','weekly',   4),
  ('Pacing vs presupuesto',                       'google_ads','weekly',   5),
  -- Semanal · Meta Ads
  ('Revisión resultados de campañas',             'meta_ads','weekly',     6),
  ('Revisión resultados por público (ad sets)',   'meta_ads','weekly',     7),
  ('Revisión de anuncios + fatiga (frecuencia)',  'meta_ads','weekly',     8),
  ('Pacing + proyección mensual',                 'meta_ads','weekly',     9),
  ('Revisión objetivo mensual del cliente',       'meta_ads','weekly',    10),
  -- Semanal · Analytics
  ('Tendencia de tráfico (creciendo/cayendo)',    'analytics','weekly',   11),
  ('Calidad de tráfico (duración + bounce rate)', 'analytics','weekly',   12),
  ('Tasas de conversión por etapa',               'analytics','weekly',   13),
  -- Quincenal · Meta
  ('Revisión de públicos (ad sets)',              'meta_ads','biweekly',  14),
  -- Mensual · Google
  ('Revisión de conversiones',                    'google_ads','monthly', 15),
  ('Revisión salud Merchant Center / catálogo',   'google_ads','monthly', 16),
  -- Mensual · Meta
  ('Revisión de pixel',                           'meta_ads','monthly',   17),
  ('Revisión salud del catálogo',                 'meta_ads','monthly',   18)
) AS v(title, cat, freq, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM public.task_templates t
  WHERE t.workspace_id = 'a0000000-0000-0000-0000-000000000001'
    AND t.title = v.title
);
