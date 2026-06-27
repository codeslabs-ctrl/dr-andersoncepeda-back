-- Script para insertar ítems de menú demo en la tabla menu_items
--
-- Cómo ejecutar (PostgreSQL):
--   psql -U tu_usuario -d tu_base_datos -f backend/scripts/insert-menu-items-demo.sql
--
-- Se insertan IDs explícitos para que padre_id quede correcto. Al final se actualiza la secuencia.
-- Si la tabla ya tiene filas, puede haber conflicto de id; en ese caso vacía la tabla antes o ajusta los IDs.

-- Opción 1: Con fechas actuales (recomendado para clonar)
INSERT INTO menu_items (id, nombre, icono, ruta, orden, activo, padre_id, tipo, es_visible, creado_en, actualizado_en) VALUES
(1, 'Gestionar', 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z', NULL, 1, true, NULL, 'encabezado', true, NOW(), NOW()),
(2, 'Gestión de Pacientes', 'M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.54 8H17c-.8 0-1.54.37-2.01.99L14 10.5l-1.5-2c-.47-.62-1.21-.99-2.01-.99H9.46c-.8 0-1.54.37-2.01.99L5 10.5l-1.5-2C3.03 8.37 2.29 8 1.5 8H.5l2.54 7.63A1.5 1.5 0 0 0 4.46 18H7v4h2v-4h2v4h2v-4h2v4h2v-4h2v4h2z', '/patients', 1, true, 1, 'opcion', true, NOW(), NOW()),
(3, 'Gestión de Consultas', 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z', '/admin/consultas', 2, true, 1, 'opcion', true, NOW(), NOW()),
(4, 'Informes Médicos', 'M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z', '/admin/informes-medicos', 3, true, 1, 'opcion', true, NOW(), NOW()),
(5, 'Comunicación', 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z', NULL, 2, true, NULL, 'encabezado', true, NOW(), NOW()),
(6, 'Mensajes de Difusión', 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z', '/admin/mensajes', 1, true, 5, 'opcion', true, NOW(), NOW()),
(7, 'Configuración', 'M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z', NULL, 3, true, NULL, 'encabezado', true, NOW(), NOW()),
(8, 'Gestionar Médicos', 'M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.54 8H17c-.8 0-1.54.37-2.01.99L14 10.5l-1.5-2c-.47-.62-1.21-.99-2.01-.99H9.46c-.8 0-1.54.37-2.01.99L5 10.5l-1.5-2C3.03 8.37 2.29 8 1.5 8H.5l2.54 7.63A1.5 1.5 0 0 0 4.46 18H7v4h2v-4h2v4h2v-4h2v4h2v-4h2v4h2z', '/admin/medicos', 1, true, 7, 'opcion', true, NOW(), NOW()),
(9, 'Gestionar Especialidades', 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', '/admin/especialidades', 2, true, 7, 'opcion', true, NOW(), NOW()),
(10, 'Gestionar Servicios', 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z', '/admin/servicios', 3, true, 7, 'opcion', true, NOW(), NOW()),
(11, 'Finanzas', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z', NULL, 4, true, NULL, 'encabezado', true, NOW(), NOW()),
(12, 'Panel Finanzas', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z', '/admin/finanzas', 1, true, 11, 'opcion', true, NOW(), NOW()),
(13, 'Herramientas', 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z', NULL, 5, true, NULL, 'encabezado', true, NOW(), NOW()),
(14, 'Importación Masiva', 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z', '/admin/importacion', 1, true, 13, 'opcion', true, NOW(), NOW()),
(15, 'Ver Estadísticas', 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z', '/statistics', 2, true, 13, 'opcion', true, NOW(), NOW()),
(16, 'Administrar Perfiles', 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z', '/admin/perfiles', 4, true, 7, 'opcion', true, NOW(), NOW()),
(17, 'Gestionar Antecedentes', 'M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.54 8H17c-.8 0-1.54.37-2.01.99L14 10.5l-1.5-2c-.47-.62-1.21-.99-2.01-.99H9.46c-.8 0-1.54.37-2.01.99L5 10.5l-1.5-2C3.03 8.37 2.29 8 1.5 8H.5l2.54 7.63A1.5 1.5 0 0 0 4.46 18H7v4h2v-4h2v4h2v-4h2v4h2v-4h2v4h2z', '/admin/antecedentes', 5, true, 7, 'opcion', true, NOW(), NOW());

-- Actualizar la secuencia para que el próximo id auto-generado sea correcto
SELECT setval(pg_get_serial_sequence('menu_items', 'id'), (SELECT COALESCE(MAX(id), 1) FROM menu_items));
