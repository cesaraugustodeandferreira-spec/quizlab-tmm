"use client";

import { BrandLogo } from "@/components/layout/BrandLogo";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useState } from "react";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [school, setSchool] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function validate(): string | null {
    if (fullName.trim().length < 3) return "Informe seu nome completo.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Informe um e-mail válido.";
    if (password.length < 6) return "A senha precisa ter pelo menos 6 caracteres.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim(), school: school.trim(), role: "professor" },
        },
      });
      if (error) {
        setError(
          error.message.includes("already")
            ? "Já existe uma conta com este e-mail."
            : "Não foi possível criar a conta. Tente novamente.",
        );
        return;
      }
      setSuccess(true);
      if (data.session) window.location.href = "/professor/dashboard";
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandLogo size="lg" href="/" />
          <h1 className="mt-2 font-display text-2xl font-bold text-ink">Criar conta de Professor</h1>
          <p className="text-sm text-mute">Leva menos de um minuto.</p>
        </div>

        <div className="rounded-[14px] border border-line bg-surface p-6 sm:p-8">
          {success ? (
            <div className="space-y-4 text-center" role="status">
              <p className="text-sm leading-relaxed text-mute">
                Conta criada com sucesso! Enviamos um link de confirmação para o seu e-mail.
                Confirme para poder fazer login.
              </p>
              <Link
                href="/login"
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-accent font-medium text-white transition-colors hover:bg-accent-bright"
              >
                Ir para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <p role="alert" className="rounded-[10px] border border-bad/30 bg-bad-deep px-4 py-3 text-sm text-bad">
                  {error}
                </p>
              )}
              <Field label="Nome completo" htmlFor="name" required>
                <Input
                  id="name"
                  autoComplete="name"
                  placeholder="Maria da Silva"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </Field>
              <Field label="Escola (opcional)" htmlFor="school">
                <Input
                  id="school"
                  autoComplete="organization"
                  placeholder="Nome da escola"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                />
              </Field>
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
              <Field label="Senha" htmlFor="password" required hint="Mínimo de 6 caracteres.">
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Button type="submit" size="lg" loading={loading} className="w-full">
                Criar conta
              </Button>
            </form>
          )}

          <div className="mt-6 border-t border-line pt-5 text-center text-sm">
            <Link href="/login" className="text-mute transition-colors hover:text-ink">
              Já tenho conta · Entrar
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
