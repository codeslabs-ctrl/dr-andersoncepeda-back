-- Script para insertar acceso menú por perfil en perfiles_menu_acceso
--
-- Requiere que existan: perfiles (id 1=administrador, 2=medico, 3=secretaria, 4=finanzas)
-- y menu_items (id 1..17). Ejecutar después de insert-perfiles-demo.sql e insert-menu-items-demo.sql.
--
-- Cómo ejecutar (PostgreSQL):
--   psql -U tu_usuario -d tu_base_datos -f backend/scripts/insert-perfiles-menu-acceso-demo.sql
--
-- Si (perfil_id, menu_item_id) ya existe, quita esa fila del INSERT para no duplicar (UNIQUE).

INSERT INTO perfiles_menu_acceso (
  perfil_id,
  menu_item_id,
  puede_acceder,
  puede_crear,
  puede_editar,
  puede_eliminar,
  puede_finalizar,
  puede_completar,
  puede_ver_servicios,
  creado_en,
  actualizado_en
) VALUES
-- Perfil 1 (administrador): acceso completo a todos los ítems
(1, 1, true, true, true, true, true, true, true, NOW(), NOW()),
(1, 2, true, true, true, true, true, true, true, NOW(), NOW()),
(1, 3, true, true, true, true, true, true, true, NOW(), NOW()),
(1, 4, true, true, true, true, true, true, true, NOW(), NOW()),
(1, 5, true, true, true, true, true, true, true, NOW(), NOW()),
(1, 6, true, true, true, true, true, true, true, NOW(), NOW()),
(1, 7, true, true, true, true, true, true, true, NOW(), NOW()),
(1, 8, true, true, true, true, true, true, true, NOW(), NOW()),
(1, 9, true, true, true, true, true, true, true, NOW(), NOW()),
(1, 10, true, true, true, true, true, true, true, NOW(), NOW()),
(1, 11, true, true, true, true, true, true, true, NOW(), NOW()),
(1, 12, true, true, true, true, true, true, true, NOW(), NOW()),
(1, 13, true, true, true, true, true, true, true, NOW(), NOW()),
(1, 14, true, true, true, true, true, true, true, NOW(), NOW()),
(1, 15, true, true, true, true, true, true, true, NOW(), NOW()),
(1, 16, true, true, true, true, false, false, false, NOW(), NOW()),
(1, 17, true, false, false, false, false, false, false, NOW(), NOW()),
-- Perfil 2 (medico)
(2, 1, true, false, false, false, false, false, false, NOW(), NOW()),
(2, 2, true, true, true, true, false, false, false, NOW(), NOW()),
(2, 3, true, true, true, true, false, true, false, NOW(), NOW()),
(2, 4, true, true, true, true, false, false, false, NOW(), NOW()),
(2, 8, false, false, false, false, false, false, false, NOW(), NOW()),
(2, 12, true, false, false, false, false, false, false, NOW(), NOW()),
-- Perfil 3 (secretaria)
(3, 1, true, false, false, false, false, false, false, NOW(), NOW()),
(3, 2, true, true, true, true, false, false, false, NOW(), NOW()),
(3, 3, true, true, true, true, true, false, true, NOW(), NOW()),
(3, 4, true, true, true, true, false, false, false, NOW(), NOW()),
-- Perfil 4 (finanzas)
(4, 11, true, false, false, false, false, false, false, NOW(), NOW()),
(4, 12, true, false, false, false, false, false, false, NOW(), NOW());
