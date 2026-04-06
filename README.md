# Carnet Digital BV

Aplicación web para registro de asegurado, validación de identidad por OCR, generación de carnet Apple Wallet (`.pkpass`) y envío de datos a DANA para iniciar conversación.

## Estado actual

- Demo funcional en local (frontend + backend Express).
- Generación de `.pkpass` y apertura en Wallet validada localmente.
- Integración con Amplify/Lambda en progreso (pendiente alinear firma/certificados y endpoint `/pkpass` en cloud).

## Funcionalidad principal

1. Captura de datos del cliente en frontend.
2. OCR de documento de identidad boliviano (`/ocr-id`) para autocompletar:
   - Nombres
   - Apellidos
   - Documento
3. Generación de carnet digital Apple Wallet (`/pkpass`):
   - Estructura `pass.json`
   - Campos de póliza/plan/vigencia
   - Enlace de contacto en reverso
   - Firma del pass con certificados
4. Envío del `.pkpass` (base64) al flujo `start-conversation` para:
   - Subirlo a S3
   - Pasar referencia a DANA
   - Disparar la conversación/correo

## Arquitectura

### Frontend

- React 18 + Vite
- Tailwind + Tremor UI
- Archivo principal de flujo: `src/pages/Home.jsx`

### Backend local (demo)

- Express en `server/index.js`
- Endpoints:
  - `GET /ping`
  - `POST /ocr-id`
  - `GET /pkpass`
  - `POST /pkpass`

### Integración Amplify (en evolución)

- Carpeta `amplify/` preparada para backend serverless.
- Ruta productiva actual para DANA:
  - `POST /start-conversation`
- Pendiente terminar paridad cloud para generación de `pkpass` con la misma robustez que local.

## Estructura del proyecto

- `src/pages/Home.jsx`: UI y orquestación de flujo.
- `src/hooks/usePing.js`: health check del backend.
- `src/services/apiClient.js`: resolución de base URL API.
- `server/index.js`: backend local completo (OCR + PKPASS).
- `pass-template/`: assets base del pass.
- `certs/`: certificados locales para firma del pass.
- `amplify/`: definición de backend en Amplify Gen2.

## Requisitos

- Node.js 18+
- npm 9+
- OpenSSL disponible en el sistema (para firma local de `pkpass`)

## Variables de entorno (local)

Crear `.env.local` en la raíz:

```env
VITE_OCR_API_URL=http://localhost:3001
VITE_API_URL=http://localhost:3001
VITE_PKPASS_API_URL=http://localhost:3001
VITE_PKPASS_CONTACT_URL=https://wa.me/59100000000
```

Opcional backend local:

```env
PORT=3001
PKPASS_CERT_PASSWORD=<password_certificado_si_aplica>
PKPASS_CONTACT_URL=https://wa.me/59100000000
```

## Ejecutar en local

1. Instalar dependencias:

```bash
npm install
```

2. Levantar backend local:

```bash
npm run server
```

3. Levantar frontend:

```bash
npm run dev
```

4. Abrir app en URL de Vite (normalmente `http://localhost:5173` o `http://localhost:5174` si el puerto está ocupado).

## Flujo técnico detallado

### 1) OCR de documento

- El frontend envía `imageBase64` a `POST /ocr-id`.
- `server/index.js` usa `tesseract.js` (`spa+eng`) para extraer texto.
- Se aplican reglas para Bolivia CI:
  - Detección de etiquetas (`NOMBRES`, `APELLIDO PATERNO`, etc.)
  - Limpieza de ruido OCR
  - Extracción de número de documento + complemento + expedición

### 2) Generación de PKPASS

- El frontend llama `POST /pkpass` con:
  - `name`, `documentId`, `policyNumber`, `planName`, `validUntil`
  - `photoDataUrl` (opcional)
  - `contactUrl` (opcional)
- El backend:
  - Carga `pass-template/pass.json`
  - Actualiza campos del frente
  - Inserta contacto en backFields
  - Genera `manifest.json` (SHA1)
  - Firma con OpenSSL (`pass-cert.pem` + `pass-key.pem`)
  - Devuelve ZIP con MIME `application/vnd.apple.pkpass`

### 3) Envío a DANA

- Frontend convierte blob `.pkpass` a base64.
- Envía payload a `POST /start-conversation`.
- En backend cloud (Lambda):
  - Decodifica base64
  - Sube a S3 con `Content-Type: application/vnd.apple.pkpass`
  - Publica referencia y llama API de DANA

## Notas de producción / Amplify

Local y cloud pueden comportarse distinto en Apple Wallet si falla alguno de estos puntos:

- Firma del pass incompleta o inválida.
- Certificados Apple de pass no configurados correctamente.
- Assets mínimos del pass no válidos.
- Respuesta binaria mal serializada en API Gateway/Lambda.
- Ruta `/pkpass` no expuesta o distinta respecto al frontend.

## Lo que trabajamos en esta sesión

1. Levantamos ambos servidores locales en paralelo (`dev` y `server`).
2. Verificamos rutas reales del backend local para OCR y PKPASS.
3. Diagnosticamos diferencia local vs Amplify:
   - local sí genera pass firmado en Express.
   - cloud no tiene aún la misma paridad de `/pkpass`.
4. Definimos una estrategia técnica para robustecer Lambda:
   - firma obligatoria
   - validación de estructura pkpass
   - cabeceras binarias correctas
   - checklist de variables/certificados
5. Acordamos usar demo local para presentación y retomar certificados en la semana.

## Scripts

- `npm run dev`: frontend Vite.
- `npm run build`: build producción frontend.
- `npm run preview`: preview local del build.
- `npm run server`: backend Express local.

## Próximos pasos recomendados

1. Cerrar paridad de endpoint `/pkpass` en Amplify.
2. Configurar certificados y cadena Apple Wallet en cloud.
3. Probar apertura de pass directamente desde entorno desplegado.
4. Agregar pruebas mínimas de contrato para OCR y PKPASS.

## Licencia

Uso interno para demo/prototipo.
