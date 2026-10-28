-- Courses : une petite note en haut d'une liste à part (« Paella 40 pers. – samedi »).
alter table public.grocery_lists add column if not exists note text check (char_length(note) <= 140);
