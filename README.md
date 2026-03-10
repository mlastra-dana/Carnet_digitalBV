# Hello World React + Vite + Tailwind + Tremor + Amplify Gen2 (mock)

Proyecto de ejemplo "Hello World" con:

- React 18
- Vite
- Tailwind CSS 3.4.x
- Tremor UI (`@tremor/react` 3.x)
- Estructura preparada para AWS Amplify Gen2 (frontend + backend) pero en modo **mock/local**, sin requerir credenciales de AWS.

## Requisitos previos

- Node.js 18+ (recomendado LTS)
- npm 9+ (incluido con Node reciente)

## Instalación

```bash
npm install
```

Esto instalará las dependencias del frontend. No se ejecuta ningún comando de Amplify contra AWS.

## Scripts principales

- `npm run dev`: levanta la app React en modo desarrollo.
- `npm run build`: genera el build de producción con Vite.
- `npm run server`: levanta un pequeño servidor Node/Express local con el endpoint `/ping` que mockea la Lambda `helloWorld`.

## Correr en local

Ventana 1 – servidor mock `/ping`:

```bash
npm run server
```

El servidor queda escuchando en `http://localhost:3001/ping`.

Ventana 2 – frontend:

```bash
npm run dev
```

Por defecto Vite usa `http://localhost:5173`.

Opcionalmente puedes definir `VITE_API_URL` en un archivo `.env`:

```env
VITE_API_URL=http://localhost:3001
```

Si no defines `VITE_API_URL`, el frontend usará `window.location.origin` como base y, si el backend no existe, mostrará errores legibles y datos mock.

## Cómo funciona el endpoint `/ping`

En esta fase:

- `/ping` está implementado en `server/index.js` usando Express.
- Internamente llama a la función `helloWorld` definida en `amplify/backend/functions/helloWorld/index.js`, que actúa como una Lambda local.
- La respuesta es:

```json
{
  "message": "pong",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "local-mock-request-id"
}
```

Si el backend no está disponible o la llamada falla, el hook `usePing` devuelve:

- Datos mock (`message: "pong (mock)"`, `timestamp` actual, `requestId: "mock-request-id"`).
- Un mensaje de error legible en la interfaz.

Más adelante (cuando se conecte a Amplify Gen2):

- `/ping` se servirá desde una API HTTP de Amplify conectada a una Lambda `helloWorld` real.
- La estructura ya está preparada en el directorio `amplify/`.

## Estructura de carpetas

- `src/components/` – componentes compartidos (actualmente vacío, listo para crecer).
- `src/pages/` – páginas de la app; incluye `Home.jsx` con UI de Tremor.
- `src/hooks/` – hooks personalizados; incluye `usePing` para llamar a `/ping`.
- `src/services/` – utilidades para llamadas HTTP; incluye `apiClient.js`.
- `server/` – servidor Node/Express local con el endpoint `/ping`.
- `amplify/` – estructura de Amplify Gen2 (mock/dummy).

## Amplify Gen2 (mock)

Archivos relevantes:

- `amplify/backend.ts`:
  - Usa `defineBackend({ myApi, helloWorld })`.
  - Llama a `addOutput` para exponer `apiUrl` y datos de la lambda (dummy).
- `amplify/backend/api/myApi/resource.ts`:
  - Define un recurso API `myApi` con ruta `GET /ping` que apunta a la función `helloWorld`.
- `amplify/backend/api/myApi/route.ts`:
  - Handler HTTP de ejemplo que enruta `/ping` hacia `helloWorld`.
- `amplify/backend/functions/helloWorld/index.js`:
  - Implementación de la Lambda `helloWorld` que devuelve `{ message: 'pong', timestamp, requestId }`.
- `amplify/backend/functions/helloWorld/resource.ts`:
  - Recurso Lambda para Amplify Gen2.
- `amplify/backend-config.json`, `amplify/cli.json`, `amplify/tsconfig.json`:
  - Configuración mínima para reconocer backend y tipos.
- `amplify/outputs/amplify_outputs.json`:
  - Contenido dummy (mock) con `apiUrl` local y `amplifyConfig` vacío.

### Frontend y Amplify

- En `src/main.jsx` se intenta cargar `amplify/outputs/amplify_outputs.json` usando `import.meta.glob`.
- Si el archivo no existe o está vacío:
  - Se usa un fallback a `{}`.
  - El proyecto sigue funcionando sin credenciales ni recursos reales en AWS.
- Si en el futuro conectas Amplify y generas salidas reales:
  - Puedes rellenar `amplify_outputs.json` con `amplify pull`/`amplify push`.
  - Opcionalmente instalar `aws-amplify` y habilitar la configuración de `Amplify.configure`.

## CI / Amplify

Se incluye un `amplify.yml` básico en la raíz con pasos de build:

- `npm ci`
- `npm run build`

La sección de backend es un **no-op** (solo un `echo`) para que la build no falle aunque no exista backend real en AWS todavía.

## Listo para conectar a AWS

Partes preparadas para conectar cuando tengas credenciales de AWS:

- Código de backend en `amplify/backend.ts`, `amplify/backend/api/myApi`, `amplify/backend/functions/helloWorld`.
- Archivo de outputs `amplify/outputs/amplify_outputs.json`.
- Hooks y servicios frontend (`usePing`, `apiClient`) que usan `VITE_API_URL` y/o `apiUrl` de Amplify.

Mientras tanto, la app funciona como una SPA React standalone, con endpoint `/ping` mock/local.

