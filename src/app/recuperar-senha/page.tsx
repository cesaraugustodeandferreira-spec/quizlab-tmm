"use client";

import { BrandLogo } from "@/components/layout/BrandLogo";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Informe um e-mail válido.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) throw error;
      setSent(true);
    } catch {
      setError("Não foi possível enviar o e-mail de recuperação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandLogo size="lg" href="/" />
          <h1 className="mt-2 font-display text-2xl font-bold text-ink">Recuperar senha</h1>
          <p className="text-sm text-mute">Enviaremos um link para você definir uma nova senha.</p>
        </div>

        <div className="rounded-[14px] border border-line bg-surface p-6 sm:p-8">
          {sent ? (
            <div role="status" className="space-y-4 text-center">
              <p className="text-sm leading-relaxed text-mute">
                Se existir uma conta para <strong className="text-ink">{email}</strong>, você receberá
                um e-mail com o link de recuperação.
              </p>
              <Link
                href="/login"
                className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-line-strong font-medium text-ink transition-colors hover:bg-surface-2"
              >
                Voltar ao login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <p role="alert" className="rounded-[10px] border border-bad/30 bg-bad-deep px-4 py-3 text-sm text-bad">
                  {error}
                </p>
              )}
              <Field label="E-mail da conta" htmlFor="email" required>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@escola.edu.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Button type="submit" size="lg" loading={loading} className="w-full">
                Enviar link de recuperação
              </Button>
            </form>
          )}
          <div className="mt-6 border-t border-line pt-5 text-center text-sm">
            <Link href="/login" className="text-mute transition-colors hover:text-ink">
              Voltar ao login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
