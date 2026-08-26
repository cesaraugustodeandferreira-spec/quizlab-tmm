"use client";

import { BrandLogo } from "@/components/layout/BrandLogo";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user);
      setChecking(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch {
      setError("Não foi possível redefinir a senha. O link pode ter expirado — solicite um novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandLogo size="lg" href="/" />
          <h1 className="mt-2 font-display text-2xl font-bold text-ink">Definir nova senha</h1>
        </div>

        <div className="rounded-[14px] border border-line bg-surface p-6 sm:p-8">
          {checking ? (
            <div className="skeleton-pulse h-48 w-full" />
          ) : done ? (
            <div role="status" className="space-y-4 text-center">
              <p className="text-sm text-mute">Senha atualizada com sucesso!</p>
              <Link
                href="/login"
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-accent font-medium text-white transition-colors hover:bg-accent-bright"
              >
                Ir para o login
              </Link>
            </div>
          ) : hasSession ? (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <p role="alert" className="rounded-[10px] border border-bad/30 bg-bad-deep px-4 py-3 text-sm text-bad">
                  {error}
                </p>
              )}
              <Field label="Nova senha" htmlFor="new-password" required hint="Mínimo de 6 caracteres.">
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Field label="Confirmar nova senha" htmlFor="confirm-password" required>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </Field>
              <Button type="submit" size="lg" loading={loading} className="w-full">
                Salvar nova senha
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm leading-relaxed text-mute">
                Este link de recuperação é inválido ou expirou.
              </p>
              <Link href="/recuperar-senha" className="inline-block text-sm text-accent-bright hover:text-white">
                Solicitar novo link
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
