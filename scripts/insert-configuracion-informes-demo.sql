-- Script para insertar configuración de informes demo en configuracion_informes
--
-- Cómo ejecutar (PostgreSQL):
--   psql -U tu_usuario -d tu_base_datos -f backend/scripts/insert-configuracion-informes-demo.sql
-- O desde psql: \i ruta/completa/insert-configuracion-informes-demo.sql

-- Opción 1: Con fechas actuales (recomendado para clonar)
INSERT INTO configuracion_informes (
  clinica_alias,
  prefijo_numero,
  contador_actual,
  formato_numero,
  dias_vencimiento,
  requiere_firma,
  activo,
  fecha_creacion,
  fecha_actualizacion
) VALUES (
  'demomed',
  'DEM',
  11,
  'DEM-{año}-{contador}',
  30,
  true,
  true,
  NOW(),
  NOW()
);

-- Opción 2: Conservar fechas originales (descomenta y comenta la opción 1 si la usas)
/*
INSERT INTO configuracion_informes (
  clinica_alias,
  prefijo_numero,
  contador_actual,
  formato_numero,
  dias_vencimiento,
  requiere_firma,
  activo,
  fecha_creacion,
  fecha_actualizacion
) VALUES (
  'demomed',
  'DEM',
  11,
  'DEM-{año}-{contador}',
  30,
  true,
  true,
  '2025-12-09 12:45:02.027',
  '2025-12-09 12:45:02.027'
);
*/
