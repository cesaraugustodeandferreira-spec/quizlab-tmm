"use client";

import { BrandLogo } from "@/components/layout/BrandLogo";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/professor/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError(
          error.message.includes("Invalid login")
            ? "E-mail ou senha incorretos."
            : error.message.includes("confirmed")
              ? "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada."
              : "Não foi possível entrar. Tente novamente.",
        );
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && (
        <p role="alert" className="rounded-[10px] border border-bad/30 bg-bad-deep px-4 py-3 text-sm text-bad">
          {error}
        </p>
      )}
      <Field label="E-mail" htmlFor="email" required>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="voce@escola.edu.br"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Senha" htmlFor="password" required>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Button type="submit" size="lg" loading={loading} className="w-full">
        Entrar
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandLogo size="lg" href="/" />
          <h1 className="mt-2 font-display text-2xl font-bold text-ink">Entrar como Professor</h1>
          <p className="text-sm text-mute">Acesse sua conta para gerenciar turmas e quizzes.</p>
        </div>

        <div className="rounded-[14px] border border-line bg-surface p-6 sm:p-8">
          <Suspense fallback={<div className="skeleton-pulse h-64 w-full" />}>
            <LoginForm />
          </Suspense>

          <div className="mt-6 flex flex-col gap-2 border-t border-line pt-5 text-center text-sm">
            <Link href="/registrar" className="font-medium text-accent-bright transition-colors hover:text-white">
              Criar conta
            </Link>
            <Link href="/recuperar-senha" className="text-mute transition-colors hover:text-ink">
              Esqueci minha senha
            </Link>
            <Link href="/" className="mt-2 text-xs text-faint transition-colors hover:text-mute">
              Voltar para a página inicial
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
