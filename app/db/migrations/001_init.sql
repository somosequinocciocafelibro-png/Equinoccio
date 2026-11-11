-- Esquema inicial de Caja Equinoccio. Montos en pesos enteros; fechas en UTC (el día de venta se calcula en Bogotá).

create table profiles (
  user_id text primary key,
  role text not null check (role in ('caja', 'admin')),
  name text not null,
  username text not null unique
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
