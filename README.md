# QuizLab

> **Quizzes que mostram muito mais do que uma nota.**

Plataforma web de quizzes em tempo real para uso interno escolar, inspirada na experiência do
Kahoot, com um diferencial central: **diagnóstico pedagógico individual e por turma** — o professor
descobre rapidamente *quais alunos* estão com dificuldade e *quais conteúdos/questões* têm maior
índice de erro.

- **Frontend:** Next.js (App Router) + React + TypeScript + Tailwind CSS + Tabler Icons
- **Backend/Banco:** Supabase — PostgreSQL, Supabase Auth e Supabase Realtime (WebSocket)
- **Tipografia:** Fraunces (títulos e números) · Inter (interface)
- **Tema escuro profissional:** fundo `#0A0A0C`, superfícies `#16171B`, destaque azul `#2563EB`

---

## 1. Rodando localmente

```bash
# dentro da pasta quizlab/
npm install

# configure as variáveis de ambiente (passo 2)
cp .env.local.example .env.local   # ou crie manualmente

npm run dev
```

Abra `http://localhost:3000`.

| Variável                        | Onde obter                                        |
| ------------------------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → Project Settings → API → Project URL   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon/public   |

> Apenas a **anon key** vai para o cliente. Nenhuma service_role key é usada no frontend.
> Toda ação sensível é validada no banco por RLS + funções `security definer`.

---

## 2. Configuração do Supabase (passo a passo)

### 2.1 Criar o projeto

1. Crie uma conta/projeto em [supabase.com](https://supabase.com) (região mais próxima).
2. Copie URL e anon key para o `.env.local`.

### 2.2 Aplicar as migrations SQL

As migrations estão em ordem em `supabase/migrations/`:

| Arquivo               | Conteúdo                                                        |
| --------------------- | --------------------------------------------------------------- |
| `0001_schema.sql`     | Tabelas, enums, índices, triggers (códigos de sala/turma, perfil automático), publicação Realtime |
| `0002_rls.sql`        | Row Level Security completa                                     |
| `0003_functions.sql`  | Funções RPC do jogo ao vivo e dos diagnósticos (`security definer`) |
| `0004_seed.sql`       | Catálogo inicial de disciplinas                                  |

**Opção A — SQL Editor (mais rápido):**
Supabase Dashboard → **SQL Editor** → cole o conteúdo de cada arquivo **em ordem** (0001 → 0004) e execute.

**Opção B — Supabase CLI:**

```bash
supabase link --project-ref <seu-ref>
supabase db push
```

> Se o passo de *Realtime* falhar por permissão, habilite manualmente em
> **Database → Replication → supabase_realtime**: adicione as tabelas
> `quiz_sessions`, `session_students` e `answers`. Isso é necessário para o placar ao vivo.

### 2.3 Autenticação (Auth)

Em **Authentication → Sign In / Up**:

- Provider **Email** habilitado (padrão).
- Para uso interno escolar recomenda-se desativar a confirmação de e-mail
  (**Authentication → Providers → Email → "Confirm email" off**) — assim o professor cria a conta
  e entra direto. Se deixar ativado, o app já mostra o aviso de "verifique seu e-mail".

### 2.4 URLs de recuperação de senha

Em **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:3000` (ou seu domínio).
- **Redirect URLs:** adicione `http://localhost:3000/redefinir-senha` (e o equivalente em produção).

---

## 3. Fluxo de teste ponta a ponta

1. **Professor cria conta** → `/registrar` → login automático ou confirmação por e-mail.
2. **Cria turma** → `/professor/turmas` → "Nova turma" (o código de acesso da turma é gerado sozinho).
3. **Cria quiz** → `/professor/quizzes` → "Novo quiz" cria um rascunho e abre o editor:
   preencha nome/disciplina, crie questões novas ou use **"Puxar do Banco de Questões"**,
   reordene/duplique/exclua questões e clique em **Publicar quiz**.
4. **Inicia sala** → botão "Iniciar" → escolha a turma → abre a sala TV com o código de 6 caracteres.
5. **Aluno entra** → em outro dispositivo (celular): `/entrar` → digita o código nos blocos +
   nome → "Entrar na sala". O nome é casado automaticamente com a lista da turma (ou criado nela).
6. **Professor inicia o quiz** → todos recebem a questão ao mesmo tempo via Realtime,
   com temporizador sincronizado pelo relógio do servidor.
7. **Aluno responde** → a resposta grava `is_correct` **e** `points_earned`
   separados (pontuação = até 1000 pts com bônus de velocidade; diagnóstico usa só o acerto).
   Tempo esgotado sem resposta registra "não respondida".
8. **Encerrar questão** revela a distribuição (professor) e o feedback (aluno, se configurado);
   **Próxima questão / Finalizar** avança; ao finalizar, totais e ranking são calculados.
9. **Aluno vê o resultado** conforme as configurações do quiz (nota, gabarito, top jogadores).
10. **Professor vê o resultado** → sala finalizada → "Ver diagnóstico completo"
    (`/professor/diagnosticos/[sessão]`): aproveitamento geral, por tema, questões mais difíceis
    com distribuição por alternativa, ranking, linha do tempo e exportação CSV.
11. **Minhas Turmas** → abrir a turma: aba **Diagnóstico** (agregado da turma), aba **Histórico**
    (filtros por quiz/período + CSV) e aba **Alunos** (clique num aluno para o diagnóstico individual).
12. **Diagnósticos** (sidebar) → fluxo em passos: turma → quizzes aplicados → diagnóstico da aplicação.

---

## 4. Estrutura de pastas

```
quizlab/
├── supabase/migrations/
│   ├── 0001_schema.sql          # tabelas + triggers + realtime
│   ├── 0002_rls.sql             # políticas RLS
│   ├── 0003_functions.sql       # RPCs do jogo + diagnósticos
│   └── 0004_seed.sql            # disciplinas iniciais
├── src/
│   ├── proxy.ts                 # proteção de rotas /professor/*
│   ├── config/
│   │   └── brand.ts             # nome, slogan, cores das alternativas (centralizado)
│   ├── types/index.ts           # tipos de domínio + DTOs dos diagnósticos
│   ├── lib/
│   │   ├── supabase/{client,server}.ts
│   │   ├── api/                 # serviços: profile, taxonomy, classes,
│   │   │                        # questions, quizzes, sessions, play, diagnostics
│   │   ├── csv.ts               # exportação CSV (estrutura pronta p/ PDF depois)
│   │   ├── scoring.ts           # pontos máximos, faixas de domínio configuráveis
│   │   └── utils.ts
│   ├── hooks/
│   │   ├── useAsync.ts          # loading/error/data + reload
│   │   ├── useCountdown.ts      # temporizador sincronizado com o servidor
│   │   └── useAuth.tsx
│   ├── components/
│   │   ├── ui/                  # Button, Card, Modal acrílico, Input/Select/Field,
│   │   │                        # Badge, Progress/Skeleton, EmptyState, Avatar,
│   │   │                        # Toggle, Tabs, Toast
│   │   ├── layout/              # BrandLogo, ProfessorShell (sidebar flutuante + header)
│   │   ├── charts/              # BarList, DonutStat, LineEvolution (SVG próprios)
│   │   ├── quiz/                # CodeBlocksInput, TimerRing
│   │   ├── teacher/             # ClassFormModal, QuestionFormModal, QuestionBankModal,
│   │   │                        # StartSessionModal
│   │   ├── player/              # PlayerClient, QuestionView, PlayerViews (lobby/result)
│   │   ├── host/                # HostClient, HostViews (telas TV)
│   │   └── diagnostics/         # MasteryBadge/Timeline/DiffBlock, QuestionBreakdown
│   └── app/
│       ├── page.tsx             # landing
│       ├── login|registrar|recuperar-senha|redefinir-senha/
│       ├── entrar/              # entrada do aluno (mobile-first)
│       ├── sala/[code]/         # jogo do aluno em tempo real
│       └── professor/           # dashboard, turmas, turmas/[id], quizzes (+[id]/novo),
│                                # questoes, biblioteca, diagnosticos (+[sessionId]),
│                                # alunos/[studentId], perfil, sala/[sessionId]
```

---

## 5. Decisões importantes

### Pontuação × Diagnóstico (separados no banco)
Cada resposta guarda dois campos independentes em `answers`:

- `is_correct` — único insumo de **todos** os cálculos de diagnóstico (temas, questões difíceis,
  evolução, classificações).
- `points_earned` — usado **somente** pelo ranking/placar (até 1000 pts, bônus de velocidade).

A correção e a pontuação são calculadas **no servidor** (`submit_answer`), nunca no cliente —
impossível forjar acerto ou pontos pelo devtools.

### Segurança
- Alunos não têm conta: entram por código de sala e recebem um *token* opaco (UUID) gerado no
  servidor. Ele dá acesso apenas à própria sessão/participação.
- Por RLS, o aluno anônimo **nunca lê** respostas, nomes ou diagnósticos de terceiros — os números
  agregados chegam a ele via broadcast do professor ou via função `get_player_view`, que só expõe
  os próprios dados.
- Professores só acessam o que criam (turmas, quizzes, questões, sessões, respostas).
- Rotas `/professor/*` protegidas por `proxy.ts` (middleware) + verificação no layout.

### Personalização da marca
Nome, slogan, descrição institucional e cores das alternativas ficam em `src/config/brand.ts`.
A paleta do sistema fica nas variáveis de `src/app/globals.css` (bloco `@theme`). Trocar a marca
da escola = editar esses dois arquivos.

### Classificações de desempenho
Faixas configuráveis em `src/lib/scoring.ts` (`MASTERY_THRESHOLDS`):
<50% Necessita atenção · 50–69% Em desenvolvimento · 70–84% Bom domínio · ≥85% Excelente domínio.
O sistema diagnostica **apenas desempenho acadêmico** com base nas respostas registradas — nunca
características pessoais.

### Exportações
CSV pronto (resultados por sessão, histórico da turma e temas do aluno), gerado no cliente com
`;` e BOM para abrir direto no Excel PT-BR. A interface de exportação (`lib/csv.ts`) foi desenhada
para receber um formato PDF no futuro sem mudanças nas telas.

### Dados de demonstração
Não há dados falsos embutidos. O catálogo de disciplinas (`0004_seed.sql`) é conteúdo de sistema,
não dado de teste.
