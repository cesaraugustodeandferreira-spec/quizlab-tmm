import { BrandLogo } from "@/components/layout/BrandLogo";
import { BRAND } from "@/config/brand";
import {
  IconChartBar,
  IconChartPie,
  IconChevronRight,
  IconSchool,
  IconSparkles,
  IconUsers,
  IconBolt,
} from "@tabler/icons-react";
import Link from "next/link";

const BENEFITS = [
  {
    icon: IconBolt,
    title: "Quizzes em tempo real",
    text: "Salas com código de acesso, placar ao vivo e sincronização instantânea entre o projetor e os celulares dos alunos.",
  },
  {
    icon: IconChartPie,
    title: "Diagnóstico individual",
    text: "Cada aluno recebe acompanhamento por tema, com pontos fortes, dificuldades e evolução ao longo dos quizzes.",
  },
  {
    icon: IconUsers,
    title: "Análise da turma",
    text: "Identifique quais questões e conteúdos geram mais erro e visualize o aproveitamento agregado de cada turma.",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <BrandLogo href="/" />
        <nav className="flex items-center gap-3">
          <Link
            href="/entrar"
            className="hidden h-10 items-center rounded-[10px] px-4 text-sm font-medium text-mute transition-colors hover:bg-surface hover:text-ink sm:inline-flex"
          >
            Sou Aluno
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-[10px] bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-bright"
          >
            Entrar como Professor
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6">
        <section className="flex flex-col items-start py-14 sm:py-24">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-mute">
            <IconSparkles size={14} className="text-accent-bright" aria-hidden />
            Plataforma interna para escolas
          </span>
          <h1 className="font-display text-4xl leading-[1.1] font-bold tracking-tight text-ink sm:text-6xl">
            {BRAND.name}
          </h1>
          <p className="mt-4 max-w-xl font-display text-xl text-mute italic sm:text-2xl">
            {BRAND.tagline}
          </p>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-mute">
            {BRAND.description}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="group inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 text-[15px] font-semibold text-white transition-all hover:bg-accent-bright active:scale-[0.98]"
            >
              Sou Professor
              <IconChevronRight size={18} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href="/entrar"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-line-strong px-6 text-[15px] font-semibold text-ink transition-all hover:bg-surface hover:border-white/20 active:scale-[0.98]"
            >
              Entrar em uma Sala
            </Link>
          </div>
        </section>

        <section aria-label="Benefícios" className="grid gap-4 pb-20 sm:grid-cols-3">
          {BENEFITS.map((b) => (
            <article key={b.title} className="rounded-[14px] border border-line bg-surface p-6 transition-colors hover:border-line-strong">
              <b.icon size={22} stroke={1.7} className="text-accent-bright" aria-hidden />
              <h2 className="mt-4 font-display text-lg font-semibold text-ink">{b.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-mute">{b.text}</p>
            </article>
          ))}
        </section>

        <section className="pb-16">
          <div className="rounded-[14px] border border-line bg-surface p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-4">
              <IconSchool size={26} stroke={1.6} className="text-mute" aria-hidden />
              <p className="max-w-2xl text-sm leading-relaxed text-mute">
                <strong className="text-ink">Foco pedagógico, não apenas gamificação.</strong>{" "}
                A pontuação de velocidade existe para engajar em sala — mas todos os relatórios são
                calculados sobre acertos e erros reais, tema por tema, questão por questão.
              </p>
              <IconChartBar size={26} stroke={1.6} className="ml-auto hidden text-faint sm:block" aria-hidden />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-6">
        <p className="text-center text-xs text-faint">
          by César Augusto
        </p>
      </footer>
    </div>
  );
}
