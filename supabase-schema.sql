-- =========================================================================
-- Fútbol XL Studio — esquema de Supabase (Postgres)
-- =========================================================================
-- Reemplaza el almacenamiento en IndexedDB por Supabase, preservando
-- exactamente la misma forma de los datos que ya usa la aplicación.
--
-- DISEÑO ELEGIDO: "tabla documento"
-- ---------------------------------
-- IndexedDB es una base de datos de documentos (cada "object store" guarda
-- objetos JS completos, sin columnas fijas). Para no romper NINGÚN campo
-- existente ni tener que tocar app.js/components.js, cada store se traduce
-- a una tabla con:
--   - una clave primaria (`id`, o `key` en settings/meta, igual que el
--     `keyPath` que ya usaba IndexedDB),
--   - una columna `data jsonb` que guarda el objeto completo tal cual lo
--     arma la aplicación (con todos sus campos, incluidos los que se
--     agreguen en el futuro sin necesitar otra migración de SQL),
--   - `updated_at` para trazabilidad.
--
-- Todo el filtrado/orden/búsqueda lo sigue haciendo la aplicación en el
-- navegador (como ya hacía con IndexedDB): esta capa solo necesita poder
-- traer todo (`getAll`), traer uno por clave (`get`), guardar (`put` /
-- `bulkPut`), borrar (`remove`) y vaciar (`clear`) cada tabla, que es
-- exactamente la API que expone db.js.
--
-- CÓMO USAR ESTE ARCHIVO
-- -----------------------
-- 1. Entrá a tu proyecto de Supabase → SQL Editor → "New query".
-- 2. Pegá todo este archivo y ejecutalo una sola vez (es seguro volver a
--    correrlo: todas las sentencias usan IF NOT EXISTS).
-- 3. Los permisos (RLS) quedan abiertos para el rol `anon`, porque esta
--    aplicación no tiene sistema de login (es de un solo usuario por
--    navegador, igual que con IndexedDB). Ver la nota de seguridad al
--    final del archivo antes de compartir la URL de tu Supabase.
-- =========================================================================

-- Extensión usada para generar UUIDs desde SQL si hiciera falta (la app ya
-- genera sus propios IDs en JavaScript con crypto.randomUUID(), pero no
-- está de más tenerla disponible).
create extension if not exists pgcrypto;

-- -------------------------------------------------------------------------
-- Función auxiliar: mantiene updated_at al día en cada UPDATE.
-- -------------------------------------------------------------------------
create or replace function fxl_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- -------------------------------------------------------------------------
-- Tablas con clave primaria "id" (todos los stores de IndexedDB con
-- keyPath: 'id').
-- -------------------------------------------------------------------------
-- videos              (Kanban de producción de video)
-- series
-- formats
-- content_types       (contentTypes en IndexedDB)
-- states
-- priorities
-- tags
-- checklist_templates (checklistTemplates en IndexedDB)
-- library_folders     (libraryFolders en IndexedDB)
-- library_items       (libraryItems en IndexedDB)
-- expense_categories  (expenseCategories en IndexedDB)
-- expense_types       (expenseTypes en IndexedDB)
-- payment_methods     (paymentMethods en IndexedDB)
-- currencies
-- recipients
-- expenses
-- subscriptions
-- -------------------------------------------------------------------------

do $$
declare
  t text;
  tables text[] := array[
    'videos',
    'series',
    'formats',
    'content_types',
    'states',
    'priorities',
    'tags',
    'checklist_templates',
    'library_folders',
    'library_items',
    'expense_categories',
    'expense_types',
    'payment_methods',
    'currencies',
    'recipients',
    'expenses',
    'subscriptions'
  ];
begin
  foreach t in array tables loop
    execute format('
      create table if not exists %I (
        id text primary key,
        data jsonb not null default ''{}''::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    ', t);

    -- Índice GIN sobre el JSON completo: no lo necesita la app hoy (filtra
    -- todo en el navegador), pero queda disponible por si en el futuro se
    -- agregan consultas del lado del servidor sin tener que migrar nada.
    execute format('create index if not exists %I on %I using gin (data);', t || '_data_gin_idx', t);

    execute format('drop trigger if exists %I on %I;', t || '_set_updated_at', t);
    execute format('
      create trigger %I
      before update on %I
      for each row execute function fxl_set_updated_at();
    ', t || '_set_updated_at', t);

    execute format('alter table %I enable row level security;', t);

    -- Políticas permisivas para el rol anon (ver nota de seguridad al pie).
    execute format('drop policy if exists %I on %I;', t || '_anon_all', t);
    execute format('
      create policy %I on %I
      for all
      to anon, authenticated
      using (true)
      with check (true);
    ', t || '_anon_all', t);
  end loop;
end $$;

-- -------------------------------------------------------------------------
-- Tablas con clave primaria "key" (stores de IndexedDB con keyPath: 'key').
-- -------------------------------------------------------------------------
-- settings -> un único documento con key = 'app'
-- meta     -> varios documentos chicos (key = 'logo', key = 'schemaVersion', etc.)
-- -------------------------------------------------------------------------

do $$
declare
  t text;
  tables text[] := array['settings', 'meta'];
begin
  foreach t in array tables loop
    execute format('
      create table if not exists %I (
        key text primary key,
        data jsonb not null default ''{}''::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    ', t);

    execute format('drop trigger if exists %I on %I;', t || '_set_updated_at', t);
    execute format('
      create trigger %I
      before update on %I
      for each row execute function fxl_set_updated_at();
    ', t || '_set_updated_at', t);

    execute format('alter table %I enable row level security;', t);

    execute format('drop policy if exists %I on %I;', t || '_anon_all', t);
    execute format('
      create policy %I on %I
      for all
      to anon, authenticated
      using (true)
      with check (true);
    ', t || '_anon_all', t);
  end loop;
end $$;

-- -------------------------------------------------------------------------
-- Tabla de control de la migración automática desde IndexedDB (ver db.js).
-- Guarda un único registro para saber si ya se hizo la migración inicial
-- desde el navegador que la ejecuta, evitando que se repita o duplique
-- datos si se recarga la app varias veces.
-- -------------------------------------------------------------------------
create table if not exists fxl_migration_status (
  id text primary key,
  migrated boolean not null default false,
  migrated_at timestamptz,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists fxl_migration_status_set_updated_at on fxl_migration_status;
create trigger fxl_migration_status_set_updated_at
before update on fxl_migration_status
for each row execute function fxl_set_updated_at();

alter table fxl_migration_status enable row level security;

drop policy if exists fxl_migration_status_anon_all on fxl_migration_status;
create policy fxl_migration_status_anon_all on fxl_migration_status
for all
to anon, authenticated
using (true)
with check (true);

-- =========================================================================
-- NOTA DE SEGURIDAD (leer antes de desplegar)
-- =========================================================================
-- Fútbol XL Studio nunca tuvo sistema de login: es una app pensada para
-- que la use una sola persona (u organización de confianza) por navegador,
-- primero contra IndexedDB local y ahora contra este proyecto de Supabase.
--
-- Las políticas de este archivo dejan lectura/escritura abierta a
-- cualquiera que tenga tu SUPABASE_URL y tu clave publicable (anon key).
-- La clave publicable está diseñada para poder exponerse en el navegador
-- (no es un secreto como la "service_role key", que NUNCA debe usarse acá),
-- pero como no hay autenticación, cualquiera que consiga esa URL + clave
-- puede leer y modificar todos los datos.
--
-- Mientras el proyecto de Supabase y esas credenciales no se compartan
-- públicamente, el riesgo es equivalente al que ya existía con IndexedDB
-- (los datos vivían solo en tu navegador). Si en el futuro necesitás que
-- varias personas usen la app con datos separados, hace falta agregar
-- Supabase Auth y cambiar estas políticas para filtrar por usuario
-- (`auth.uid()`), lo cual es un cambio de arquitectura más grande que no
-- estaba pedido en esta migración.
-- =========================================================================
