create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  price numeric(10,2) not null default 0,
  image text not null default '/images/hero-fresas.svg',
  category text not null default 'fresas',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null default '',
  customer_phone text not null default '',
  delivery_mode text not null default 'domicilio',
  delivery_address text not null default '',
  delivery_when text not null default 'ahora',
  delivery_date date null,
  delivery_time time null,
  notes text not null default '',
  subtotal numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  status text not null default 'nuevo',
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.orders enable row level security;

-- lectura pública de productos activos para el sitio
create policy if not exists "public can read active products"
on public.products
for select
using (active = true);

-- el panel autenticado puede ver y administrar todos los productos
create policy if not exists "authenticated can manage products"
on public.products
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

-- clientes pueden crear pedidos desde el sitio
create policy if not exists "public can create orders"
on public.orders
for insert
with check (true);

-- el panel autenticado puede leer y actualizar pedidos
create policy if not exists "authenticated can read orders"
on public.orders
for select
using (auth.role() = 'authenticated');

create policy if not exists "authenticated can update orders"
on public.orders
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

-- opcional: insertar tu menú inicial
insert into public.products (title, description, price, image, category, active)
values
  ('Fresas individuales', 'Porción clásica de fresas con chocolate.', 85, '/images/fresas-individuales.svg', 'fresas', true),
  ('Caja regalo', 'Caja especial para regalo con presentación premium.', 180, '/images/caja-regalo.svg', 'regalos', true),
  ('Arreglo especial', 'Arreglo premium para fechas especiales.', 260, '/images/arreglo-especial.svg', 'especiales', true),
  ('Bebida de fresa', 'Bebida fresca sabor fresa.', 65, '/images/bebida-fresa.svg', 'bebidas', true)
on conflict do nothing;
