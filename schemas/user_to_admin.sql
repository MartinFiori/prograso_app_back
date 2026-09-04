update public.profiles as profile
set role = 'admin'
from auth.users as auth_user
where profile.id = auth_user.id
  and lower(auth_user.email) =
      lower('martinnicolasfiori@gmail.com');