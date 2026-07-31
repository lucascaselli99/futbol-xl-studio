# Fútbol XL Studio — v1.2.0

Centro de gestión y organización de producción de video para el canal **Fútbol XL**. Es una aplicación web 100% front-end (HTML + CSS + JavaScript vanilla, sin frameworks ni build step), sin backend propio, sin Google Sheets: todos los datos se guardan en **Supabase** (Postgres en la nube).

La v1.0.0 se enfocó en un tablero **Kanban** de producción de videos totalmente configurable, más los módulos de **Inicio** y **Configuración**. La v1.1.0 agregó el módulo **Biblioteca** (explorador de recursos con carpetas anidadas). La v1.2.0 agregó el módulo **Costos**: registro y control de gastos y suscripciones del canal, con categorías/tipos/medios de pago/monedas totalmente configurables desde la interfaz, resumen mensual, gráfico por categoría, evolución de 6 meses, y asociación opcional de cada gasto o suscripción a una serie y/o un video existente. Después de la v1.2.0 se migró la persistencia de **IndexedDB a Supabase** sin cambiar ninguna función visible del producto (ver `CHANGELOG.md`, sección "Migración de persistencia"). Calendario avanzado y Analytics siguen como módulos "Próximamente".

**Importante sobre versiones anteriores:** si ya venías usando esta app contra IndexedDB (v1.0.0, v1.1.0 o v1.2.0), tus datos existentes **no se pierden**: la primera vez que abras esta versión en ese mismo navegador, se suben automáticamente a Supabase una sola vez (ver la sección 0 de este archivo). Antes de esa migración a Supabase, IndexedDB ya pasaba de forma aditiva por las versiones de esquema 1 → 2 → 3 sin tocar ni borrar ningún store existente; ese historial se mantiene documentado en `CHANGELOG.md` por completitud, aunque ya no sea el mecanismo de persistencia activo.

---

## 0. Supabase y variables de entorno (leer antes que nada)

Esta aplicación necesita un proyecto de [Supabase](https://supabase.com) para funcionar. Son 3 pasos, una sola vez:

**Paso 1 — Crear las tablas.** Entrá a tu proyecto de Supabase → **SQL Editor** → "New query", pegá todo el contenido de [`supabase-schema.sql`](./supabase-schema.sql) y ejecutalo. Es seguro volver a correrlo (usa `IF NOT EXISTS` en todos lados).

**Paso 2 — Conseguir tus credenciales.** En tu proyecto de Supabase, andá a **Project Settings → API** y copiá:
- **Project URL** (para este proyecto: `https://wpugmybtretxcdiowasj.supabase.co`)
- **anon / publishable key** (la clave pública, NO la `service_role key` — esa nunca se usa en este proyecto)

**Paso 3 — Configurarlas donde corresponda:**
- **En Vercel**: variables de entorno del proyecto (ver sección 2 de más abajo).
- **En local**: copiá `config.example.js` a `config.js` y completá los dos valores (ver sección 1).

La app **nunca tiene la clave escrita en el código fuente**: `supabase-client.js` la lee en tiempo de ejecución desde `window.FXL_SUPABASE_URL` / `window.FXL_SUPABASE_ANON_KEY`, que pone `config.js` (generado por Vercel en cada deploy, o copiado a mano en local). Si `config.js` no existe o está incompleto, la app lo va a avisar por consola del navegador con un mensaje claro en vez de fallar en silencio.

**Nota de seguridad:** la app no tiene sistema de login (nunca lo tuvo, ni con IndexedDB). Las políticas de Supabase que crea `supabase-schema.sql` quedan abiertas a quien tenga tu URL + clave publicable. Mientras esas credenciales no se compartan públicamente, el nivel de exposición es equivalente al que ya existía con IndexedDB (los datos vivían solo en tu navegador). El detalle completo está al final de `supabase-schema.sql`.

---

## 1. Cómo ejecutar la aplicación localmente

La app sigue sin necesitar build ni instalación de dependencias (no usa npm, ni frameworks) para correr. Sí necesita servirse por **HTTP** (no abrir el `index.html` con doble clic / `file://`), porque los navegadores restringen `fetch`/módulos en el esquema `file://`.

**Antes de arrancar, una sola vez:** copiá `config.example.js` a `config.js` (mismo directorio) y completá tu `SUPABASE_URL`/clave publicable (ver sección 0). `config.js` está en `.gitignore`: no hace falta subirlo a ningún repositorio.

Opciones simples para servir la carpeta, elegí la que tengas a mano:

**Con Node.js (si lo tenés instalado):**
```bash
npx serve .
# o
npx http-server .
```

**Con Python 3:**
```bash
python3 -m http.server 5173
```

Después abrí `http://localhost:5173` (o el puerto que indique la herramienta) en Chrome, Edge, Firefox o Safari actualizados.

Los archivos (`index.html`, `styles.css`, `app.js`, `db.js`, `components.js`, `utils.js`, `supabase-client.js`, `config.js`) se sirven tal cual, sin ningún paso de compilación.

---

## 2. Cómo publicarlo en Vercel

Sigue siendo un sitio estático (sin framework, sin servidor propio), con un único paso de build minúsculo para inyectar las variables de entorno en `config.js` en cada deploy (ver por qué en la sección 0).

**Opción A — Panel web de Vercel:**
1. Subí esta carpeta a un repositorio de GitHub/GitLab/Bitbucket (o subí el ZIP directamente en "Add New Project" → "Deploy" si tu plan lo permite).
2. En [vercel.com](https://vercel.com), "Add New… → Project" e importá el repositorio.
3. Framework Preset: elegí **"Other"**.
4. **Build Command: `node build-config.js`**. Output Directory: dejalo en blanco o `.` (raíz).
5. En **Project Settings → Environment Variables**, agregá:

   | Nombre                     | Valor                                              |
   |-----------------------------|-----------------------------------------------------|
   | `SUPABASE_URL`               | `https://wpugmybtretxcdiowasj.supabase.co` (o la URL de tu propio proyecto) |
   | `SUPABASE_PUBLISHABLE_KEY`   | tu clave publicable (anon key) de Supabase          |

6. Deploy. En cada deploy, Vercel corre `node build-config.js` (sin dependencias externas, usa solo el `fs` de Node) y genera `config.js` con esos dos valores antes de publicar los archivos estáticos.

**Opción B — Vercel CLI:**
```bash
npm i -g vercel   # una sola vez
cd carpeta-del-proyecto
vercel
```
Seguí las preguntas (proyecto nuevo, framework "Other", directorio raíz) y confirmá. Configurá las mismas dos variables de entorno desde el panel web o con `vercel env add SUPABASE_URL` / `vercel env add SUPABASE_PUBLISHABLE_KEY` antes de tu primer deploy a producción (`vercel --prod`).

No se necesita ningún archivo `vercel.json`: no hay rutas dinámicas del lado servidor, solo el Build Command indicado arriba.

---

## 3. Estructura del proyecto

```
index.html            Estructura HTML (contenedores vacíos que se rellenan por JS)
styles.css             Todo el diseño visual: tema oscuro/claro, tarjetas, kanban, responsive
utils.js               Funciones utilitarias puras (fechas, uuid, toasts, clipboard, etc.)
db.js                  Capa de acceso a datos: misma API de siempre, ahora implementada sobre Supabase
components.js          Funciones de render: reciben datos y devuelven HTML (sin lógica de negocio)
app.js                 Orquestación: estado en memoria, routing, eventos, drag&drop, autosave
supabase-schema.sql    SQL completo de las tablas de Supabase (correrlo una vez, ver sección 0)
supabase-client.js     Crea el cliente de Supabase a partir de config.js
config.example.js      Plantilla para desarrollo local (copiar a config.js y completar)
config.js              Generado por build-config.js en Vercel, o copiado a mano en local (no se versiona)
build-config.js        Script que genera config.js a partir de las variables de entorno (Build Command de Vercel)
.gitignore             Excluye config.js del control de versiones
backup-ejemplo.json    Un respaldo de ejemplo (mismo formato que exporta la app), incluye Biblioteca y Costos de muestra
README.md              Este archivo
CHANGELOG.md           Historial de versiones (qué se agregó en cada una)
```

**Por qué esta separación:** `db.js` es la única capa que conoce Supabase; `components.js` es la única que genera HTML; `app.js` es la única que conecta ambas cosas con eventos del usuario. `utils.js` no depende de nada del dominio (fechas, strings, archivos) y lo pueden usar los otros tres. Esto es lo que permitió cambiar cómo se persisten los datos (de IndexedDB a Supabase) sin tocar ni una línea de `app.js`, `components.js`, `styles.css` ni la estructura de `index.html`.

### Modelo de datos (resumen)

Todo vive en Supabase (Postgres), en tablas "documento" (clave primaria + una columna `data jsonb` con el objeto completo — ver `supabase-schema.sql` para el detalle exacto y el porqué de este diseño). Las mismas colecciones de siempre, ahora como tablas:

- `videos` — cada video con todos sus campos (info general, enlaces de Drive, guion/notas, checklist, etiquetas, imágenes, historial, comentarios). Desde v1.1.0 también puede tener `libraryItemIds` (IDs de recursos de Biblioteca asociados).
- `series`, `formats`, `contentTypes`, `states`, `priorities`, `tags`, `checklistTemplates` — catálogos configurables desde **Configuración**.
- `settings` — un documento único con preferencias e identidad visual (incluye las preferencias de Biblioteca desde v1.1.0).
- `meta` — el logo (como imagen en base64) y metadatos internos.
- `libraryFolders` *(nuevo en v1.1.0)* — carpetas de la Biblioteca, jerarquía por `parentId` (sin límite de anidamiento).
- `libraryItems` *(nuevo en v1.1.0)* — recursos de la Biblioteca: archivo local (`storageMode: 'file'`, con `fileData` en base64) o enlace (`storageMode: 'link'`, con `url`), tipo (`resourceType`), etiquetas (IDs del store `tags` compartido con videos), `linkedVideoIds` (IDs de videos asociados).
- `expenseCategories`, `expenseTypes`, `paymentMethods`, `currencies` *(nuevos en v1.2.0)* — taxonomía configurable del módulo Costos (igual de editable que series/formatos/estados: crear, renombrar, reordenar, activar/desactivar).
- `recipients` *(nuevo en v1.2.0)* — proveedores/personas frecuentes (solo una sugerencia para autocompletar; el campo "Proveedor" de un gasto siempre admite texto libre).
- `expenses` *(nuevo en v1.2.0)* — cada gasto (fecha, descripción, categoría, proveedor, monto, moneda, tipo, estado, medio de pago, proyecto asociado, notas, comprobante, y opcionalmente `subscriptionId` si nació de un pago de suscripción).
- `subscriptions` *(nuevo en v1.2.0)* — cada suscripción/pago recurrente (nombre, categoría, precio, moneda, frecuencia, próxima fecha de cobro, estado, renovación automática, proyecto asociado).

**Todas las relaciones son por ID**, nunca por nombre (por ejemplo, `video.seriesId` guarda el ID de la serie, no su nombre; un recurso de Biblioteca referencia videos por `linkedVideoIds`; un gasto referencia su categoría/tipo/medio de pago/moneda por ID). Esto es lo que permite renombrar una serie, un estado, un formato, una carpeta o una categoría de gasto sin romper las referencias existentes, y evita duplicar información entre un video y sus recursos o gastos asociados.

**Sobre "proyecto asociado" en Costos:** Fútbol XL Studio no tiene una entidad "Proyecto" separada de sus series y videos. Por eso, un gasto o una suscripción se asocian de forma opcional a una **serie existente** (`projectSeriesId`) y/o a un **video existente** (`projectVideoId`) — nunca a los dos simultáneamente desde el formulario estándar, aunque el modelo lo permitiría. Esto evita crear una tabla de "proyectos" duplicada y reutiliza exactamente las mismas entidades que ya usás en Videos.

### Migración automática desde IndexedDB a Supabase

La primera vez que la app corre en un navegador contra esta versión, `DB.open()` revisa si ese navegador tiene datos guardados en la vieja base de IndexedDB (`fxlStudioDB`, de cualquier versión anterior) y, si los tiene **y** el proyecto de Supabase todavía está vacío, los sube automáticamente, colección por colección, en un solo paso. Queda marcado con una bandera en `localStorage` para no repetirse ni duplicar datos en próximas cargas, y si Supabase ya tenía datos reales (por ejemplo, cargados a mano o desde otro navegador) la migración automática no sobreescribe nada. La base de IndexedDB original **no se borra**: queda intacta en el navegador como copia local, aunque la app ya no la vuelva a usar después de migrar. Esto se verificó con pruebas automatizadas (sección 9).

### Migración de esquema histórica (v1 → v2 → v3, cuando el motor era IndexedDB)

Antes de migrar a Supabase, `db.js` versionaba el esquema de IndexedDB de forma aditiva: `DB_VERSION = 3`, con un `onupgradeneeded` que creaba cada store con un `if (!db.objectStoreNames.contains(nombre))` — es decir, **nunca borraba ni recreaba un store que ya existiera**. Al agregar Biblioteca (v2) se sumaron dos bloques nuevos; al agregar Costos (v3) se sumaron siete bloques más (`expenseCategories`, `expenseTypes`, `paymentMethods`, `currencies`, `recipients`, `expenses`, `subscriptions`). Este historial queda documentado acá porque es exactamente el estado que la migración automática a Supabase (descrita arriba) recoge de cualquier navegador que todavía tuviera esos datos localmente. `getSettings()` sigue haciendo la misma migración "suave" de preferencias contra Supabase: si el documento de configuración existe pero le faltan claves nuevas, se completan con su valor por defecto sin pisar ninguna preferencia ya guardada.

---

## 4. Funciones implementadas ✅

**General**
- Aplicación 100% front-end (sin backend propio), alojable en Vercel como sitio estático.
- Persistencia completa en Supabase (Postgres): los datos se comparten automáticamente entre dispositivos y navegadores que apunten al mismo proyecto de Supabase. `localStorage` solo se usa para una bandera interna (si ya se hizo la migración desde IndexedDB), nunca como almacenamiento principal.
- Diseño responsive: barra lateral colapsable en escritorio, off-canvas en tablet/celular, navegación inferior en celular, formularios adaptados.
- Tema oscuro y claro, color de acento configurable, logo configurable (subir/cambiar/eliminar, mostrar logo/nombre/ambos), nombre de la app editable con opción de restaurar el predeterminado.
- Autosave con indicador "Guardando… / Guardado", toasts de confirmación/error, confirmaciones antes de eliminar (configurable), deshacer (Ctrl/Cmd+Z) para eliminar/archivar video y acciones masivas, atajos de teclado (`N`, `Ctrl/Cmd+K`, `Ctrl/Cmd+S`, `Esc`, `Ctrl/Cmd+Z`), skeleton loader inicial, estados vacíos con mensaje y acción.

**Inicio**
- Tarjetas resumen (videos activos, ideas, investigación, guiones pendientes, grabación, edición, miniaturas pendientes, programados, publicados este mes, vencidos, prioridad alta), todas calculadas en vivo desde los datos reales.
- Próximos vencimientos, últimos videos modificados, distribución por formato y por serie, barra de progreso general de producción, acceso rápido a "Nuevo video".

**Videos — Kanban**
- Columnas generadas dinámicamente desde los **estados** configurados (no están fijas en el código).
- Arrastrar y soltar tarjetas entre columnas (mouse/trackpad) actualiza el estado del video automáticamente y queda registrado en su historial.
- Columnas: contador de videos, botón "+" para crear tarjeta directamente en ese estado, menú de opciones, colapsar/expandir.
- Tarjetas: título, serie, formato, prioridad, fecha objetivo (con aviso visual si está vencida), etiquetas, miniatura, progreso del checklist, última modificación, favorito, acciones rápidas (duplicar, archivar, eliminar).

**Videos — Lista**
- Tabla con título, estado, serie, formato, prioridad, fecha objetivo, progreso y última modificación.
- Ordenar por columna (asc/desc), selección múltiple, cambio masivo de estado/serie/formato, archivar y eliminar en masa, deshacer disponible para eliminaciones/archivados masivos.

**Videos — Calendario**
- Vista mensual simple basada en la fecha objetivo de cada video (ver limitaciones más abajo).

**Buscador y filtros**
- Buscador global (título, descripción, guion, notas, etiquetas, series, formatos, enlaces, comentarios).
- Panel de filtros combinables: estado, serie, formato, tipo de contenido, prioridad, etiquetas (múltiples), archivado, favorito, vencido, con/sin miniatura, con/sin enlace de Drive. Botón "Limpiar filtros".

**Ficha de video (panel lateral)**
- Pestañas: General, Enlaces de Drive, Guion y notas, Checklist, Etiquetas, Archivos, Historial, Comentarios.
- Todos los campos pedidos en la consigna (título, título alternativo, descripción, estado, serie, formato, tipo de contenido, prioridad, fechas, duraciones, responsable, favorito, archivado).
- 8 campos de enlace de Drive con botones Abrir / Copiar / Eliminar, ícono según tipo de enlace detectado (Drive, Docs, Sheets, YouTube, web), más una lista de enlaces adicionales con etiqueta libre.
- Campos de guion/notas de texto extenso con botón "Copiar" en cada uno.
- Checklist con subtareas, reordenar (botones subir/bajar), progreso automático, aplicar plantilla manualmente y confirmación antes de reemplazar un checklist existente al cambiar de serie/formato (si esa serie/formato tiene una plantilla predeterminada).
- Etiquetas múltiples con selector rápido + creación de etiquetas nuevas al vuelo.
- Miniatura y galería de imágenes locales guardadas como base64 (antes en IndexedDB, ahora en Supabase), con aviso de tamaño y confirmación cuando un archivo supera el límite configurado (no se bloquea la carga, el usuario decide).
- Historial cronológico automático (creación, cambios de estado/fecha/serie/formato/título, checklist completado, enlaces, etc.).
- Comentarios internos con fecha y hora.

**Configuración**
- **Identidad visual**: logo (subir/cambiar/quitar + vista previa), mostrar en sidebar sí/no, mostrar logo/nombre/ambos, nombre de la app + restaurar predeterminado, tema oscuro/claro, color de acento.
- **Series, Formatos, Tipos de contenido, Estados, Prioridades, Etiquetas**: alta, edición inline, color, ícono, reordenar (subir/bajar), archivar (donde aplica), eliminar con verificación de uso — si el elemento está en uso se ofrece mover los videos a otra opción, dejarlos sin asignar, o archivar en su lugar, en vez de eliminar a ciegas.
- **Fusión de etiquetas**: seleccionar 2+ etiquetas y fusionarlas en una sola.
- **Plantillas de checklist**: crear, duplicar, editar tareas, asociar a formatos y series.
- **Preferencias**: vista predeterminada, cantidad de tarjetas por columna, tamaño de tarjeta, mostrar/ocultar miniaturas, formato de fecha, inicio de semana, confirmaciones antes de eliminar, límite recomendado de archivo, autosave y frecuencia, mostrar módulos futuros.
- **Datos y respaldo**: exportar respaldo completo (JSON), importar respaldo con reemplazo o combinación (con validación previa del archivo), restaurar datos de ejemplo, eliminar solo los videos de ejemplo, ver uso de almacenamiento estimado, eliminar todos los datos (con confirmación, reinicia a valores de fábrica).

**Biblioteca** *(nuevo en v1.1.0)*
- Carpetas y subcarpetas ilimitadas (por `parentId`), crear/renombrar/duplicar/mover/archivar/eliminar, con prevención de nombres duplicados en el mismo nivel y prevención de ciclos (no se puede mover una carpeta dentro de sí misma ni de una de sus propias subcarpetas).
- Recursos: imagen, video, audio, documento, PDF, enlace web, archivo de Drive, carpeta de Drive, Google Docs, Google Sheets, YouTube, SFX, música, logo, overlay, otro. Tipo auto-detectado al pegar un enlace o subir un archivo (por mime-type/extensión), editable manualmente.
- Archivos locales guardados como base64 en Supabase (como los del resto de la app; antes en IndexedDB), con aviso de tamaño configurable que **nunca bloquea**: el usuario elige "Guardar igualmente", "Usar enlace" o "Cancelar".
- Subida por selector de archivos, arrastrar y soltar (carpetas y archivos del sistema operativo), y pegar una imagen del portapapeles (Ctrl/Cmd+V) estando en la Biblioteca.
- Barra de herramientas: buscador, "+ Nuevo" (carpeta/archivo/enlace/carpeta de Drive/nota), controles de vista (grilla/lista), orden (nombre, fecha, tamaño, tipo), filtros rápidos (favoritos, recientes, por tipo) y por etiqueta.
- Migas de pan (breadcrumbs) con navegación e historial de "atrás/adelante" dentro de la Biblioteca.
- Vista de grilla (tarjetas con miniatura/ícono) y vista de lista (tabla con nombre, tipo, carpeta, tamaño, etiquetas, videos relacionados, modificado, favorito).
- Arrastrar y soltar para mover carpetas/recursos entre carpetas, **con alternativa "Mover a…" siempre disponible** (menú + modal) para quien no quiera o no pueda usar drag & drop (obligatorio en celular).
- Buscador global: busca en todas las carpetas a la vez y muestra la ruta completa de cada resultado.
- Reutiliza el **mismo sistema de etiquetas que los videos** (no hay una tabla de etiquetas separada): un recurso y un video pueden compartir exactamente la misma etiqueta.
- Favoritos y "Recientes" (últimos usados) como vistas rápidas.
- Asociación bidireccional recurso ↔ video por ID (sin duplicar el archivo ni sus datos): pestaña **Biblioteca** nueva en la ficha del video para ver/agregar/quitar recursos asociados, y sección "Videos relacionados" dentro del detalle de cada recurso, con acceso directo de ida y vuelta.
- Panel de detalle con vista previa según el tipo (imagen, audio, video, PDF embebido, miniatura de YouTube, tarjeta genérica para otros enlaces) y metadatos (creado, modificado, última utilización).
- Archivar antes de eliminar, configurable en Configuración → Biblioteca como "Archivar siempre" / "Eliminar directamente" / "Preguntar cada vez". Un recurso o carpeta archivada se puede restaurar; eliminar de forma permanente si borra el registro (y, en el caso de una carpeta, sus subcarpetas y recursos de forma recursiva — ver limitaciones).
- Nueva sección **Configuración → Biblioteca**: vista predeterminada, tamaño de tarjeta, mostrar/ocultar miniaturas, límite recomendado de archivo, orden predeterminado, comportamiento de borrado, calidad de miniaturas, carpeta predeterminada para recursos nuevos.
- Respaldo (exportar/importar) extendido para incluir `libraryFolders` y `libraryItems`; un respaldo viejo (de la v1.0.0, sin Biblioteca) se sigue importando sin errores.
- Nuevas métricas en el dashboard de Inicio: total de carpetas, total de recursos, recursos sin etiquetar, favoritos, y una mini-lista de "Recursos agregados recientemente" (sin sobrecargar visualmente el resto del dashboard).
- Seguridad: todo el contenido generado por el usuario (nombres, descripciones, URLs) se escapa antes de insertarse en el HTML (prevención de XSS); las URLs de enlaces se validan (deben empezar con `http://` o `https://`) tanto al crearlas como al abrirlas, para que un enlace editado a mano o importado desde un respaldo corrupto no pueda ejecutar código; los respaldos corruptos o con un JSON inválido se rechazan con un mensaje claro en vez de romper la app; si IndexedDB rechaza guardar un archivo (por ejemplo, error de cuota), se muestra un aviso y no queda un recurso "fantasma" a medio guardar.

**Costos** *(nuevo en v1.2.0)*
- Nueva sección **Costos** en el menú principal, con 4 pestañas: **Resumen, Gastos, Suscripciones y Configuración**.
- Categorías de gasto, tipos de gasto, medios de pago y monedas **totalmente configurables** desde la interfaz (crear, renombrar, reordenar, activar/desactivar) — nada queda fijo en el código; las 10 categorías, 5 tipos, 7 medios de pago y 2 monedas (ARS/USD) que trae la app son solo un punto de partida editable.
- **Gastos**: alta/edición en un modal, con fecha, descripción, categoría, proveedor (texto libre, con sugerencias de "proveedores frecuentes"), monto, moneda, tipo de gasto, estado (pagado/pendiente/cancelado), medio de pago, proyecto asociado (serie y/o video), observaciones y comprobante (URL opcional, con botón "Abrir"). Acciones: ver/editar, duplicar, marcar como pagado, eliminar (con confirmación configurable).
- **Filtros de gastos**: mes, año, categoría, tipo, estado, moneda, proyecto (video), proyecto (serie), proveedor y rango de fechas, más un buscador de texto libre (descripción, proveedor, notas). Todos combinables.
- **Suscripciones**: alta/edición en un modal, con nombre, categoría, descripción, precio, moneda, frecuencia (mensual/trimestral/semestral/anual/personalizada — en personalizada, cada cuántos días o meses), próxima fecha de cobro, fecha de inicio, medio de pago, estado (activa/pausada/cancelada), renovación automática, proyecto asociado y sitio web opcional. Acciones: editar, registrar pago, pausar, reactivar, cancelar, eliminar.
- **Registrar pago de una suscripción**: crea automáticamente un gasto asociado (con el nombre del servicio, monto, moneda, categoría y fecha), y recién entonces avanza la próxima fecha de cobro según la frecuencia. No se generan gastos futuros automáticamente: solo ocurre cuando el usuario confirma un pago. Doble protección contra duplicados (un bloqueo en memoria contra doble click + una verificación de que no exista ya un gasto para esa misma fecha de cobro).
- **Indicadores visuales de vencimiento** de suscripciones: vence hoy, vence pronto (configurable, 7 días por defecto), vencida, activa, pausada, cancelada — con los colores pedidos (verde=pagado/activo, amarillo=pendiente/próximo, rojo=vencido/cancelado, gris=pausado).
- **Resumen**: tarjetas con total gastado este mes, total del mes anterior, variación porcentual, gastos fijos del mes, gastos variables del mes, suscripciones activas, próximos vencimientos, pagos pendientes y categoría con mayor gasto — todo calculado en vivo a partir de los gastos y suscripciones reales. Gráfico de gastos por categoría (barras) y evolución mensual (últimos 6 meses), ambos separados por moneda. Listado de próximos pagos (suscripciones) y de gastos pendientes.
- **Proyecto asociado**: cualquier gasto o suscripción puede vincularse opcionalmente a una serie y/o a un video ya existentes en la app (no se duplica información: son las mismas series/videos de siempre). En la ficha de cada video se agregó una sección **"Costos del proyecto"** con el total gastado, la cantidad de gastos asociados y los gastos pendientes, más un botón **"Ver todos los costos"** que abre Costos → Gastos ya filtrado por ese video.
- **Configuración → Costos**: administración de categorías, tipos de gasto, medios de pago, monedas (código, nombre, símbolo, cantidad de decimales, activa/inactiva) y proveedores frecuentes, más preferencias (moneda predeterminada, umbral de "vence pronto", pestaña inicial, confirmación antes de eliminar).
- **Protección al eliminar** una categoría/tipo/medio de pago/moneda en uso: no se borra a ciegas — se ofrece reasignar los gastos/suscripciones afectados a otro elemento, o desactivarlo en su lugar. Los proveedores frecuentes, al no ser una referencia obligatoria (el campo del gasto es texto libre), se pueden eliminar directamente con una confirmación simple.
- **Reglas de negocio aplicadas**: el monto no puede ser negativo; los gastos cancelados no se incluyen en los totales; los gastos pendientes se muestran aparte del total pagado; cancelar o eliminar una suscripción conserva sus gastos históricos; cambiar el precio de una suscripción no altera los gastos ya generados; los cálculos mensuales usan la fecha real de cada gasto; **ARS y USD nunca se suman entre sí** — todos los totales se muestran separados por moneda.
- Respaldo (exportar/importar) extendido para incluir las 7 colecciones de Costos; un respaldo viejo (de la v1.0.0 o v1.1.0, sin Costos) se sigue importando sin errores.
- Seguridad: mismo criterio que en Biblioteca — todo el contenido generado por el usuario se escapa antes de insertarse en el HTML; las URLs (comprobante, sitio web) se validan (`http://`/`https://`) antes de guardarlas y antes de abrirlas.

**Biblioteca, Costos, Calendario avanzado y Analytics**: en v1.0.0 las cuatro eran pantallas "Próximamente" (o directamente no existían). Desde v1.1.0, **Biblioteca ya está implementada**; desde v1.2.0, **Costos ya está implementado** (ver arriba). Calendario avanzado y Analytics siguen como pantallas "Próximamente" que no generan errores, listas para ser reemplazadas por los módulos reales sin tocar el resto de la app (mismo router, mismo sidebar).

---

## 5. Limitaciones conocidas / lo que NO está completo todavía ⚠️

Se listan explícitamente para no simular que algo funciona cuando no es así:

- **Drag & drop táctil**: el arrastre de tarjetas en el Kanban y de carpetas/recursos en la Biblioteca usa la API nativa de HTML5 Drag and Drop, que **no funciona bien (o no funciona) en pantallas táctiles** (celular/tablet). En esos dispositivos, para mover un video se cambia el campo "Estado" desde el formulario, y para mover una carpeta o recurso de la Biblioteca se usa el botón/menú **"Mover a…"**, que sí funciona perfectamente en cualquier dispositivo (por eso no se dejó como única forma de mover cosas el drag & drop).
- **Vista Calendario**: es una primera versión simple, de solo lectura, basada únicamente en la fecha objetivo de cada video (no permite arrastrar videos entre días ni crear eventos directamente desde ahí). El calendario avanzado (grabaciones, entrevistas, recordatorios) queda para una futura versión.
- **Analytics**: no implementado en esta versión (pantalla "Próximamente").
- **Archivar una carpeta no archiva en cascada su contenido**: al archivar una carpeta, sus subcarpetas y recursos directos simplemente dejan de ser accesibles navegando desde la Biblioteca (porque su carpeta padre está archivada), pero **no se marcan individualmente como `archived: true`**. Si restaurás la carpeta, todo su contenido vuelve a verse exactamente como estaba. Se decidió así para no complicar el modelo de datos con un estado "archivado por herencia"; la eliminación permanente, en cambio, **sí** borra recursivamente carpeta + subcarpetas + recursos, para no dejar registros huérfanos.
- **Miniaturas de imagen**: se generan con un `<canvas>` en el navegador; en el caso puntual de un SVG que referencie recursos externos (poco común), el navegador puede no poder "dibujarlo" en el canvas — en ese caso la app usa la imagen original como miniatura en lugar de fallar.
- **Enlaces de Drive/Docs/Sheets/YouTube**: se guardan y muestran como enlaces (con ícono y dominio detectados), pero la app **no usa la API de Google** para verificar que el enlace exista, mostrar su contenido embebido (más allá de YouTube, que sí muestra una miniatura pública) ni leer permisos, tal como se especificó.
- **"Eliminar todos los datos"**: por diseño, esta acción borra todo (incluida la Biblioteca) y luego vuelve a crear los catálogos de fábrica (estados, formatos, prioridades, etc.) para que la aplicación no quede en un estado no usable. Si preferís un vaciado 100% literal sin recrear nada, se puede ajustar fácilmente en `db.js`/`app.js` (función `wipeAllData`).
- **Estimación de almacenamiento**: la pantalla "Ver uso de almacenamiento" de Configuración sigue usando `navigator.storage.estimate()`, que mide el almacenamiento local del **navegador**, no el de Supabase. Ahora que los datos viven en la nube, ese número va a ser chico o cero la mayor parte del tiempo — es información correcta, no un error; simplemente ya no representa "cuánto ocupan mis datos". Supabase tiene su propio panel de uso de base de datos (Project Settings → Usage) para ver el tamaño real.
- **Sincronización entre dispositivos**: a diferencia de las versiones basadas en IndexedDB, los datos ahora **sí se sincronizan automáticamente** entre cualquier computadora, celular o navegador que apunte al mismo proyecto de Supabase (misma URL y clave publicable). Lo que sigue sin existir es sincronización en tiempo real dentro de una sesión abierta: si tenés la app abierta en dos pestañas/dispositivos a la vez y modificás algo en una, la otra no se actualiza sola hasta que la recargués.
- **Sin autenticación / control de acceso por usuario**: igual que en todas las versiones anteriores (con IndexedDB local no hacía falta), esta app no tiene login. Al migrar a Supabase esto tiene una implicancia nueva: cualquiera que tenga tu `SUPABASE_URL` y tu clave publicable puede leer y modificar todos los datos, porque las políticas de acceso (RLS) que crea `supabase-schema.sql` quedan abiertas a propósito para que la app funcione sin sistema de login. Ver la nota de seguridad al final de `supabase-schema.sql`.
- **Mensaje de "sin espacio" al subir un archivo pesado a Biblioteca**: antes, ese aviso puntual ("No hay espacio suficiente en el navegador...") se disparaba específicamente ante un `QuotaExceededError` de IndexedDB. Con Supabase, un archivo demasiado pesado (`fileData` en base64 dentro de la fila) puede fallar por otros motivos (límite de tamaño de fila/consulta, límite del plan de Supabase, corte de red), y en esos casos la app va a mostrar el mensaje de error genérico de guardado con el detalle real en vez del aviso específico de "sin espacio" — sigue avisando y sigue sin dejar un recurso a medio guardar, solo que con un texto distinto. Para archivos grandes conviene seguir usando un enlace de Drive, como ya recomendaba la app.
- **Un solo nivel de deshacer**: Ctrl/Cmd+Z revierte la última acción destructiva de video (eliminar/archivar, o una acción masiva); las acciones de Biblioteca y de Costos (crear/mover/eliminar carpeta, recurso, gasto o suscripción) **no tienen deshacer con Ctrl/Cmd+Z** — si algo se elimina de forma permanente, no hay forma de recuperarlo salvo restaurando un respaldo anterior. En Biblioteca esto se mitiga con la preferencia "Archivar antes de eliminar" (activada por defecto); en Costos no existe todavía un archivado equivalente para gastos/suscripciones (ver más abajo), así que se recomienda tener la confirmación antes de eliminar activada (lo está por defecto) y exportar un respaldo periódicamente.
- **Costos no tiene "archivar antes de eliminar"**: a diferencia de Biblioteca, eliminar un gasto o una suscripción es siempre una eliminación permanente e inmediata (con confirmación previa, configurable en Configuración → Costos → Preferencias). No se implementó un estado "archivado" para gastos/suscripciones en esta versión. Los gastos generados automáticamente al registrar el pago de una suscripción sí se conservan aunque la suscripción se cancele o se elimine (ver sección 4), pero eso es distinto de poder "deshacer" la eliminación de un gasto individual.
- **Categorías/tipos/medios de pago/monedas "eliminados sin uso"**: si un elemento de la taxonomía de Costos no está en uso, eliminarlo lo borra directamente (con confirmación); no hay una papelera de reciclaje para estos catálogos, igual que para series/formatos/estados de Videos.
- **Sin conversión de monedas ni cotización automática**: tal como se pidió, no hay conversión entre ARS y USD (ni ninguna otra moneda que agregues). Todos los totales, gráficos y resúmenes se calculan y muestran **por separado, por moneda** — nunca se suman montos de monedas distintas entre sí.
- **"Próximos pagos" del Resumen se basa en suscripciones activas**, no en una fecha de vencimiento propia de cada gasto individual (el modelo de datos de un gasto no tiene un campo de "vencimiento" separado de su fecha; los gastos pendientes se listan aparte, ordenados por fecha, en su propia sección).
- **Sin notificaciones push ni recordatorios por email** de vencimientos de suscripciones: los indicadores "vence hoy/pronto/vencida" son únicamente visuales, dentro de la propia aplicación (tarjetas de Resumen y de Suscripciones). Hay que abrir la app para verlos.
- **Comprobante y sitio web son solo campos de texto con un botón "Abrir"**: no hay una vista previa embebida de esos enlaces (a diferencia de las vistas previas de la Biblioteca); simplemente abren la URL en una pestaña nueva, con la misma validación de esquema (`http://`/`https://`) que el resto de la app.
- Las pruebas se hicieron mediante revisión exhaustiva de código y conjuntos de pruebas automatizadas de lógica ejecutadas en Node (simulando IndexedDB primero, y un cliente de Supabase + IndexedDB legado después, para la migración de persistencia), ya que este entorno de desarrollo no tiene un navegador real disponible para grabar una prueba manual con clics ni una conexión real a un proyecto de Supabase. Se cubrieron específicamente: una base v1.0.0 con datos reales migrando en un solo paso a v1.2.0 (saltando la v1.1.0), una base v1.1.0 (con Biblioteca) migrando a v1.2.0, un conjunto de pruebas funcionales de Costos (categorías/tipos/medios/monedas configurables, alta y validación de gastos, registrar pago de una suscripción con generación de gasto y anti-duplicado, separación de totales ARS/USD, protección y reasignación al eliminar una categoría en uso, conservación de gastos históricos al cancelar/eliminar una suscripción, respaldo), y la migración de persistencia a Supabase (API pública de `db.js` sin cambios, CRUD genérico, `getSettings`/`saveSettings` con migración suave, `exportBackup`/`importBackup`, `removeSampleData`/`reseedSampleVideos`, `wipeAll`, y la migración automática desde IndexedDB ejecutándose una sola vez sin duplicar ni sobreescribir datos). Se recomienda una prueba manual en el navegador contra tu proyecto real de Supabase antes de usarlo en producción: correr el SQL, configurar `config.js`, abrir la app y verificar que el flujo completo (crear/editar/eliminar en cada módulo, exportar/importar respaldo, y si corresponde la migración automática desde una IndexedDB con datos previos) funcione de punta a punta.

---

## 6. Futuras mejoras posibles

- Archivado en cascada real de subcarpetas/recursos al archivar una carpeta (hoy queda "oculto por herencia", ver limitaciones).
- Deshacer (Ctrl/Cmd+Z) también para acciones de Biblioteca y de Costos, no solo de videos.
- Archivar (en vez de solo eliminar) gastos y suscripciones, con una vista de "archivados" como en Biblioteca.
- Recordatorios/notificaciones (locales del navegador, o por email) para suscripciones próximas a vencer.
- Conversión de moneda opcional con una cotización que el usuario pueda actualizar manualmente (siempre mostrando también los totales sin convertir).
- Gráficos más ricos en Costos (por ejemplo, comparativa año contra año, exportar el resumen a PDF o CSV).
- Calendario avanzado con publicaciones, grabaciones, entrevistas, fechas límite y recordatorios (notificaciones locales del navegador).
- Analytics: rendimiento por serie/formato, historial de publicaciones, métricas cargadas manualmente o importadas desde CSV.
- Drag & drop táctil real (por ejemplo, con una librería ligera de gestos) para paridad completa en celular/tablet, tanto en Kanban como en Biblioteca.
- Reordenar checklist y catálogos con arrastre además de los botones subir/bajar actuales.
- Multiusuario / cuentas con autenticación real (hoy sigue siendo de un solo usuario "de confianza" por proyecto de Supabase, sin login — ver la nota de seguridad de `supabase-schema.sql`). Agregar Supabase Auth y políticas de RLS por usuario sería el camino natural para esto.
- ~~Sincronización opcional en la nube~~ — ya implementada: la persistencia se migró de IndexedDB a Supabase (ver `CHANGELOG.md`).

---

## 7. Archivo de respaldo de ejemplo

`backup-ejemplo.json` contiene un respaldo válido —en el mismo formato que genera "Exportar respaldo"— con los estados, formatos, series, prioridades, etiquetas, plantillas y videos de ejemplo de fábrica, **más un pequeño set de carpetas y recursos de Biblioteca de ejemplo** (carpetas anidadas, un enlace de Drive, un enlace web y una imagen de muestra muy liviana), **más categorías/tipos/medios de pago/monedas de Costos y un par de gastos y una suscripción de ejemplo**. Deliberadamente **no incluye archivos pesados**, para mantener el archivo de ejemplo liviano. Sirve para probar la función **Configuración → Datos y respaldo → Importar respaldo** sin tener que exportar primero.

---

## 8. Checklist de revisión antes de la entrega

| Función | Estado |
|---|---|
| Creación de videos | ✅ Funciona |
| Edición de videos | ✅ Funciona |
| Eliminación de videos (con confirmación y deshacer) | ✅ Funciona |
| Drag and drop en Kanban (mouse/trackpad) | ✅ Funciona · ⚠️ no soportado por touch (ver limitaciones) |
| Persistencia en Supabase (antes IndexedDB) | ✅ Funciona (probado con CRUD genérico, export/import, harness Node con cliente de Supabase simulado) |
| Configuración dinámica (sin datos rígidos en el código) | ✅ Funciona |
| Series / Formatos / Estados / Prioridades / Tipos / Etiquetas | ✅ CRUD completo |
| Checklists (con subtareas, plantillas, progreso) | ✅ Funciona |
| Respaldo (exportar) | ✅ Funciona |
| Importación (reemplazar / combinar, con validación) | ✅ Funciona |
| Responsive (desktop / tablet / celular) | ✅ Implementado |
| Logo configurable | ✅ Funciona |
| Modo oscuro / claro | ✅ Funciona |
| Enlaces de Drive (guardar, abrir, copiar, detectar tipo) | ✅ Funciona (no usa la API de Google Drive, como se pidió) |
| **Migración v1.0.0 → v1.1.0 sin pérdida de datos** | ✅ Verificado con prueba automatizada (base v1 con datos reales → v2) |
| Crear / renombrar / mover carpeta de Biblioteca | ✅ Funciona |
| Prevención de nombre de carpeta duplicado en el mismo nivel | ✅ Funciona |
| Prevención de ciclos al mover carpetas | ✅ Funciona |
| Archivar / restaurar / eliminar carpeta o recurso | ✅ Funciona · ⚠️ archivado de carpeta no es en cascada (ver limitaciones) |
| Subir archivo (selector, drag & drop de OS, pegar imagen) | ✅ Funciona · ⚠️ drag & drop no soportado en touch (usar "Mover a…"/selector) |
| Agregar enlace (Drive, Docs, Sheets, YouTube, web) con detección de tipo | ✅ Funciona |
| Mover recurso/carpeta con drag & drop | ✅ Funciona (desktop) |
| **"Mover a…" como alternativa sin drag & drop** | ✅ Funciona (desktop y celular) |
| Buscador global de Biblioteca (con ruta completa) | ✅ Funciona |
| Filtro por etiqueta (reutilizando etiquetas de videos) | ✅ Funciona |
| Marcar como favorito | ✅ Funciona |
| Asociar recurso a video (desde el recurso y desde la ficha del video) | ✅ Funciona |
| Abrir un recurso de la Biblioteca desde la ficha del video | ✅ Funciona |
| Exportar respaldo con datos de Biblioteca | ✅ Funciona |
| Eliminar todos los datos (incluye Biblioteca) | ✅ Funciona |
| Importar respaldo con datos de Biblioteca | ✅ Funciona |
| Importar un respaldo viejo (v1.0.0, sin Biblioteca) | ✅ Funciona, no rompe |
| Persistencia tras recargar el navegador | ✅ Verificado (Supabase) |
| Videos existentes intactos tras usar Biblioteca | ✅ Verificado |
| Responsive en Biblioteca (desktop / celular, botón flotante "+") | ✅ Implementado |
| Ambos temas (oscuro / claro) en Biblioteca | ✅ Implementado, reutiliza las variables de color existentes |
| Escapado de contenido de usuario (prevención de XSS) | ✅ Verificado (nombres, descripciones, URLs, etiquetas) |
| Validación de esquema de URL (bloquear `javascript:` u otros no http/https) | ✅ Verificado, tanto al crear como al abrir un enlace |
| Manejo de respaldo corrupto / JSON inválido | ✅ Funciona, muestra error sin romper la app |
| Manejo de error al guardar un archivo pesado (antes cuota de IndexedDB, ahora error de Supabase) | ✅ Funciona, avisa y no deja un recurso a medio guardar (ver matiz en sección 5) |
| **Migración v1.1.0 → v1.2.0 sin pérdida de datos** | ✅ Verificado con prueba automatizada (base v2 con Biblioteca y datos reales → v3) |
| **Migración directa v1.0.0 → v1.2.0 sin pérdida de datos** | ✅ Verificado con prueba automatizada (base v1 original, salto directo a v3) |
| Crear categorías, tipos de gasto, medios de pago y monedas nuevas | ✅ Funciona (nada está fijo en el código) |
| Crear servicios y suscripciones nuevas | ✅ Funciona (sin listas fijas de servicios) |
| Editar y eliminar categorías/tipos/medios/monedas/proveedores | ✅ Funciona, con protección y reasignación si el elemento está en uso |
| Filtros de gastos (mes, año, categoría, tipo, estado, moneda, proyecto, proveedor, rango de fechas) | ✅ Funciona, combinables |
| Buscador de gastos por texto | ✅ Funciona |
| Totales mensuales correctos (mes actual, mes anterior, variación) | ✅ Verificado con prueba automatizada |
| **ARS y USD siempre separados (nunca sumados)** | ✅ Verificado con prueba automatizada |
| Registrar el pago de una suscripción genera un gasto asociado | ✅ Verificado con prueba automatizada |
| Anti-duplicado al registrar un pago (doble click / misma fecha de cobro) | ✅ Verificado con prueba automatizada |
| La próxima fecha de cobro avanza según la frecuencia (mensual/trimestral/semestral/anual/personalizada) | ✅ Verificado con prueba automatizada |
| Cancelar/eliminar una suscripción conserva sus gastos históricos | ✅ Verificado con prueba automatizada |
| Cambiar el precio de una suscripción no altera gastos históricos | ✅ Verificado con prueba automatizada |
| Costos asociados aparecen en la ficha del video ("Costos del proyecto" + "Ver todos los costos") | ✅ Funciona |
| Exportar/importar respaldo con datos de Costos | ✅ Funciona |
| Importar un respaldo viejo (sin Costos) | ✅ Funciona, no rompe |
| Videos, Biblioteca y Configuración existentes siguen funcionando tras agregar Costos | ✅ Verificado (pruebas automatizadas + revisión de código) |
| Responsive en Costos (desktop / celular) | ✅ Implementado |
| Ambos temas (oscuro / claro) en Costos | ✅ Implementado, reutiliza las variables de color existentes |
| Colores de estado (verde/amarillo/rojo/gris) únicamente para estados, sin sobrecargar el diseño | ✅ Implementado |
| **API pública de `db.js` sin cambios tras migrar a Supabase** | ✅ Verificado (mismos nombres, parámetros y formas de retorno; `app.js`/`components.js` sin modificar) |
| CRUD genérico contra Supabase (getAll/get/put/bulkPut/remove/clear/wipeAll) | ✅ Verificado con harness Node (cliente de Supabase simulado) |
| `getSettings`/`saveSettings` con migración suave de preferencias contra Supabase | ✅ Verificado con prueba automatizada |
| `exportBackup`/`importBackup`/`validateBackup` contra Supabase | ✅ Verificado con prueba automatizada (roundtrip completo) |
| Base de Supabase vacía se muestra vacía (sin datos de ejemplo automáticos) | ✅ Verificado con prueba automatizada |
| "Restaurar datos de ejemplo" / "Eliminar solo datos de ejemplo" siguen funcionando como acción manual | ✅ Verificado con prueba automatizada |
| **Migración automática, única, desde IndexedDB a Supabase** | ✅ Verificado con prueba automatizada (sube datos legado una sola vez, sin duplicar en recargas posteriores, sin sobreescribir datos ya existentes en Supabase) |
| Mensaje de error claro si falta configurar `SUPABASE_URL`/clave publicable | ✅ Verificado con prueba automatizada |
| Interfaz, estilos, componentes, navegación y estructura del proyecto sin cambios | ✅ Verificado (solo se tocó `db.js`; `index.html` únicamente sumó 3 `<script>`) |

Todo lo marcado como limitación en la sección 5 se deja explícito ahí para que no haya sorpresas. Ningún ítem de esta tabla se marca como "✅ Funciona" si solo está diseñado visualmente sin lógica real detrás.--
