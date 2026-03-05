-- Script para insertar parámetros de clínica demo en la tabla parametros_clinicas
--
-- Cómo ejecutar (PostgreSQL):
--   psql -U tu_usuario -d tu_base_datos -f backend/scripts/insert-parametros-clinicas-demo.sql
-- O desde psql: \i ruta/completa/insert-parametros-clinicas-demo.sql
--
-- Ajusta los nombres de columnas si tu tabla difiere (id, nombre_clinica, razon_social, etc.).

-- Opción 1: Con fechas actuales (recomendado para clonar)
INSERT INTO parametros_clinicas (
  nombre_clinica,
  razon_social,
  plan,
  maximo_medicos,
  maximo_pacientes,
  costo_base,
  fecha_inicio,
  fecha_fin,
  estatus,
  fecha_creacion,
  fecha_actualizacion
) VALUES (
  'DemoMed - Plataforma de pruebas',
  'Demomed',
  'Plan Profesional',
  12,
  25,
  0.00,
  CURRENT_DATE,
  NULL,
  'activo',
  NOW(),
  NOW()
);

-- Opción 2: Conservar fechas originales (descomenta y comenta la opción 1 si la usas)
/*
INSERT INTO parametros_clinicas (
  nombre_clinica,
  razon_social,
  plan,
  maximo_medicos,
  maximo_pacientes,
  costo_base,
  fecha_inicio,
  fecha_fin,
  estatus,
  fecha_creacion,
  fecha_actualizacion
) VALUES (
  'DemoMed - Plataforma de pruebas',
  'Demomed',
  'Plan Profesional',
  12,
  25,
  0.00,
  '2026-03-01',
  NULL,
  'activo',
  '2026-03-01 09:09:40.337-04',
  '2026-03-01 09:09:40.337-04'
);
*/
