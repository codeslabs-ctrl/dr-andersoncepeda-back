-- Script para insertar perfiles demo en la tabla perfiles
--
-- Cómo ejecutar (PostgreSQL):
--   psql -U tu_usuario -d tu_base_datos -f backend/scripts/insert-perfiles-demo.sql
-- O desde psql: \i ruta/completa/insert-perfiles-demo.sql
--
-- Si algún nombre ya existe (UNIQUE), quita esa fila del INSERT para no duplicar.

-- Opción 1: Con fecha actual (recomendado para clonar)
INSERT INTO perfiles (nombre, descripcion, activo, creado_en) VALUES
  ('administrador', 'Administrador del sistema con acceso completo', true, NOW()),
  ('medico', 'Médico con acceso a pacientes, consultas e informes', true, NOW()),
  ('secretaria', 'Secretaria con acceso a pacientes, consultas e informes', true, NOW()),
  ('finanzas', 'Personal de finanzas con acceso al panel financiero', true, NOW());

-- Opción 2: Conservar fechas originales (descomenta y comenta la opción 1 si la usas)
/*
INSERT INTO perfiles (nombre, descripcion, activo, creado_en) VALUES
  ('administrador', 'Administrador del sistema con acceso completo', true, '2026-01-18 12:33:40.058'),
  ('medico', 'Médico con acceso a pacientes, consultas e informes', true, '2026-01-18 12:33:40.058'),
  ('secretaria', 'Secretaria con acceso a pacientes, consultas e informes', true, '2026-01-18 12:33:40.058'),
  ('finanzas', 'Personal de finanzas con acceso al panel financiero', true, '2026-01-18 12:33:40.058');
*/
