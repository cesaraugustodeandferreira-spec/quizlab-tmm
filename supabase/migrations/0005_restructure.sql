-- QuizLab · 0005 · Reestruturação Turmas ↔ Diagnósticos
-- Turma vira rótulo organizacional. Sem roster, sem código de acesso.
-- Diagnósticos somente por turma (sem individual).
-- class_students mantida na schema mas não referenciada.

-- 1. Simplificar tabela classes
DROP TRIGGER IF EXISTS classes_assign_code ON public.classes;
ALTER TABLE public.classes DROP COLUMN IF EXISTS access_code;
ALTER TABLE public.classes DROP COLUMN IF EXISTS identifier;

-- 2. Remover RLS policies de class_students
DROP POLICY IF EXISTS class_students_select_via_class ON public.class_students;
DROP POLICY IF EXISTS class_students_write_via_class ON public.class_students;

-- 3. Reescrever join_session — sem class_students
create or replace function public.join_session(p_room_code text, p_display_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.quiz_sessions%rowtype;
  v_name text := btrim(coalesce(p_display_name, ''));
  st public.session_students%rowtype;
  v_total integer;
begin
  if length(v_name) < 2 or length(v_name) > 40 then
    raise exception 'Informe um nome com entre 2 e 40 caracteres.' using errcode = 'P0001';
  end if;

  select * into s from public.quiz_sessions
  where upper(btrim(p_room_code)) = room_code and status = 'aguardando';

  if not found then
    if exists (select 1 from public.quiz_sessions where upper(btrim(p_room_code)) = room_code) then
      raise exception 'Esta sala já foi iniciada ou encerrada.' using errcode = 'P0001';
    end if;
    raise exception 'Não foi possível entrar na sala. Verifique o código.' using errcode = 'P0001';
  end if;

  select * into st from public.session_students
  where session_id = s.id and lower(btrim(name)) = lower(v_name);

  if not found then
    insert into public.session_students (session_id, name)
    values (s.id, initcap(v_name))
    returning * into st;
  end if;

  select count(*)::int into v_total from public.quiz_questions where quiz_id = s.quiz_id;

  return jsonb_build_object(
    'token', st.token,
    'name', st.name,
    'quiz_title', (select title from public.quizzes where id = s.quiz_id),
    'total_questions', v_total,
    'show_ranking', s.show_ranking,
    'show_score', s.show_score,
    'show_correct_answers', s.show_correct_answers
  );
end $$;

-- 4. Reescrever rpc_class_diagnostics — students de session_students, sem class_students
--    + parâmetro opcional p_subject_id para filtrar por disciplina
create or replace function public.rpc_class_diagnostics(
  p_class_id uuid,
  p_subject_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c public.classes%rowtype;
  v_any boolean;
begin
  if v_uid is null then raise exception 'Não autenticado.' using errcode = '42501'; end if;
  select * into c from public.classes where id = p_class_id;
  if not found then raise exception 'Turma não encontrada.' using errcode = 'P0002'; end if;
  if c.teacher_id <> v_uid then raise exception 'Sem permissão nesta turma.' using errcode = '42501'; end if;

  select exists(
    select 1 from public.answers a
    where a.class_id = p_class_id
      and (p_subject_id is null or exists (
        select 1 from public.questions q where q.id = a.question_id and q.subject_id = p_subject_id
      ))
  ) into v_any;

  return jsonb_build_object(
    'class', jsonb_build_object('id', c.id, 'name', c.name, 'grade_year', c.grade_year),
    'overall_pct', case when v_any then round((
      select avg(a.is_correct::int) * 100 from public.answers a
      where a.class_id = p_class_id
        and (p_subject_id is null or exists (
          select 1 from public.questions q where q.id = a.question_id and q.subject_id = p_subject_id
        ))
    )) end,
    'correct', (
      select count(*)::int from public.answers a
      where a.class_id = p_class_id and a.is_correct
        and (p_subject_id is null or exists (
          select 1 from public.questions q where q.id = a.question_id and q.subject_id = p_subject_id
        ))
    ),
    'wrong', (
      select count(*)::int from public.answers a
      where a.class_id = p_class_id and not a.is_correct and a.selected_index is not null
        and (p_subject_id is null or exists (
          select 1 from public.questions q where q.id = a.question_id and q.subject_id = p_subject_id
        ))
    ),
    'unanswered', (
      select count(*)::int from public.answers a
      where a.class_id = p_class_id and a.selected_index is null
        and (p_subject_id is null or exists (
          select 1 from public.questions q where q.id = a.question_id and q.subject_id = p_subject_id
        ))
    ),
    'sessions_count', (
      select count(*)::int from public.quiz_sessions s
      where s.class_id = p_class_id and s.status = 'encerrada'
    ),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'pct', round(pct), 'n', n))
      from (
        select coalesce(tp.name, q.subtopic, 'Sem tema') as label,
               avg(a.is_correct::int) * 100 as pct,
               count(*)::int as n
        from public.answers a
        join public.questions q on q.id = a.question_id
        left join public.topics tp on tp.id = q.topic_id
        where a.class_id = p_class_id
          and (p_subject_id is null or q.subject_id = p_subject_id)
        group by 1
        order by pct asc
      ) t
    ), '[]'::jsonb),
    'hardest', coalesce((
      select jsonb_agg(jsonb_build_object(
        'question_id', qid, 'statement', statement,
        'difficulty', difficulty, 'pct', round(pct), 'n', n
      ))
      from (
        select q.id as qid, q.statement, q.difficulty,
               avg(a.is_correct::int) * 100 as pct,
               count(*)::int as n
        from public.answers a
        join public.questions q on q.id = a.question_id
        where a.class_id = p_class_id
          and (p_subject_id is null or q.subject_id = p_subject_id)
        group by q.id, q.statement, q.difficulty
        having count(*) > 0
        order by pct asc
        limit 5
      ) t
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_id', s.id, 'title', q.title, 'date', s.ended_at,
        'participants', t.participants, 'avg_pct', round(t.avg_pct)
      ) order by s.ended_at desc nulls last)
      from public.quiz_sessions s
      join public.quizzes q on q.id = s.quiz_id
      join lateral (
        select count(*)::int as participants,
               avg(a.is_correct::int) * 100 as avg_pct
        from public.answers a where a.session_id = s.id
      ) t on true
      where s.class_id = p_class_id and s.status = 'encerrada'
    ), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', t.name, 'sessions', t.s, 'avg_pct', round(t.avg_pct)
      ) order by t.avg_pct asc nulls last)
      from (
        select ss.name,
               count(distinct ss.session_id)::int as s,
               avg(a.is_correct::int) * 100 as avg_pct
        from public.session_students ss
        join public.quiz_sessions qs on qs.id = ss.session_id
        left join public.answers a on a.session_student_id = ss.id
        where qs.class_id = p_class_id and qs.status = 'encerrada'
          and (p_subject_id is null or exists (
            select 1 from public.questions q
            join public.answers a2 on a2.question_id = q.id and a2.session_student_id = ss.id
            where q.subject_id = p_subject_id
          ))
        group by ss.name
      ) t
    ), '[]'::jsonb)
  );
end $$;

-- 5. Atualizar rpc_dashboard — students por nome, não por class_student_id
create or replace function public.rpc_dashboard()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Não autenticado.' using errcode = '42501'; end if;

  return jsonb_build_object(
    'counts', jsonb_build_object(
      'classes', (select count(*)::int from public.classes where teacher_id = v_uid),
      'quizzes', (select count(*)::int from public.quizzes where teacher_id = v_uid),
      'sessions_done', (
        select count(*)::int from public.quiz_sessions s
        join public.quizzes q on q.id = s.quiz_id
        where q.teacher_id = v_uid and s.status = 'encerrada'
      ),
      'students', (
        select count(distinct ss.name)::int
        from public.quiz_sessions s
        join public.quizzes q on q.id = s.quiz_id
        join public.session_students ss on ss.session_id = s.id
        where q.teacher_id = v_uid
      )
    ),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_id', t.sid, 'title', t.title, 'class_name', t.class_name,
        'date', t.d, 'participants', t.participants, 'avg_pct', round(t.avg_pct)
      ))
      from (
        select s.id as sid, q.title, c.name as class_name, s.ended_at as d,
               (select count(*) from public.session_students ss where ss.session_id = s.id) as participants,
               (select avg(a.is_correct::int) * 100 from public.answers a where a.session_id = s.id) as avg_pct
        from public.quiz_sessions s
        join public.quizzes q on q.id = s.quiz_id
        join public.classes c on c.id = s.class_id
        where q.teacher_id = v_uid and s.status = 'encerrada'
        order by s.ended_at desc nulls last
        limit 6
      ) t
    ), '[]'::jsonb),
    'attention', coalesce((
      select jsonb_agg(t)
      from (
        select coalesce(tp.name, q.subtopic, 'Sem tema') as topic,
               c.name as class_name,
               round(avg(a.is_correct::int) * 100) as pct,
               count(*)::int as n
        from public.answers a
        join public.quizzes qz on qz.id = a.quiz_id
        join public.classes c on c.id = a.class_id
        join public.questions q on q.id = a.question_id
        left join public.topics tp on tp.id = q.topic_id
        where qz.teacher_id = v_uid
        group by 1, 2
        having count(*) >= 5 and avg(a.is_correct::int) < 0.55
        order by avg(a.is_correct::int) asc
        limit 6
      ) t
    ), '[]'::jsonb)
  );
end $$;

-- 6. Atualizar rpc_session_diagnostics — remover class_student_id do output
create or replace function public.rpc_session_diagnostics(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_teacher uuid;
  s public.quiz_sessions%rowtype;
begin
  if v_uid is null then raise exception 'Não autenticado.' using errcode = '42501'; end if;

  select q.teacher_id into v_teacher
  from public.quiz_sessions s2 join public.quizzes q on q.id = s2.quiz_id
  where s2.id = p_session_id;

  if v_teacher is null then raise exception 'Sessão não encontrada.' using errcode = 'P0002'; end if;
  if v_teacher <> v_uid then raise exception 'Sem permissão nesta sessão.' using errcode = '42501'; end if;
  select * into s from public.quiz_sessions where id = p_session_id;

  return jsonb_build_object(
    'meta', jsonb_build_object(
      'session_id', s.id, 'title', (select title from public.quizzes where id = s.quiz_id),
      'class_name', (select name from public.classes where id = s.class_id),
      'date', coalesce(s.ended_at, s.created_at), 'status', s.status,
      'created_at', s.created_at, 'started_at', s.started_at, 'ended_at', s.ended_at,
      'room_code', s.room_code
    ),
    'participants', (select count(*)::int from public.session_students ss where ss.session_id = p_session_id),
    'overall_pct', round((select avg(a.is_correct::int) * 100 from public.answers a where a.session_id = p_session_id)),
    'correct', (select count(*)::int from public.answers a where a.session_id = p_session_id and a.is_correct),
    'wrong', (select count(*)::int from public.answers a where a.session_id = p_session_id and not a.is_correct and a.selected_index is not null),
    'unanswered', (select count(*)::int from public.answers a where a.session_id = p_session_id and a.selected_index is null),
    'avg_points', round((select avg(a.points_earned) from public.answers a where a.session_id = p_session_id)),
    'avg_time_s', round((select avg(a.time_ms) / 1000.0 from public.answers a where a.session_id = p_session_id and a.time_ms is not null), 1),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'pct', round(pct), 'n', n))
      from (
        select coalesce(tp.name, q.subtopic, 'Sem tema') as label,
               avg(a.is_correct::int) * 100 as pct, count(*)::int as n
        from public.answers a
        join public.questions q on q.id = a.question_id
        left join public.topics tp on tp.id = q.topic_id
        where a.session_id = p_session_id
        group by 1
        order by pct asc
      ) t
    ), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'question_id', qid, 'position', pos, 'statement', statement,
        'difficulty', difficulty, 'topic', topic,
        'pct', round(pct), 'n', n, 'options', opts,
        'options_text', opts_text,
        'correct_index', correct_index
      ))
      from (
        select q.id as qid, qq.position as pos, q.statement, q.difficulty,
               coalesce(tp.name, q.subtopic, 'Sem tema') as topic,
               q.correct_index,
               coalesce((select avg(a.is_correct::int) * 100 from public.answers a
                         where a.session_id = p_session_id and a.question_id = q.id), 0) as pct,
               (select count(*)::int from public.answers a
                where a.session_id = p_session_id and a.question_id = q.id) as n,
               coalesce((
                 select jsonb_agg(jsonb_build_object('index', bucket, 'count', cnt))
                 from (
                   select a.selected_index as bucket, count(*)::int as cnt
                   from public.answers a
                   where a.session_id = p_session_id and a.question_id = q.id
                   group by a.selected_index
                   order by bucket nulls last
                 ) b
               ), '[]'::jsonb) as opts,
               (select jsonb_agg(value order by ord) from jsonb_array_elements_text(q.options) with ordinality as t(value, ord)) as opts_text
        from public.quiz_questions qq
        join public.questions q on q.id = qq.question_id
        left join public.topics tp on tp.id = q.topic_id
        where qq.quiz_id = s.quiz_id
        order by pct asc
      ) t
    ), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', t.sid, 'name', t.name, 'points', t.points,
        'correct', t.correct, 'wrong', t.wrong, 'unanswered', t.unanswered,
        'avg_time_s', t.avg_time
      ) order by t.points desc)
      from (
        select ss.id as sid, ss.name,
               coalesce(sum(a.points_earned), 0) as points,
               count(a.id) filter (where a.is_correct)::int as correct,
               count(a.id) filter (where not a.is_correct and a.selected_index is not null)::int as wrong,
               count(a.id) filter (where a.selected_index is null)::int as unanswered,
               round((avg(a.time_ms) filter (where a.time_ms is not null)) / 1000.0, 1) as avg_time
        from public.session_students ss
        left join public.answers a on a.session_student_id = ss.id
        where ss.session_id = p_session_id
        group by ss.id, ss.name
      ) t
    ), '[]'::jsonb)
  );
end $$;

-- 7. Remover rpc_student_diagnostics (diagnóstico individual não existe mais)
drop function if exists public.rpc_student_diagnostics(uuid);

-- 8. Criar rpc_delete_class — deleta turma com cascade
create or replace function public.rpc_delete_class(p_class_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c public.classes%rowtype;
begin
  if v_uid is null then raise exception 'Não autenticado.' using errcode = '42501'; end if;
  select * into c from public.classes where id = p_class_id;
  if not found then raise exception 'Turma não encontrada.' using errcode = 'P0002'; end if;
  if c.teacher_id <> v_uid then raise exception 'Sem permissão.' using errcode = '42501'; end if;

  delete from public.classes where id = p_class_id;
end $$;

-- 9. Atualizar grants
revoke execute on function public.rpc_student_diagnostics(uuid) from public, anon, authenticated;

grant execute on function public.rpc_class_diagnostics(uuid, uuid) to authenticated;
grant execute on function public.rpc_delete_class(uuid) to authenticated;

-- 10. Backup: seed subjects caso não existam (garantir que rpc_class_diagnostics funcione com subject filter)
-- (nada a fazer, subjects já existem via 0004_seed.sql)
