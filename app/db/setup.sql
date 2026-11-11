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
insert into extras (id, name, delta) values ('miel', 'Miel', 500);
insert into extras (id, name, delta) values ('panela', 'Panela', 500);
insert into extras (id, name, delta) values ('vainilla', 'Vainilla', 500);
insert into extras (id, name, delta) values ('caramelo', 'Caramelo', 500);
insert into extras (id, name, delta) values ('arequipe', 'Arequipe', 1000);
insert into extras (id, name, delta) values ('cocoa', 'Cocoa', 1000);
insert into extras (id, name, delta) values ('chocolate', 'Chocolate', 1000);
insert into extras (id, name, delta) values ('leche-condensada', 'Leche condensada', 1000);
insert into extras (id, name, delta) values ('chantilli', 'Chantillí', 1000);
insert into extras (id, name, delta) values ('dulce-cereza', 'Dulce de cereza o sirope dulce', 1000);
insert into extras (id, name, delta) values ('leche-espuma-frutos-soda', 'Leche espuma / frutos / soda', 2000);
insert into products (id, name, category, price, active, sort) values ('espresso', 'Espresso', 'Café caliente', 4000, true, 1);
insert into products (id, name, category, price, active, sort) values ('americano', 'Americano', 'Café caliente', 4500, true, 2);
insert into products (id, name, category, price, active, sort) values ('macchiato', 'Macchiato', 'Café caliente', 6000, true, 3);
insert into products (id, name, category, price, active, sort) values ('flat-white', 'Flat White', 'Café caliente', 7000, true, 4);
insert into products (id, name, category, price, active, sort) values ('latte', 'Latte', 'Café caliente', 8000, true, 5);
insert into products (id, name, category, price, active, sort) values ('capuchino', 'Cappuccino', 'Café caliente', 9000, true, 6);
insert into products (id, name, category, price, active, sort) values ('mocca', 'Mocha Equinoccio', 'Café caliente', 10000, true, 7);
insert into products (id, name, category, price, active, sort) values ('affogato', 'Affogato', 'Café caliente', 11000, true, 8);
insert into products (id, name, category, price, active, sort) values ('chocolate', 'Hot Chocolate', 'Chocolate caliente', 10000, true, 9);
insert into products (id, name, category, price, active, sort) values ('cold-brew', 'Cold Brew', 'Café frío', 8000, true, 10);
insert into products (id, name, category, price, active, sort) values ('ice-latte', 'Iced Latte', 'Café frío', 8000, true, 11);
insert into products (id, name, category, price, active, sort) values ('iced-caramel-latte', 'Iced Caramel Latte', 'Café frío', 8000, true, 12);
insert into products (id, name, category, price, active, sort) values ('iced-mocha', 'Iced Mocha Equinoccio', 'Café frío', 10000, true, 13);
insert into products (id, name, category, price, active, sort) values ('iced-macchiaramelo', 'Iced Macchiaramelo Equinoccio', 'Café frío', 10000, true, 14);
insert into products (id, name, category, price, active, sort) values ('fuego-de-equinoccio', 'Fuego de Equinoccio', 'Café frío', 10000, true, 15);
insert into products (id, name, category, price, active, sort) values ('eclipse-de-equinoccio', 'Eclipse de Equinoccio', 'Café frío', 10000, true, 16);
insert into products (id, name, category, price, active, sort) values ('sol-de-media-noche', 'Sol de Media Noche', 'Café frío', 10000, true, 17);
insert into products (id, name, category, price, active, sort) values ('malteada-vainilla', 'Malteada de vainilla', 'Malteadas', 10000, true, 18);
insert into products (id, name, category, price, active, sort) values ('malteada-arequipe', 'Malteada de arequipe', 'Malteadas', 10000, true, 19);
insert into products (id, name, category, price, active, sort) values ('malteada-chocolate', 'Malteada de chocolate', 'Malteadas', 10000, true, 20);
insert into products (id, name, category, price, active, sort) values ('soda-nectar-solar', 'Soda Néctar Solar', 'Sodas frutales', 10000, true, 21);
insert into products (id, name, category, price, active, sort) values ('soda-bosque-tropical', 'Soda Bosque Tropical', 'Sodas frutales', 10000, true, 22);
insert into products (id, name, category, price, active, sort) values ('soda-frutos-rojos', 'Soda Pasión', 'Sodas frutales', 10000, true, 23);
insert into products (id, name, category, price, active, sort) values ('soda-eclipse-azul', 'Soda Eclipse Azul', 'Sodas frutales', 10000, true, 24);
insert into products (id, name, category, price, active, sort) values ('te-marea-de-luna', 'Marea de Luna', 'Tés', 8000, true, 25);
insert into products (id, name, category, price, active, sort) values ('te-rayo-de-sol', 'Rayo de Sol', 'Tés', 8000, true, 26);
insert into products (id, name, category, price, active, sort) values ('te-luz-de-primavera', 'Luz de Primavera', 'Tés', 8000, true, 27);
insert into products (id, name, category, price, active, sort) values ('aromatica-manzanilla', 'Aromática de manzanilla', 'Aromáticas', 6000, true, 28);
insert into products (id, name, category, price, active, sort) values ('aromatica-cidron', 'Aromática de cidrón', 'Aromáticas', 6000, true, 29);
insert into products (id, name, category, price, active, sort) values ('aromatica-toronjil', 'Aromática de toronjil', 'Aromáticas', 6000, true, 30);
insert into products (id, name, category, price, active, sort) values ('aromatica-hierbabuena', 'Aromática de hierbabuena', 'Aromáticas', 6000, true, 31);
insert into products (id, name, category, price, active, sort) values ('aromatica-limoncillo', 'Aromática de limoncillo', 'Aromáticas', 6000, true, 32);
insert into products (id, name, category, price, active, sort) values ('aromatica-maracuya', 'Aromática de maracuyá', 'Aromáticas', 6000, true, 33);
insert into products (id, name, category, price, active, sort) values ('aromatica-flor-de-jamaica', 'Aromática de flor de jamaica', 'Aromáticas', 6000, true, 34);
insert into products (id, name, category, price, active, sort) values ('croissant-chocolate', 'Croissant bicolor chocolate mantequilla', 'Pastelería y panadería', 6500, true, 35);
insert into products (id, name, category, price, active, sort) values ('croissant-almendras', 'Croissant de almendras', 'Pastelería y panadería', 6500, true, 36);
insert into products (id, name, category, price, active, sort) values ('croissant-frutos-rojos', 'Croissant bicolor frutos rojos', 'Pastelería y panadería', 6500, true, 37);
insert into products (id, name, category, price, active, sort) values ('rollo-de-canela', 'Rollo de canela', 'Pastelería y panadería', 6500, true, 38);
insert into products (id, name, category, price, active, sort) values ('crookie', 'Crookie', 'Pastelería y panadería', 6500, true, 39);
insert into products (id, name, category, price, active, sort) values ('mini-pan-de-bono', 'Mini Pan de Bono', 'Pastelería y panadería', 2000, true, 40);
insert into products (id, name, category, price, active, sort) values ('palito-queso-crema', 'Palito queso crema', 'Pastelería y panadería', 6500, true, 41);
insert into products (id, name, category, price, active, sort) values ('palito-queso-crema-pequeno', 'Palito queso crema pequeño', 'Pastelería y panadería', 3500, true, 42);
insert into products (id, name, category, price, active, sort) values ('almojabana', 'Mini-almojábana', 'Pastelería y panadería', 2000, true, 43);
insert into products (id, name, category, price, active, sort) values ('flauta-chocolate', 'Flauta de chocolate', 'Pastelería y panadería', 6500, true, 44);
insert into products (id, name, category, price, active, sort) values ('pollo-carbonara', 'Pastel de pollo carbonara', 'Pastelería y panadería', 6500, true, 45);
insert into products (id, name, category, price, active, sort) values ('pastel-espinaca-ricota', 'Pastel de espinaca y queso ricotta', 'Pastelería y panadería', 6500, true, 46);
insert into products (id, name, category, price, active, sort) values ('pastel-espinaca-ricota-pequeno', 'Pastel de espinaca y queso ricotta pequeño', 'Pastelería y panadería', 4000, true, 47);
insert into products (id, name, category, price, active, sort) values ('pastel-carne-ranchero', 'Pastel de carne ranchero', 'Pastelería y panadería', 6500, true, 48);
insert into products (id, name, category, price, active, sort) values ('pan-chocolate-mantequilla', 'Pan de chocolate mantequilla', 'Pastelería y panadería', 3500, true, 49);
insert into products (id, name, category, price, active, sort) values ('pastel-manzana', 'Pastel de manzana', 'Pastelería y panadería', 6500, true, 50);
insert into products (id, name, category, price, active, sort) values ('torta-zanahoria', 'Pastel de zanahoria', 'Pastelería y panadería', 6500, true, 51);
insert into products (id, name, category, price, active, sort) values ('pastel-pollo', 'Pastel de pollo', 'Pastelería y panadería', 5000, true, 52);
insert into products (id, name, category, price, active, sort) values ('croissant-multicereal', 'Croissant multicereal mantequilla', 'Pastelería y panadería', 6500, true, 53);
insert into products (id, name, category, price, active, sort) values ('pastel-arequipe-pequeno', 'Mini roscón de arequipe', 'Pastelería y panadería', 2000, true, 54);
insert into products (id, name, category, price, active, sort) values ('palito-queso-bocadillo', 'Palito de bocadillo y queso', 'Pastelería y panadería', 6500, true, 55);
insert into products (id, name, category, price, active, sort) values ('pastel-arequipe', 'Pastel de arequipe', 'Pastelería y panadería', 6500, true, 56);
insert into products (id, name, category, price, active, sort) values ('mini-latte', 'Mini Latte', 'Café caliente', 6000, false, 57);
insert into products (id, name, category, price, active, sort) values ('macchiato-caramelo', 'Macchiato caramelo', 'Café caliente', 7000, false, 58);
insert into products (id, name, category, price, active, sort) values ('cold-brew-chocolate', 'Cold Brew + Chocolate', 'Café frío', 8000, false, 59);
insert into products (id, name, category, price, active, sort) values ('malteada-fresa', 'Malteada de fresa', 'Malteadas', 8000, false, 60);
insert into products (id, name, category, price, active, sort) values ('soda-frutos-amarillos', 'Soda frutos amarillos', 'Sodas frutales', 10000, false, 61);
insert into products (id, name, category, price, active, sort) values ('te-frutos-rojos', 'Té frutos rojos', 'Tés', 8000, false, 62);
insert into products (id, name, category, price, active, sort) values ('aromatica-frutos-rojos', 'Aromática frutos rojos', 'Aromáticas', 8000, false, 63);
insert into products (id, name, category, price, active, sort) values ('aromatica-sandia', 'Aromática sandía', 'Aromáticas', 6000, false, 64);
insert into products (id, name, category, price, active, sort) values ('palito-chocolate', 'Palito de chocolate', 'Pastelería y panadería', 6500, false, 65);
insert into products (id, name, category, price, active, sort) values ('palito-bocadillo', 'Palito de bocadillo', 'Pastelería y panadería', 4000, false, 66);
insert into products (id, name, category, price, active, sort) values ('pastel-ricotta', 'Pastel ricotta', 'Pastelería y panadería', 4500, false, 67);
insert into products (id, name, category, price, active, sort) values ('pastel-almendras', 'Pastel de almendras', 'Pastelería y panadería', 6500, false, 68);
commit;
