-- Jalankan sekali di SQL Editor Supabase sebelum memakai aplikasi.
create table if not exists public.tasks (
  id uuid primary key,
  title text not null check (length(btrim(title)) > 0),
  status text not null default 'to_do'
    check (status in ('to_do', 'pending', 'in_progress', 'done')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  due_date date,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Aman dijalankan ulang pada database yang sudah memiliki task.
alter table public.tasks add column if not exists priority text not null default 'medium'
  check (priority in ('low', 'medium', 'high'));
alter table public.tasks add column if not exists due_date date;

create table if not exists public.audit_logs (
  id integer generated always as identity primary key,
  task_id uuid not null references public.tasks(id) on delete restrict,
  actor text not null check (length(btrim(actor)) > 0),
  from_status text not null,
  to_status text not null,
  changed_at timestamptz not null default now()
);

-- Browser tidak mengakses tabel langsung. Hanya Express memakai kunci server.
alter table public.tasks enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.reject_audit_log_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Audit log tidak boleh diubah atau dihapus';
end;
$$;

drop trigger if exists audit_log_immutable on public.audit_logs;
create trigger audit_log_immutable
before update or delete on public.audit_logs
for each row execute function public.reject_audit_log_change();

-- Satu pemanggilan RPC = satu transaksi database, termasuk penguncian row task.
create or replace function public.change_task_status(
  p_task_id uuid,
  p_status text,
  p_actor text
)
returns jsonb
language plpgsql
as $$
declare
  current_task public.tasks%rowtype;
  old_status text;
begin
  select * into current_task
  from public.tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'Task tidak ditemukan' using errcode = 'P0002';
  end if;
  if current_task.deleted_at is not null then
    raise exception 'Task sudah dihapus' using errcode = 'P0001';
  end if;
  if p_status = current_task.status then
    return to_jsonb(current_task);
  end if;
  if not (
    (current_task.status = 'to_do' and p_status = 'pending') or
    (current_task.status = 'pending' and p_status = 'in_progress') or
    (current_task.status = 'in_progress' and p_status = 'done')
  ) then
    raise exception 'Transisi status tidak valid' using errcode = 'P0001';
  end if;

  old_status := current_task.status;
  update public.tasks set status = p_status
  where id = p_task_id
  returning * into current_task;

  insert into public.audit_logs (task_id, actor, from_status, to_status)
  values (p_task_id, p_actor, old_status, p_status);

  return to_jsonb(current_task);
end;
$$;

revoke execute on function public.change_task_status(uuid, text, text)
from public, anon, authenticated;
grant execute on function public.change_task_status(uuid, text, text)
to service_role;
