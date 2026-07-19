-- Migration: Remove "qc_Lainnya" from unit_checks in service_orders
-- This safely removes the specific JSONB key without affecting other checks.

UPDATE service_orders
SET unit_checks = unit_checks - 'qc_Lainnya'
WHERE unit_checks ? 'qc_Lainnya';