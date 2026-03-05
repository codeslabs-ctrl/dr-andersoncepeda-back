# Backend – Dr Anderson Cepeda

API REST en Node.js (Express + TypeScript) con PostgreSQL para gestión médica: pacientes, consultas, informes, finanzas, autenticación JWT, etc.

## Requisitos

- **Node.js** 18 o superior  
- **PostgreSQL** (acceso a una base de datos)  
- **npm** o yarn  

## Configuración

Los archivos con credenciales y URLs **no se suben al repositorio**. Debes crearlos a partir de los ejemplos:

```bash
# En la carpeta backend
copy config.env.example config.env
copy config.dev.env.example config.dev.env
```

En Linux/Mac: `cp config.env.example config.env` y `cp config.dev.env.example config.dev.env`.

Edita **config.dev.env** (desarrollo) y **config.env** (producción) con:

- **POSTGRES_***: host, puerto, base de datos, usuario y contraseña  
- **JWT_SECRET**, **ENCRYPTION_KEY**, **API_KEY**: claves seguras  
- **CORS_ORIGIN**: URL del frontend (ej. `http://localhost:4200` en dev)  
- **EMAIL_***: si usas envío de correos  
- **API_URL**, **FRONTEND_URL**, **CLINICA_***: según tu entorno  

El servidor usa **config.dev.env** cuando `NODE_ENV=development` y **config.env** cuando `NODE_ENV=production`.

## Instalación

```bash
npm install
```

## Scripts

| Comando        | Descripción |
|----------------|-------------|
| `npm run dev`  | Modo desarrollo con recarga (tsx watch). Puerto por defecto: **3006**. |
| `npm run build`| Compila TypeScript a `dist/` y copia assets. |
| `npm start`    | Ejecuta el servidor compilado (`node dist/server.js`). Usar tras `npm run build`. |
| `npm run test:postgres` | Prueba la conexión a PostgreSQL con la config cargada. |
| `npm run lint` | Ejecuta ESLint. |

## Puertos

- **API:** 3006 (configurable con `PORT` en config).  
- **Chatbot** (opcional): ver `chatbot/README.md` (puerto 4999 por defecto).

## API

- Base: `http://localhost:3006/api/v1` (desarrollo).  
- Autenticación: JWT (login en `POST /api/v1/auth/login`).  
- Rutas principales: auth, pacientes, consultas, informes, médicos, finanzas, etc.

## Estructura básica

```
backend/
├── src/
│   ├── config/       # environment, database
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── repositories/
│   └── server.ts
├── scripts/         # SQL de demo, copy-assets, etc.
├── config.dev.env   # (no versionado; crear desde config.dev.env.example)
├── config.env       # (no versionado; crear desde config.env.example)
└── package.json
```

## Scripts SQL de datos demo

En `scripts/` hay varios `.sql` para insertar datos de ejemplo (usuarios, perfiles, menú, etc.). Ejecutar en el orden que requieran las claves foráneas. Ejemplo con `psql`:

```bash
psql -U tu_usuario -d tu_base -f scripts/insert-usuarios-demo.sql
```

## Tecnologías

- Express, TypeScript, PostgreSQL (pg)  
- JWT (jsonwebtoken), bcrypt  
- Nodemailer, ExcelJS, Puppeteer (según uso)
