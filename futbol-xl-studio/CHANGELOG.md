# Changelog — Fútbol XL Studio

Todas las versiones son de una aplicación 100% front-end (HTML + CSS + JavaScript vanilla), sin backend propio, ahora con Supabase (Postgres) como almacenamiento principal. Este archivo documenta qué cambió en cada versión visible al usuario.

## Migración de persistencia — IndexedDB → Supabase

Esta migración reemplaza únicamente la capa de datos (`db.js`). Interfaz, diseño, estilos, componentes, navegación y estructura del proyecto no se tocaron: `app.js` y `components.js` no tienen ningún cambio. No se le puso un número de versión nuevo a propósito, porque no agrega ni cambia ninguna función visible del producto; es un cambio de infraestructura.

**Qué cambió**

- Toda la persistencia (videos, series, formatos, estados, Biblioteca, Costos, configuración, logo) ahora vive en un proyecto de Supabase (Postgres) en vez de en IndexedDB del navegador.
- `db.js` expone exactamente la misma API pública que antes (`open`, `getAll`, `get`, `put`, `bulkPut`, `remove`, `clear`, `wipeAll`, `estimateUsage`, `getSettings`, `saveSettings`, `getLogo`, `setLogo`, `exportBackup`, `validateBackup`, `importBackup`, `removeSampleData`, `reseedSampleVideos`, `makeHistoryEntry`, `defaultSettings`, `seedIfEmpty`, `seedLibraryIfEmpty`, `seedCostsTaxonomyIfEmpty`, `seedCostsSampleDataIfEmpty`), así que el resto de la aplicación no necesitó ningún cambio.
- Se agregaron 5 archivos nuevos: `supabase-schema.sql` (SQL completo de las tablas), `supabase-client.js` (cliente de Supabase), `config.example.js` (plantilla para desarrollo local), `build-config.js` (genera `config.js` a partir de las variables de entorno en cada deploy de Vercel) y `.gitignore`.
- `index.html` solo sumó 3 etiquetas `<script>` (config, SDK de Supabase, cliente): ningún elemento visual, de layout ni de navegación cambió.
- **La app ya no crea datos de ejemplo ni categorías "de fábrica" automáticamente**: si el proyecto de Supabase está vacío, la aplicación se muestra completamente vacía (Kanban, Biblioteca y Costos ya tenían pantallas vacías preparadas para esto). Quien quiera datos de ejemplo los pide explícitamente desde Configuración → Datos y respaldo → "Restaurar datos de ejemplo", que sigue funcionando igual que antes.
- **Migración automática, única, desde IndexedDB**: la primera vez que la app corre en un navegador que ya tenía datos guardados localmente (de una versión anterior), los sube automáticamente a Supabase una sola vez (sin duplicarlos en cargas posteriores, y sin pisar nada si Supabase ya tenía datos reales). La base de IndexedDB original no se borra: queda intacta en el navegador como copia local, aunque la app ya no la vuelva a usar.
- Variables de entorno necesarias en Vercel: `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` (ver la sección "Supabase y variables de entorno" de `README.md` para el detalle completo, incluido el paso extra de build que hace falta por ser un sitio estático sin framework).

**Verificado con pruebas automatizadas** (harness en Node con un cliente de Supabase y una IndexedDB simulados): la API pública de `db.js` no cambió ni un nombre; una base nueva y vacía queda vacía tras `open()`; el CRUD genérico, `getSettings`/`saveSettings` (incluida la migración suave de preferencias), `exportBackup`/`importBackup`, `removeSampleData`/`reseedSampleVideos` y `wipeAll` funcionan igual que con IndexedDB; la migración automática sube los datos legado una sola vez sin duplicarlos en recargas posteriores y nunca sobreescribe datos ya existentes en Supabase.

**Conocido / a tener en cuenta**

- No hay sistema de login (igual que en todas las versiones anteriores): las políticas de acceso de Supabase quedan abiertas para quien tenga la URL y la clave publicable del proyecto. Ver la nota de seguridad al final de `supabase-schema.sql` antes de compartir esas credenciales.
- El uso de almacenamiento que se ve en Configuración sigue siendo una estimación del navegador (no de Supabase): con los datos ahora en la nube, ese número va a ser chico, lo cual es correcto.

## v1.2.0

Agrega el módulo **Costos**: registro y control de gastos y suscripciones del canal, integrado con el resto de la aplicación existente (misma identidad visual, mismas series/videos para asociar "proyecto", mismo motor de respaldo). No se rehizo ninguna parte de las versiones anteriores; se trabajó exclusivamente agregando código sobre los archivos existentes.

**Agregado**

- **Sección Costos** en el menú principal, con 4 pestañas: Resumen, Gastos, Suscripciones y Configuración.
- **Categorías, tipos de gasto, medios de pago y monedas configurables**: el usuario puede crear, editar, reordenar, activar/desactivar y eliminar cualquiera desde la interfaz; ninguno queda fijo en el código.
- **Gastos**: alta y edición con fecha, descripción, categoría, proveedor, monto, moneda, tipo, estado (pagado/pendiente/cancelado), medio de pago, proyecto asociado, observaciones y comprobante; acciones de ver, editar, duplicar, marcar como pagado y eliminar (con confirmación).
- **Filtros y buscador de gastos**: por mes, año, categoría, tipo, estado, moneda, proyecto, proveedor, rango de fechas y texto libre.
- **Suscripciones**: alta y edición con nombre, categoría, precio, moneda, frecuencia (mensual/trimestral/semestral/anual/personalizada), próxima fecha de cobro, medio de pago, estado, renovación automática y proyecto asociado; acciones de editar, registrar pago, pausar, reactivar, cancelar y eliminar.
- **Registro automático del gasto al confirmar el pago de una suscripción**, con avance automático de la próxima fecha de cobro según la frecuencia y doble protección contra pagos duplicados. No se generan gastos futuros sin que el usuario confirme cada pago.
- **Indicadores visuales de vencimiento** de suscripciones (vence hoy / vence pronto / vencida / activa / pausada / cancelada), con los colores verde/amarillo/rojo/gris.
- **Resumen mensual**: total gastado este mes y el anterior con variación porcentual, gastos fijos y variables, suscripciones activas, próximos vencimientos, pagos pendientes, categoría con mayor gasto, gráfico de gastos por categoría, evolución de los últimos 6 meses y próximos pagos — todo separado por moneda.
- **Proyectos asociados**: cualquier gasto o suscripción puede vincularse a una serie y/o un video existentes (reutilizando esas entidades, sin duplicar información); nueva sección "Costos del proyecto" con botón "Ver todos los costos" en la ficha de cada video.
- **Respaldo actualizado**: exportar/importar ahora incluye las 7 colecciones del módulo Costos; los respaldos generados antes de la v1.2.0 se siguen importando sin errores.
- **Reglas de negocio**: monto nunca negativo, gastos cancelados fuera de los totales, ARS y USD siempre separados (nunca sumados), gastos históricos conservados al cancelar/eliminar una suscripción o cambiar su precio, protección al eliminar categorías/tipos/medios/monedas en uso (reasignar o desactivar en su lugar).

**Migración de datos**

- El esquema de IndexedDB pasó de versión 2 a versión 3, agregando siete stores nuevos (`expenseCategories`, `expenseTypes`, `paymentMethods`, `currencies`, `recipients`, `expenses`, `subscriptions`) de forma aditiva. Ningún store ni dato de versiones anteriores se modifica, se borra ni se recrea durante la migración.
- Verificado con pruebas automatizadas que simulan tanto una base v1.1.0 (con Biblioteca y datos reales) como una base v1.0.0 original saltando directo a la v1.2.0 en un solo paso, confirmando en ambos casos que todo permanece intacto.

**Conocido / sin cambios respecto a versiones anteriores**

- Costos no tiene un estado "archivado" para gastos/suscripciones (a diferencia de Biblioteca): eliminar es siempre permanente, con confirmación previa.
- No hay conversión de moneda ni cotización automática (por diseño): los totales se muestran siempre separados por moneda.
- Ver la sección 5 de `README.md` para el detalle completo de limitaciones conocidas de esta versión.

## v1.1.0

Agrega el módulo **Biblioteca**: un explorador de recursos con carpetas anidadas, integrado con el resto de la aplicación existente (misma identidad visual, mismo sistema de etiquetas, mismo motor de respaldo). No se rehizo ninguna parte de la v1.0.0; se trabajó exclusivamente agregando código sobre los archivos existentes.

**Agregado**

- **Biblioteca de recursos**: nuevo módulo accesible desde el sidebar, con vista de grilla y de lista.
- **Carpetas y subcarpetas**: jerarquía sin límite de anidamiento (por `parentId`), crear, renombrar, duplicar, mover, archivar y eliminar, con prevención de nombres duplicados en el mismo nivel y prevención de ciclos al mover.
- **Archivos locales**: subida por selector, arrastrar y soltar desde el sistema operativo, y pegar una imagen del portapapeles (Ctrl/Cmd+V); guardados en IndexedDB como base64, con aviso de tamaño configurable que nunca bloquea la carga (el usuario decide guardar igual, usar un enlace o cancelar).
- **Enlaces**: agregar enlaces web, de Drive (archivo o carpeta), Google Docs, Google Sheets y YouTube, con tipo y miniatura (cuando aplica) detectados automáticamente a partir de la URL.
- **Asociación con videos**: un recurso puede vincularse a uno o más videos y viceversa, por ID (sin duplicar datos); nueva pestaña **Biblioteca** dentro de la ficha del video para ver, agregar y quitar recursos asociados, con acceso directo de ida y vuelta.
- **Buscador global**: encuentra recursos y carpetas en toda la Biblioteca (no solo en la carpeta actual) y muestra la ruta completa de cada resultado.
- **Etiquetas compartidas**: la Biblioteca reutiliza exactamente el mismo catálogo de etiquetas que los videos, sin una tabla separada.
- **Favoritos y recientes**: vistas rápidas para marcar recursos favoritos y ver los usados/agregados más recientemente.
- **"Mover a…"**: alternativa completa al arrastrar y soltar para mover carpetas y recursos, disponible siempre (incluido en celular, donde reemplaza al drag & drop).
- **Archivar antes de eliminar**: comportamiento configurable (archivar siempre / eliminar directamente / preguntar cada vez) para carpetas y recursos.
- **Nueva sección en Configuración → Biblioteca**: vista predeterminada, tamaño de tarjeta, miniaturas, límite de tamaño de archivo, orden predeterminado, comportamiento de borrado, calidad de miniaturas, carpeta predeterminada.
- **Métricas nuevas en el dashboard de Inicio**: total de carpetas, total de recursos, recursos sin etiquetar, favoritos y una mini-lista de recursos agregados recientemente.
- **Respaldo actualizado**: exportar/importar ahora incluye las carpetas y recursos de la Biblioteca; los respaldos generados con la v1.0.0 (sin Biblioteca) se siguen importando sin errores.
- **Botón de acción flotante (FAB)** en celular para crear contenido nuevo en la Biblioteca sin depender de una barra de herramientas de escritorio.

**Migración de datos**

- El esquema de IndexedDB pasó de versión 1 a versión 2, agregando dos stores nuevos (`libraryFolders`, `libraryItems`) de forma aditiva. Ningún store ni dato de la v1.0.0 se modifica, se borra ni se recrea durante la migración.
- Las preferencias nuevas de Biblioteca se agregan automáticamente al documento de configuración existente la primera vez que se abre la app actualizada, sin pisar ninguna preferencia que el usuario ya hubiera elegido.
- Verificado con una prueba automatizada que simula una base de datos v1.0.0 con datos reales (videos, series, estados, etiquetas, preferencias personalizadas) abriéndose con el código de la v1.1.0, confirmando que todo permanece intacto.

**Seguridad**

- Todo el contenido generado por el usuario dentro de la Biblioteca (nombres, descripciones, URLs) se escapa antes de insertarse en el HTML.
- Las URLs de enlaces se validan (deben comenzar con `http://` o `https://`) tanto al crearlas como al abrirlas y al editarlas, evitando que un esquema como `javascript:` pueda ejecutarse.
- Los respaldos corruptos o con JSON inválido se rechazan con un mensaje claro.
- Se agregó manejo explícito de errores de cuota de IndexedDB al guardar archivos, evitando que quede un recurso a medio guardar sin avisar al usuario.

**Conocido / sin cambios respecto a la v1.0.0**

- El calendario avanzado y Analytics siguen sin implementarse (pantallas "Próximamente").
- El arrastrar y soltar (tanto en Kanban como en Biblioteca) sigue sin funcionar bien en pantallas táctiles; para eso existen alternativas sin drag & drop en ambos módulos.
- Ver la sección 5 de `README.md` para el detalle completo de limitaciones conocidas de esta versión.

## v1.0.0

Primera versión de Fútbol XL Studio.

- Tablero Kanban de producción de video totalmente configurable (estados, series, formatos, tipos de contenido, prioridades y etiquetas definidos por el usuario, sin datos rígidos en el código).
- Vistas de Kanban, Lista y Calendario simple para los videos.
- Ficha de video con pestañas de información general, enlaces de Drive, guion/notas, checklist con plantillas, etiquetas, archivos/imágenes, historial y comentarios.
- Buscador global y panel de filtros combinables.
- Módulo de Configuración completo: identidad visual (logo, nombre, tema, color de acento), catálogos (series/formatos/tipos/estados/prioridades/etiquetas) con CRUD y verificación de uso antes de eliminar, fusión de etiquetas, plantillas de checklist, preferencias generales, y datos/respaldo (exportar, importar, restaurar datos de ejemplo, ver uso de almacenamiento, eliminar todos los datos).
- Dashboard de Inicio con métricas calculadas en vivo.
- Autosave, deshacer (un nivel), atajos de teclado, tema oscuro/claro, diseño responsive (desktop/tablet/celular).
- Persistencia 100% en IndexedDB; sitio estático desplegable en Vercel sin backend.
