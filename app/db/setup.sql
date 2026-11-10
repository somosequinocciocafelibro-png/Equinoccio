-- Caja Equinoccio: preparación de una base nueva. Archivo generado con `npm run db:sql`; no se edita a mano.
begin;
create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now());
-- Migración 001_init.sql
-- Esquema inicial de Caja Equinoccio. Montos en pesos enteros; fechas en UTC (el día de venta se calcula en Bogotá).

create table profiles (
  user_id text primary key,
  role text not null check (role in ('caja', 'admin'))
);

create table settings (
  id int primary key default 1 check (id = 1),
  service_pct int not null default 10 check (service_pct between 0 and 30)
);
insert into settings (id) values (1);

create table dining_tables (
  id text primary key,
  name text not null,
  salon text,
  capacity int check (capacity is null or capacity > 0),
  active boolean not null default true,
  is_takeout boolean not null default false,
  sort int not null default 0
);

create table products (
  id text primary key,
  name text not null unique,
  category text not null,
  price int not null check (price >= 0),
  active boolean not null default true,
  sort int not null default 0
);

create table extras (
  id text primary key,
  name text not null,
  delta int not null default 0,
  active boolean not null default true
);

create table tickets (
  id text primary key,
  table_id text not null references dining_tables (id),
  table_name text not null,
  salon text,
  is_takeout boolean not null default false,
  status text not null default 'abierto' check (status in ('abierto', 'cerrado', 'anulado')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  service_enabled boolean not null default true,
  service_custom int check (service_custom is null or service_custom >= 0),
  service_frozen int check (service_frozen is null or service_frozen >= 0),
  void_reason text,
  voided_by text,
  voided_at timestamptz,
  created_by text
);
create unique index one_open_ticket_per_table on tickets (table_id) where status = 'abierto' and not is_takeout;
create index tickets_status_idx on tickets (status);
create index tickets_closed_at_idx on tickets (closed_at);

create table ticket_lines (
  id text primary key,
  ticket_id text not null references tickets (id),
  product_id text not null references products (id),
  name text not null,
  unit_price int not null check (unit_price >= 0),
  qty int not null check (qty > 0),
  extras jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index ticket_lines_ticket_idx on ticket_lines (ticket_id);

create table payments (
  id text primary key,
  ticket_id text not null references tickets (id),
  medio text not null check (medio in ('efectivo', 'transferencia', 'bre_b', 'bold', 'sin_medio')),
  received int not null check (received >= 0),
  applied int not null check (applied > 0),
  idempotency_key text not null unique,
  created_by text,
  created_at timestamptz not null default now()
);
create index payments_ticket_idx on payments (ticket_id);

create table day_closings (
  day text primary key,
  base int not null default 0,
  expected jsonb not null,
  real jsonb not null,
  diff jsonb not null,
  sales int not null,
  service int not null,
  ticket_count int not null,
  note text not null default '',
  closed_by text,
  closed_at timestamptz not null default now(),
  locked boolean not null default true,
  reopened jsonb not null default '[]'
);

-- El acceso es solo por el servidor: sin políticas, anon no lee ni escribe.
alter table profiles enable row level security;
alter table settings enable row level security;
alter table dining_tables enable row level security;
alter table products enable row level security;
alter table extras enable row level security;
alter table tickets enable row level security;
alter table ticket_lines enable row level security;
alter table payments enable row level security;
alter table day_closings enable row level security;
insert into schema_migrations (name) values ('001_init.sql');
-- Catálogo inicial: salones, mesas, extras y productos
insert into dining_tables (id, name, salon, capacity, is_takeout, sort) values ('luna-1', 'Mesa 1', 'Luna', null, false, 1);
insert into dining_tables (id, name, salon, capacity, is_takeout, sort) values ('luna-2', 'Mesa 2', 'Luna', null, false, 2);
insert into dining_tables (id, name, salon, capacity, is_takeout, sort) values ('luna-3', 'Mesa 3', 'Luna', null, false, 3);
insert into dining_tables (id, name, salon, capacity, is_takeout, sort) values ('luna-barra', 'Barra', 'Luna', 2, false, 4);
insert into dining_tables (id, name, salon, capacity, is_takeout, sort) values ('eq-1', 'Mesa 1', 'Equinoccio', null, false, 5);
insert into dining_tables (id, name, salon, capacity, is_takeout, sort) values ('eq-2', 'Mesa 2', 'Equinoccio', null, false, 6);
insert into dining_tables (id, name, salon, capacity, is_takeout, sort) values ('eq-3', 'Mesa 3', 'Equinoccio', null, false, 7);
insert into dining_tables (id, name, salon, capacity, is_takeout, sort) values ('eq-4', 'Mesa 4', 'Equinoccio', null, false, 8);
insert into dining_tables (id, name, salon, capacity, is_takeout, sort) values ('sol-1', 'Mesa 1', 'Sol', null, false, 9);
insert into dining_tables (id, name, salon, capacity, is_takeout, sort) values ('sol-2', 'Mesa 2', 'Sol', null, false, 10);
insert into dining_tables (id, name, salon, capacity, is_takeout, sort) values ('sol-3', 'Mesa 3', 'Sol', null, false, 11);
insert into dining_tables (id, name, salon, capacity, is_takeout, sort) values ('sol-barra', 'Barra', 'Sol', 2, false, 12);
insert into dining_tables (id, name, salon, capacity, is_takeout, sort) values ('llevar', 'Para llevar', null, null, true, 13);
insert into extras (id, name, delta) values ('vainilla', 'Vainilla', 500);
insert into extras (id, name, delta) values ('caramelo', 'Caramelo', 0);
insert into products (id, name, category, price, sort) values ('espresso', 'Espresso', 'Café', 4000, 1);
insert into products (id, name, category, price, sort) values ('americano', 'Americano', 'Café', 4500, 2);
insert into products (id, name, category, price, sort) values ('capuchino', 'Capuchino', 'Café', 9000, 3);
insert into products (id, name, category, price, sort) values ('latte', 'Latte', 'Café', 8000, 4);
insert into products (id, name, category, price, sort) values ('mini-latte', 'Mini Latte', 'Café', 6000, 5);
insert into products (id, name, category, price, sort) values ('mocca', 'Mocca', 'Café', 10500, 6);
insert into products (id, name, category, price, sort) values ('macchiato-caramelo', 'Macchiato caramelo', 'Café', 7000, 7);
insert into products (id, name, category, price, sort) values ('affogato', 'Affogato', 'Café', 11000, 8);
insert into products (id, name, category, price, sort) values ('chocolate', 'Chocolate', 'Café', 10000, 9);
insert into products (id, name, category, price, sort) values ('ice-latte', 'Ice Latte', 'Fríos', 8500, 10);
insert into products (id, name, category, price, sort) values ('cold-brew-chocolate', 'Cold Brew + Chocolate', 'Fríos', 8000, 11);
insert into products (id, name, category, price, sort) values ('te-frutos-rojos', 'Té frutos rojos', 'Té y aromáticas', 8000, 12);
insert into products (id, name, category, price, sort) values ('te-marea-de-luna', 'Té Marea de Luna', 'Té y aromáticas', 8000, 13);
insert into products (id, name, category, price, sort) values ('aromatica-hierbabuena', 'Aromática hierbabuena', 'Té y aromáticas', 6000, 14);
insert into products (id, name, category, price, sort) values ('aromatica-frutos-rojos', 'Aromática frutos rojos', 'Té y aromáticas', 8000, 15);
insert into products (id, name, category, price, sort) values ('aromatica-maracuya', 'Aromática maracuyá', 'Té y aromáticas', 8000, 16);
insert into products (id, name, category, price, sort) values ('aromatica-sandia', 'Aromática sandía', 'Té y aromáticas', 6000, 17);
insert into products (id, name, category, price, sort) values ('soda-nectar-solar', 'Soda Néctar Solar', 'Sodas', 10000, 18);
insert into products (id, name, category, price, sort) values ('soda-bosque-tropical', 'Soda Bosque Tropical', 'Sodas', 10000, 19);
insert into products (id, name, category, price, sort) values ('soda-frutos-amarillos', 'Soda frutos amarillos', 'Sodas', 10000, 20);
insert into products (id, name, category, price, sort) values ('soda-frutos-rojos', 'Soda frutos rojos', 'Sodas', 10000, 21);
insert into products (id, name, category, price, sort) values ('croissant-frutos-rojos', 'Croissant frutos rojos', 'Panadería', 6500, 22);
insert into products (id, name, category, price, sort) values ('croissant-chocolate', 'Croissant chocolate', 'Panadería', 6500, 23);
insert into products (id, name, category, price, sort) values ('crookie', 'Crookie', 'Panadería', 6500, 24);
insert into products (id, name, category, price, sort) values ('rollo-de-canela', 'Rollo de canela', 'Panadería', 6500, 25);
insert into products (id, name, category, price, sort) values ('palito-chocolate', 'Palito de chocolate', 'Panadería', 6500, 26);
insert into products (id, name, category, price, sort) values ('palito-queso-crema', 'Palito queso crema', 'Panadería', 6500, 27);
insert into products (id, name, category, price, sort) values ('palito-bocadillo', 'Palito de bocadillo', 'Panadería', 4000, 28);
insert into products (id, name, category, price, sort) values ('palito-queso-bocadillo', 'Palito queso + bocadillo', 'Panadería', 3500, 29);
insert into products (id, name, category, price, sort) values ('almojabana', 'Almojábana', 'Panadería', 2000, 30);
insert into products (id, name, category, price, sort) values ('pastel-manzana', 'Pastel de manzana', 'Pasteles y salados', 6500, 31);
insert into products (id, name, category, price, sort) values ('pastel-espinaca-ricota', 'Pastel espinaca y ricota', 'Pasteles y salados', 6500, 32);
insert into products (id, name, category, price, sort) values ('pastel-ricotta', 'Pastel ricotta', 'Pasteles y salados', 4500, 33);
insert into products (id, name, category, price, sort) values ('pastel-carne-ranchero', 'Pastel carne ranchero', 'Pasteles y salados', 6500, 34);
insert into products (id, name, category, price, sort) values ('pastel-pollo', 'Pastel de pollo', 'Pasteles y salados', 4500, 35);
insert into products (id, name, category, price, sort) values ('pastel-almendras', 'Pastel de almendras', 'Pasteles y salados', 6500, 36);
insert into products (id, name, category, price, sort) values ('pastel-arequipe-pequeno', 'Pastel arequipe pequeño', 'Pasteles y salados', 2000, 37);
insert into products (id, name, category, price, sort) values ('torta-zanahoria', 'Torta de zanahoria', 'Pasteles y salados', 6000, 38);
insert into products (id, name, category, price, sort) values ('pollo-carbonara', 'Pollo carbonara', 'Pasteles y salados', 13000, 39);
insert into products (id, name, category, price, sort) values ('malteada-vainilla', 'Malteada de vainilla', 'Malteadas', 8000, 40);
insert into products (id, name, category, price, sort) values ('malteada-fresa', 'Malteada de fresa', 'Malteadas', 8000, 41);
insert into products (id, name, category, price, sort) values ('malteada-arequipe', 'Malteada de arequipe', 'Malteadas', 8000, 42);
insert into products (id, name, category, price, sort) values ('malteada-chocolate', 'Malteada de chocolate', 'Malteadas', 8000, 43);
commit;
