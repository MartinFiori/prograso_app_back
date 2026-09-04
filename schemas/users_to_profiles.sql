insert into public.profiles (
  id,
  role,
  name,
  avatar_url
)
select
  id,
  'user',
  coalesce(
    raw_user_meta_data ->> 'full_name',
    raw_user_meta_data ->> 'name',
    split_part(email, '@', 1),
    'Usuario'
  ),
  coalesce(
    raw_user_meta_data ->> 'avatar_url',
    raw_user_meta_data ->> 'picture'
  )
from auth.users
on conflict (id) do nothing;