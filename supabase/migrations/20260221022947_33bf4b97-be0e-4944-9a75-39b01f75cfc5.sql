-- Adicionar coluna imported_at
ALTER TABLE public.leads ADD COLUMN imported_at timestamptz;

-- Migrar leads ghost com compra: guardar data de importação e ajustar created_at
UPDATE public.leads
SET imported_at = created_at,
    created_at = COALESCE(first_purchase_at, created_at)
WHERE is_ghost = true AND first_purchase_at IS NOT NULL;

-- Para ghosts sem compra, apenas marcar imported_at
UPDATE public.leads
SET imported_at = created_at
WHERE is_ghost = true AND imported_at IS NULL;