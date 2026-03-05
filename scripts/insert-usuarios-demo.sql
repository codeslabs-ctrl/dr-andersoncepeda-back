-- Script para insertar usuarios de demo en la tabla usuarios
-- Contraseña (ambos): la que corresponde al hash bcrypt indicado abajo
--
-- Cómo ejecutar (PostgreSQL):
--   psql -U tu_usuario -d tu_base_datos -f backend/scripts/insert-usuarios-demo.sql
-- O desde psql: \i ruta/completa/insert-usuarios-demo.sql
--
-- Si username ya existe, quita o comenta el INSERT antes de ejecutar para no duplicar.

-- Opción 1: Insertar con fechas actuales (recomendado para clonar en otro entorno)
INSERT INTO usuarios (
  username,
  email,
  password_hash,
  rol,
  medico_id,
  activo,
  verificado,
  first_login,
  password_changed_at,
  fecha_creacion,
  fecha_actualizacion
) VALUES
(
  'finanzas',
  'finanzas@demomed.com',
  '$2b$10$eXiHbQ28QTl8682UGmS7/OYKNhpw6YcjaJsim/ki14rKcHxyCAsLu',
  'finanzas',
  NULL,
  true,
  true,
  false,
  NULL,
  NOW(),
  NOW()
),
(
  'admin',
  'admin@demomed.com',
  '$2b$10$eXiHbQ28QTl8682UGmS7/OYKNhpw6YcjaJsim/ki14rKcHxyCAsLu',
  'administrador',
  NULL,
  true,
  true,
  false,
  NULL,
  NOW(),
  NOW()
);

-- Opción 2: Si prefieres conservar las fechas originales, descomenta y comenta la opción 1:
/*
INSERT INTO usuarios (
  username,
  email,
  password_hash,
  rol,
  medico_id,
  activo,
  verificado,
  first_login,
  password_changed_at,
  fecha_creacion,
  fecha_actualizacion
) VALUES
(
  'finanzas',
  'finanzas@demomed.com',
  '$2b$10$eXiHbQ28QTl8682UGmS7/OYKNhpw6YcjaJsim/ki14rKcHxyCAsLu',
  'finanzas',
  NULL,
  true,
  true,
  false,
  NULL,
  '2025-11-09 12:25:56.241',
  '2025-11-09 12:25:56.241'
),
(
  'admin',
  'admin@demomed.com',
  '$2b$10$eXiHbQ28QTl8682UGmS7/OYKNhpw6YcjaJsim/ki14rKcHxyCAsLu',
  'administrador',
  NULL,
  true,
  true,
  false,
  '2025-11-19 09:32:53.861-04',
  '2025-11-08 15:18:43.096',
  '2025-11-19 08:32:53.873'
);
*/
