Esta carpeta contiene una plantilla simple para generar un archivo .pkpass.

Archivos esperados por Apple Wallet:
- pass.json  -> metadatos del pase
- icon.png   -> ícono del pase (reemplazar por una imagen válida)
- icon@2x.png
- logo.png (opcional)
- logo@2x.png (opcional)

Este proyecto crea un .pkpass **sin firma** de Apple.
Para usarlo en producción, deberás:
- Obtener certificados de Apple Developer (Pass Type ID y WWDR).
- Firmar el .pkpass con esos certificados.

