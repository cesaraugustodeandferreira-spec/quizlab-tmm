-- QuizLab · 0003 · Funções RPC (jogo ao vivo + diagnósticos)

create or replace function public.assert_session_host(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_teacher uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  select q.teacher_id into v_teacher
  from public.quiz_sessions s
  join public.quizzes q on q.id = s.quiz_id
  where s.id = p_session_id;
  if v_teacher is null then
    raise exception 'Sessão não encontrada.' using errcode = 'P0002';
  end if;
  if v_teacher <> auth.uid() then
    raise exception 'Você não tem permissão nesta sessão.' using errcode = '42501';
  end if;
end $$;

create or replace function public.join_session(p_room_code text, p_display_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.quiz_sessions%rowtype;
  v_name text := btrim(coalesce(p_display_name, ''));
  cs public.class_students%rowtype;
  st public.session_students%rowtype;
  v_total integer;
begin
  if length(v_name) < 2 or length(v_name) > 40 then
    raise exception 'Informe um nome com entre 2 e 40 caracteres.' using errcode = 'P0001';
  end if;

  select * into s from public.quiz_sessions
  where upper(btrim(p_room_code)) = room_code and status = 'aguardando';

  if not found then
    begin
      if exists (select 1 from public.quiz_sessions where upper(btrim(p_room_code)) = room_code) then
        raise exception 'Esta sala já foi iniciada ou encerrada.' using errcode = 'P0001';
      end if;
    end;
    raise exception 'Não foi possível entrar na sala. Verifique o código.' using errcode = 'P0001';
  end if;

  select * into cs from public.class_students
  where class_id = s.class_id and lower(btrim(name)) = lower(v_name);

  if not found then
    insert into public.class_students (class_id, name)
    values (s.class_id, initcap(v_name))
    on conflict do nothing
    returning * into cs;

    if cs.id is null then
      select * into cs from public.class_students
      where class_id = s.class_id and lower(btrim(name)) = lower(v_name);
    end if;
  end if;

  select * into st from public.session_students
  where session_id = s.id and lower(btrim(name)) = lower(cs.name);

  if not found then
    insert into public.session_students (session_id, class_student_id, name)
    values (s.id, cs.id, cs.name)
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

create or replace function public.get_player_view(p_room_code text, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.quiz_sessions%rowtype;
  st public.session_students%rowtype;
  v_token uuid;
  v_qid uuid;
  v_q public.questions%rowtype;
  v_total integer;
  v_result jsonb;
  base jsonb;
begin
  begin
    v_token := p_token::uuid;
  exception when others then
    raise exception 'Sessão inválida.' using errcode = 'P0001';
  end;

  select * into s from public.quiz_sessions where upper(btrim(p_room_code)) = room_code;
  if not found then
    raise exception 'Sala não encontrada.' using errcode = 'P0002';
  end if;

  select * into st from public.session_students
  where token = v_token and session_id = s.id;
  if not found then
    raise exception 'Você não está nesta sala.' using errcode = 'P0001';
  end if;

  select count(*)::int into v_total from public.quiz_questions where quiz_id = s.quiz_id;

  base := jsonb_build_object(
    'status', s.status,
    'current_index', s.current_index,
    'total_questions', v_total,
    'server_now', now(),
    'show_ranking', s.show_ranking,
    'show_score', s.show_score,
    'show_correct_answers', s.show_correct_answers
  );

  if s.status = 'em_andamento' and s.current_index between 1 and v_total then
    select q.* into v_q
    from public.quiz_questions qq
    join public.questions q on q.id = qq.question_id
    where qq.quiz_id = s.quiz_id and qq.position = s.current_index;

    v_qid := v_q.id;

    base := base || jsonb_build_object(
      'question', jsonb_build_object(
        'id', v_q.id,
        'label', s.current_index,
        'statement', v_q.statement,
        'image_url', v_q.image_url,
        'options', v_q.options,
        'seconds', s.question_seconds,
        'started_at', s.question_started_at
      ),
      'answered', exists (
        select 1 from public.answers a
        where a.session_student_id = st.id and a.question_id = v_qid
      ),
      'totals', (
        select jsonb_build_object(
          'points', coalesce(sum(a.points_earned), 0),
          'correct', count(*) filter (where a.is_correct)
        )
        from public.answers a where a.session_student_id = st.id
      )
    );

    if s.reveal_current then
      base := base || jsonb_build_object(
        'reveal_data', jsonb_build_object(
          'correct_index', v_q.correct_index,
          'options_text', v_q.options,
          'counts', (
            select coalesce(jsonb_agg(jsonb_build_object('index', coalesce(bucket, -1), 'count', cnt)) filter (where true), '[]'::jsonb)
            from (
              select a.selected_index as bucket, count(*)::int as cnt
              from public.answers a
              where a.session_id = s.id and a.question_id = v_qid
              group by a.selected_index
            ) x
          ),
          'my', (
            select to_jsonb(jsonb_build_object(
              'selected_index', a.selected_index,
              'is_correct', a.is_correct,
              'points_earned', a.points_earned
            ))
            from public.answers a
            where a.session_student_id = st.id and a.question_id = v_qid
          )
        )
      );
    end if;
  end if;

  if s.status = 'encerrada' then
    v_result := (
      select jsonb_build_object(
        'correct', count(*) filter (where a.is_correct),
        'wrong', count(*) filter (where not a.is_correct and a.selected_index is not null),
        'unanswered', count(*) filter (where a.selected_index is null),
        'total_questions', v_total,
        'avg_time_s', round(avg(a.time_ms) filter (where a.time_ms is not null) / 1000.0, 1),
        'points', coalesce(sum(a.points_earned), 0),
        'review', case when s.show_correct_answers then (
          select coalesce(jsonb_agg(jsonb_build_object(
            'position', qq.position,
            'statement', q.statement,
            'your_index', ya.selected_index,
            'correct_index', q.correct_index,
            'is_correct', coalesce(ya.is_correct, false),
            'options_text', (select jsonb_agg(value order by ord) from jsonb_array_elements_text(q.options) with ordinality as t(value, ord))
          ) order by qq.position), '[]'::jsonb)
          from public.quiz_questions qq
          join public.questions q on q.id = qq.question_id
          left join public.answers ya
            on ya.question_id = qq.question_id and ya.session_student_id = st.id
          where qq.quiz_id = s.quiz_id
        ) else null end,
        'ranking', case when s.show_ranking then (
          select coalesce(jsonb_agg(x order by x.points desc), '[]'::jsonb)
          from (
            select ss2.name, sum(a2.points_earned)::numeric as points,
                   count(*) filter (where a2.is_correct)::int as correct,
                   (ss2.id = st.id) as is_me
            from public.session_students ss2
            left join public.answers a2 on a2.session_student_id = ss2.id
            where ss2.session_id = s.id
            group by ss2.id, ss2.name
            order by points desc
            limit 10
          ) x
        ) else null end
      )
      from public.answers a
      where a.session_student_id = st.id
    );

    if v_result is null then
      v_result := jsonb_build_object(
        'correct', 0, 'wrong', 0, 'unanswered', 0, 'total_questions', v_total,
        'avg_time_s', null, 'points', 0,
        'review', case when s.show_correct_answers then '[]'::jsonb else null end,
        'ranking', case when s.show_ranking then '[]'::jsonb else null end
      );
    end if;

    base := base || jsonb_build_object('result', v_result);
  end if;

  return base;
end $$;

create or replace function public.submit_answer(
  p_room_code text,
  p_token text,
  p_question_id uuid,
  p_selected_index smallint,
  p_time_ms integer
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.quiz_sessions%rowtype;
  st public.session_students%rowtype;
  v_token uuid;
  v_q public.questions%rowtype;
  v_deadline timestamptz;
  v_correct boolean := false;
  v_points numeric := 0;
begin
  begin
    v_token := p_token::uuid;
  exception when others then
    raise exception 'Sessão inválida.' using errcode = 'P0001';
  end;

  select * into s from public.quiz_sessions
  where upper(btrim(p_room_code)) = room_code and status = 'em_andamento';

  if not found or s.reveal_current then
    return jsonb_build_object('accepted', false, 'reason', 'closed');
  end if;

  select * into st from public.session_students where token = v_token and session_id = s.id;
  if not found then
    raise exception 'Você não está nesta sala.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.answers a
    where a.session_student_id = st.id and a.question_id = p_question_id
  ) then
    return jsonb_build_object('accepted', false, 'reason', 'already');
  end if;

  select q.* into v_q
  from public.quiz_questions qq
  join public.questions q on q.id = qq.question_id
  where qq.quiz_id = s.quiz_id and qq.position = s.current_index and q.id = p_question_id;

  if not found then
    raise exception 'Questão inválida para esta rodada.' using errcode = 'P0001';
  end if;

  if p_selected_index is null or p_selected_index < 0
     or p_selected_index >= jsonb_array_length(v_q.options) then
    raise exception 'Alternativa inválida.' using errcode = '22023';
  end if;

  v_deadline := s.question_started_at + make_interval(secs => s.question_seconds);

  if now() > v_deadline then
    insert into public.answers
      (session_id, session_student_id, quiz_id, class_id, question_id, time_ms)
    values (s.id, st.id, s.quiz_id, s.class_id, v_q.id, greatest(0, coalesce(p_time_ms, 0)));
    return jsonb_build_object('accepted', true, 'reason', 'timeout');
  end if;

  v_correct := (p_selected_index = v_q.correct_index);
  if v_correct then
    v_points := round(1000 * (
      0.5 + 0.5 * greatest(0, extract(epoch from (v_deadline - now())) / greatest(s.question_seconds, 1))
    ));
  end if;

  insert into public.answers
    (session_id, session_student_id, quiz_id, class_id, question_id,
     selected_index, is_correct, points_earned, time_ms)
  values
    (s.id, st.id, s.quiz_id, s.class_id, v_q.id,
     p_selected_index, v_correct, v_points, greatest(0, coalesce(p_time_ms, 0)));

  return jsonb_build_object('accepted', true, 'reason', 'ok');
end $$;

create or replace function public.host_start_quiz(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  s public.quiz_sessions%rowtype;
  v_total integer;
  v_seconds smallint;
begin
  perform public.assert_session_host(p_session_id);
  select * into s from public.quiz_sessions where id = p_session_id;

  if s.status <> 'aguardando' then
    raise exception 'Esta sala já foi iniciada.' using errcode = 'P0001';
  end if;

  select count(*)::int into v_total from public.quiz_questions where quiz_id = s.quiz_id;
  if v_total = 0 then
    raise exception 'Adicione questões ao quiz antes de iniciar.' using errcode = 'P0001';
  end if;

  select coalesce(q.time_override_seconds, z.default_time_seconds) into v_seconds
  from public.quiz_questions qq
  join public.questions q on q.id = qq.question_id
  join public.quizzes z on z.id = qq.quiz_id
  where qq.quiz_id = s.quiz_id and qq.position = 1;

  update public.quiz_sessions
  set status = 'em_andamento',
      current_index = 1,
      question_started_at = now(),
      question_seconds = v_seconds,
      reveal_current = false,
      started_at = coalesce(started_at, now())
  where id = p_session_id;
end $$;

create or replace function public.host_record_missing(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  s public.quiz_sessions%rowtype;
  v_qid uuid;
begin
  select * into s from public.quiz_sessions where id = p_session_id;
  if s.status <> 'em_andamento' or s.current_index < 1 then return; end if;

  select qq.question_id into v_qid
  from public.quiz_questions qq
  where qq.quiz_id = s.quiz_id and qq.position = s.current_index;

  insert into public.answers
    (session_id, session_student_id, quiz_id, class_id, question_id)
  select s.id, st.id, s.quiz_id, s.class_id, v_qid
  from public.session_students st
  where st.session_id = p_session_id
    and not exists (
      select 1 from public.answers a
      where a.session_student_id = st.id and a.question_id = v_qid
    );
end $$;

create or replace function public.host_close_question(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.quiz_sessions%rowtype;
  v_q public.questions%rowtype;
begin
  perform public.assert_session_host(p_session_id);
  select * into s from public.quiz_sessions where id = p_session_id;

  if s.status <> 'em_andamento' then
    raise exception 'Nenhuma questão aberta.' using errcode = 'P0001';
  end if;

  perform public.host_record_missing(p_session_id);

  select q.* into v_q
  from public.quiz_questions qq
  join public.questions q on q.id = qq.question_id
  where qq.quiz_id = s.quiz_id and qq.position = s.current_index;

  update public.quiz_sessions set reveal_current = true where id = p_session_id;

  return jsonb_build_object(
    'current_index', s.current_index,
    'correct_index', v_q.correct_index,
    'counts', (
      select coalesce(jsonb_agg(jsonb_build_object('index', coalesce(bucket, -1), 'count', cnt)), '[]'::jsonb)
      from (
        select a.selected_index as bucket, count(*)::int as cnt
        from public.answers a
        where a.session_id = p_session_id and a.question_id = v_q.id
        group by a.selected_index
      ) x
    )
  );
end $$;

create or replace function public.host_advance(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.quiz_sessions%rowtype;
  v_next smallint;
  v_total integer;
  v_seconds smallint;
begin
  perform public.assert_session_host(p_session_id);
  select * into s from public.quiz_sessions where id = p_session_id;

  if s.status <> 'em_andamento' then
    raise exception 'O quiz não está em andamento.' using errcode = 'P0001';
  end if;

  perform public.host_record_missing(p_session_id);

  select count(*)::int into v_total from public.quiz_questions where quiz_id = s.quiz_id;
  v_next := s.current_index + 1;

  if v_next > v_total then
    update public.session_students st
    set total_points = agg.p, correct_count = agg.c
    from (
      select session_student_id,
             sum(points_earned) as p,
             count(*) filter (where is_correct) as c
      from public.answers
      where session_id = p_session_id
      group by session_student_id
    ) agg
    where agg.session_student_id = st.id;

    update public.quiz_sessions
    set status = 'encerrada', ended_at = now()
    where id = p_session_id;

    return jsonb_build_object('finished', true);
  end if;

  select coalesce(q.time_override_seconds, z.default_time_seconds) into v_seconds
  from public.quiz_questions qq
  join public.questions q on q.id = qq.question_id
  join public.quizzes z on z.id = qq.quiz_id
  where qq.quiz_id = s.quiz_id and qq.position = v_next;

  update public.quiz_sessions
  set current_index = v_next,
      question_started_at = now(),
      question_seconds = v_seconds,
      reveal_current = false
  where id = p_session_id;

  return jsonb_build_object('finished', false, 'current_index', v_next);
end $$;

create or replace function public.host_cancel_room(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_session_host(p_session_id);
  update public.quiz_sessions
  set status = 'encerrada', ended_at = now()
  where id = p_session_id and status = 'aguardando';
end $$;

create or replace function public.ensure_topic(p_subject_id uuid, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if v_name = '' then return null; end if;
  if not exists (select 1 from public.subjects where id = p_subject_id) then
    raise exception 'Disciplina inválida.' using errcode = 'P0001';
  end if;

  select id into v_id from public.topics
  where subject_id = p_subject_id and lower(btrim(name)) = lower(v_name);

  if found then return v_id; end if;

  insert into public.topics (subject_id, name) values (p_subject_id, v_name)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.set_quiz_question_order(p_quiz_id uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_teacher uuid;
  i integer;
begin
  if auth.uid() is null then raise exception 'Não autenticado.' using errcode = '42501'; end if;
  select teacher_id into v_teacher from public.quizzes where id = p_quiz_id;
  if v_teacher is null then raise exception 'Quiz não encontrado.' using errcode = 'P0002'; end if;
  if v_teacher <> auth.uid() then raise exception 'Sem permissão neste quiz.' using errcode = '42501'; end if;

  if coalesce(array_length(p_ids, 1), 0)
     <> (select count(*) from public.quiz_questions where quiz_id = p_quiz_id) then
    raise exception 'Lista de questões inconsistente.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.quiz_questions qq
    where qq.quiz_id = p_quiz_id and not (qq.question_id = any(p_ids))
  ) then
    raise exception 'Lista de questões inconsistente.' using errcode = '22023';
  end if;

  for i in 1..coalesce(array_length(p_ids, 1), 0) loop
    update public.quiz_questions
    set position = i
    where quiz_id = p_quiz_id and question_id = p_ids[i];
  end loop;
end $$;

create or replace function public.duplicate_quiz(p_quiz_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  src public.quizzes%rowtype;
  v_new uuid;
  m record;
  v_newq uuid;
begin
  if v_uid is null then raise exception 'Não autenticado.' using errcode = '42501'; end if;
  select * into src from public.quizzes where id = p_quiz_id;
  if not found then raise exception 'Quiz não encontrado.' using errcode = 'P0002'; end if;
  if src.teacher_id <> v_uid and not src.is_shared then
    raise exception 'Este quiz não está disponível na biblioteca.' using errcode = '42501';
  end if;

  insert into public.quizzes
    (teacher_id, title, description, subject_id, topic_id, status,
     default_time_seconds, show_ranking, show_score, show_correct_answers,
     is_shared, source_quiz_id)
  values
    (v_uid,
     case when src.title like '% (cópia)' then src.title else src.title || ' (cópia)' end,
     src.description, src.subject_id, src.topic_id, src.status,
     src.default_time_seconds, src.show_ranking, src.show_score, src.show_correct_answers,
     false, src.id)
  returning id into v_new;

  for m in
    select qq.position, q.*
    from public.quiz_questions qq
    join public.questions q on q.id = qq.question_id
    where qq.quiz_id = p_quiz_id
    order by qq.position
  loop
    insert into public.questions
      (teacher_id, subject_id, topic_id, subtopic, statement, options,
       correct_index, image_url, difficulty, time_override_seconds)
    values
      (v_uid, m.subject_id, m.topic_id, m.subtopic, m.statement, m.options,
       m.correct_index, m.image_url, m.difficulty, m.time_override_seconds)
    returning id into v_newq;

    insert into public.quiz_questions (quiz_id, question_id, position)
    values (v_new, v_newq, m.position);
  end loop;

  return v_new;
end $$;

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
        select count(distinct ss.class_student_id)::int
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
      select jsonb_agg(t order by t.pct asc)
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

create or replace function public.rpc_class_diagnostics(p_class_id uuid)
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

  select exists(select 1 from public.answers a where a.class_id = p_class_id) into v_any;

  return jsonb_build_object(
    'class', jsonb_build_object('id', c.id, 'name', c.name, 'grade_year', c.grade_year),
    'overall_pct', case when v_any then round((select avg(a.is_correct::int) * 100 from public.answers a where a.class_id = p_class_id)) end,
    'correct', (select count(*)::int from public.answers a where a.class_id = p_class_id and a.is_correct),
    'wrong', (select count(*)::int from public.answers a where a.class_id = p_class_id and not a.is_correct and a.selected_index is not null),
    'unanswered', (select count(*)::int from public.answers a where a.class_id = p_class_id and a.selected_index is null),
    'sessions_count', (
      select count(*)::int from public.quiz_sessions s
      where s.class_id = p_class_id and s.status = 'encerrada'
    ),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object('label', t.label, 'pct', round(t.pct), 'n', t.n) order by t.pct asc)
      from (
        select coalesce(tp.name, q.subtopic, 'Sem tema') as label,
               avg(a.is_correct::int) * 100 as pct,
               count(*)::int as n
        from public.answers a
        join public.questions q on q.id = a.question_id
        left join public.topics tp on tp.id = q.topic_id
        where a.class_id = p_class_id
        group by 1
      ) t
    ), '[]'::jsonb),
    'hardest', coalesce((
      select jsonb_agg(jsonb_build_object(
        'question_id', t.qid, 'statement', t.statement,
        'difficulty', t.difficulty, 'pct', round(t.pct), 'n', t.n
      ) order by t.pct asc)
      from (
        select q.id as qid, q.statement, q.difficulty,
               avg(a.is_correct::int) * 100 as pct,
               count(*)::int as n
        from public.answers a
        join public.questions q on q.id = a.question_id
        where a.class_id = p_class_id
        group by q.id, q.statement, q.difficulty
      ) t
      where t.n > 0
      order by t.pct asc
      limit 5
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
        'student_id', t.sid, 'name', t.name, 'sessions', t.s, 'avg_pct', round(t.avg_pct)
      ) order by t.avg_pct asc nulls last)
      from (
        select cs.id as sid, cs.name,
               count(distinct ss.session_id)::int as s,
               avg(a.is_correct::int) * 100 as avg_pct
        from public.class_students cs
        left join public.session_students ss on ss.class_student_id = cs.id
        left join public.answers a on a.session_student_id = ss.id
        where cs.class_id = p_class_id
        group by cs.id, cs.name
      ) t
    ), '[]'::jsonb)
  );
end $$;

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
      select jsonb_agg(jsonb_build_object('label', t.label, 'pct', round(t.pct), 'n', t.n) order by t.pct asc)
      from (
        select coalesce(tp.name, q.subtopic, 'Sem tema') as label,
               avg(a.is_correct::int) * 100 as pct, count(*)::int as n
        from public.answers a
        join public.questions q on q.id = a.question_id
        left join public.topics tp on tp.id = q.topic_id
        where a.session_id = p_session_id
        group by 1
      ) t
    ), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'question_id', t.qid, 'position', t.pos, 'statement', t.statement,
        'difficulty', t.difficulty, 'topic', t.topic,
        'pct', round(t.pct), 'n', t.n, 'options', t.opts,
        'options_text', t.opts_text,
        'correct_index', t.correct_index
      ) order by t.pct asc)
      from (
        select q.id as qid, qq.position as pos, q.statement, q.difficulty,
               coalesce(tp.name, q.subtopic, 'Sem tema') as topic,
               q.correct_index,
               coalesce((select avg(a.is_correct::int) * 100 from public.answers a
                         where a.session_id = p_session_id and a.question_id = q.id), 0) as pct,
               (select count(*)::int from public.answers a
                where a.session_id = p_session_id and a.question_id = q.id) as n,
               coalesce((
                 select jsonb_agg(jsonb_build_object('index', b.bucket, 'count', b.cnt) order by b.bucket nulls last)
                 from (
                   select a.selected_index as bucket, count(*)::int as cnt
                   from public.answers a
                   where a.session_id = p_session_id and a.question_id = q.id
                   group by a.selected_index
                 ) b
               ), '[]'::jsonb) as opts,
               (select jsonb_agg(value order by ord) from jsonb_array_elements_text(q.options) with ordinality as t(value, ord)) as opts_text
        from public.quiz_questions qq
        join public.questions q on q.id = qq.question_id
        left join public.topics tp on tp.id = q.topic_id
        where qq.quiz_id = s.quiz_id
      ) t
    ), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', t.sid, 'name', t.name, 'class_student_id', t.class_student_id, 'points', t.points,
        'correct', t.correct, 'wrong', t.wrong, 'unanswered', t.unanswered,
        'avg_time_s', t.avg_time
      ) order by t.points desc)
      from (
        select ss.id as sid, ss.name, ss.class_student_id,
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

create or replace function public.rpc_student_diagnostics(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  cs public.class_students%rowtype;
  c public.classes%rowtype;
begin
  if v_uid is null then raise exception 'Não autenticado.' using errcode = '42501'; end if;
  select * into cs from public.class_students where id = p_student_id;
  if not found then raise exception 'Aluno não encontrado.' using errcode = 'P0002'; end if;
  select * into c from public.classes where id = cs.class_id;
  if c.teacher_id <> v_uid then raise exception 'Sem permissão.' using errcode = '42501'; end if;

  return jsonb_build_object(
    'name', cs.name,
    'class_name', c.name,
    'class_id', c.id,
    'overall_pct', round((
      select avg(a.is_correct::int) * 100
      from public.answers a
      join public.session_students ss on ss.id = a.session_student_id
      where ss.class_student_id = p_student_id
    )),
    'correct', (
      select count(*)::int from public.answers a
      join public.session_students ss on ss.id = a.session_student_id
      where ss.class_student_id = p_student_id and a.is_correct
    ),
    'wrong', (
      select count(*)::int from public.answers a
      join public.session_students ss on ss.id = a.session_student_id
      where ss.class_student_id = p_student_id and not a.is_correct and a.selected_index is not null
    ),
    'unanswered', (
      select count(*)::int from public.answers a
      join public.session_students ss on ss.id = a.session_student_id
      where ss.class_student_id = p_student_id and a.selected_index is null
    ),
    'sessions_count', (
      select count(distinct ss.session_id)::int
      from public.session_students ss where ss.class_student_id = p_student_id
    ),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object('label', t.label, 'pct', round(t.pct), 'n', t.n) order by t.pct asc)
      from (
        select coalesce(tp.name, q.subtopic, 'Sem tema') as label,
               avg(a.is_correct::int) * 100 as pct, count(*)::int as n
        from public.answers a
        join public.session_students ss on ss.id = a.session_student_id
        join public.questions q on q.id = a.question_id
        left join public.topics tp on tp.id = q.topic_id
        where ss.class_student_id = p_student_id
        group by 1
      ) t
    ), '[]'::jsonb),
    'evolution', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_id', t.sid, 'title', t.title, 'date', t.d, 'pct', round(t.pct)
      ) order by t.d asc)
      from (
        select s.id as sid, q.title, coalesce(s.ended_at, s.created_at) as d,
               avg(a.is_correct::int) * 100 as pct
        from public.session_students ss
        join public.quiz_sessions s on s.id = ss.session_id
        join public.quizzes q on q.id = s.quiz_id
        left join public.answers a on a.session_student_id = ss.id
        where ss.class_student_id = p_student_id
        group by s.id, q.title, d
      ) t
    ), '[]'::jsonb),
    'missed', coalesce((
      select jsonb_agg(jsonb_build_object(
        'question_id', t.qid, 'statement', t.statement, 'topic', t.topic,
        'pct', round(t.pct), 'n', t.n
      ) order by t.pct asc)
      from (
        select q.id as qid, q.statement,
               coalesce(tp.name, q.subtopic, 'Sem tema') as topic,
               avg(a.is_correct::int) * 100 as pct, count(*)::int as n
        from public.answers a
        join public.session_students ss on ss.id = a.session_student_id
        join public.questions q on q.id = a.question_id
        left join public.topics tp on tp.id = q.topic_id
        where ss.class_student_id = p_student_id
        group by q.id, q.statement, 3
      ) t
      where t.n > 0
      order by t.pct asc
      limit 8
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.rpc_library()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Não autenticado.' using errcode = '42501'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id,
      'title', q.title,
      'description', q.description,
      'subject', s.name,
      'default_time_seconds', q.default_time_seconds,
      'created_at', q.created_at,
      'author', p.full_name,
      'question_count', (
        select count(*)::int from public.quiz_questions qq where qq.quiz_id = q.id
      )
    ) order by q.created_at desc)
    from public.quizzes q
    join public.subjects s on s.id = q.subject_id
    left join public.profiles p on p.id = q.teacher_id
    where q.is_shared and q.status = 'publicado' and q.teacher_id <> v_uid
  ), '[]'::jsonb);
end $$;

revoke execute on function public.assert_session_host(uuid) from public, anon;
revoke execute on function public.host_start_quiz(uuid) from public, anon;
revoke execute on function public.host_close_question(uuid) from public, anon;
revoke execute on function public.host_advance(uuid) from public, anon;
revoke execute on function public.host_cancel_room(uuid) from public, anon;
revoke execute on function public.ensure_topic(uuid, text) from public, anon;
revoke execute on function public.set_quiz_question_order(uuid, uuid[]) from public, anon;
revoke execute on function public.duplicate_quiz(uuid) from public, anon;
revoke execute on function public.rpc_dashboard() from public, anon;
revoke execute on function public.rpc_class_diagnostics(uuid) from public, anon;
revoke execute on function public.rpc_session_diagnostics(uuid) from public, anon;
revoke execute on function public.rpc_student_diagnostics(uuid) from public, anon;

grant execute on function public.assert_session_host(uuid) to authenticated;
grant execute on function public.host_start_quiz(uuid) to authenticated;
grant execute on function public.host_close_question(uuid) to authenticated;
grant execute on function public.host_advance(uuid) to authenticated;
grant execute on function public.host_cancel_room(uuid) to authenticated;
grant execute on function public.ensure_topic(uuid, text) to authenticated;
grant execute on function public.set_quiz_question_order(uuid, uuid[]) to authenticated;
grant execute on function public.duplicate_quiz(uuid) to authenticated;
grant execute on function public.rpc_dashboard() to authenticated;
grant execute on function public.rpc_class_diagnostics(uuid) to authenticated;
grant execute on function public.rpc_session_diagnostics(uuid) to authenticated;
grant execute on function public.rpc_student_diagnostics(uuid) to authenticated;
grant execute on function public.rpc_library() to authenticated;

grant execute on function public.join_session(text, text) to anon, authenticated;
grant execute on function public.get_player_view(text, text) to anon, authenticated;
grant execute on function public.submit_answer(text, text, uuid, smallint, integer) to anon, authenticated;
