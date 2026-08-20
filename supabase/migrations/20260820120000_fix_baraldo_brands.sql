-- Corrección: Leatherman y Doite no son ex clientes.
--
-- Angel Baraldo es distribuidor oficial y marca paraguas de Diana, Casabutik,
-- Spinit, Shilba, Leatherman, Doite y Trento. La relación comercial sigue viva;
-- lo que cambió es que la inversión dejó de ser dedicada por marca y hoy se
-- concentra en Diana y Casabutik.
--
-- Marcarlas "inactive" daba a entender que se perdió al cliente, que es una
-- lectura de negocio equivocada.
UPDATE public.clients
SET status = 'active',
    notes = 'Marca de Angel Baraldo. Sin inversión dedicada actualmente: '
            'la pauta del grupo se concentra en Diana y Casabutik.'
WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'
  AND name IN ('Leatherman', 'Doite');

UPDATE public.clients
SET notes = 'Marca de Angel Baraldo. Sin inversión dedicada actualmente: '
            'la pauta del grupo se concentra en Diana y Casabutik.'
WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'
  AND name IN ('Shilba', 'Spinit', 'Trento');

UPDATE public.clients
SET notes = 'Marca de Angel Baraldo. Concentra la inversión del grupo.'
WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'
  AND name IN ('Diana', 'Casabutik');
