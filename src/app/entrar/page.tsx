"use client";

import { BrandLogo } from "@/components/layout/BrandLogo";
import { CodeBlocksInput } from "@/components/quiz/CodeBlocksInput";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { joinSession } from "@/lib/api/play";
import { normalizeCode } from "@/lib/utils";
import { IconArrowRight } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(() => normalizeCode(searchParams.get("sala") ?? "").slice(0, 6));
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): string | null {
    if (normalizeCode(code).length !== 6) return "Digite o código completo da sala (6 caracteres).";
    if (name.trim().length < 2 || name.trim().length > 40)
      return "Informe seu nome (entre 2 e 40 caracteres).";
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
      const normalized = normalizeCode(code);
      const result = await joinSession(normalized, name.trim());
      localStorage.setItem(
        `ql_room_${normalized}`,
        JSON.stringify({ token: result.token, name: result.name }),
      );
      router.push(`/sala/${normalized}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar na sala.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7" noValidate>
      {error && (
        <p role="alert" className="rounded-[10px] border border-bad/30 bg-bad-deep px-4 py-3 text-center text-sm text-bad">
          {error}
        </p>
      )}
      <div className="space-y-2">
        <label htmlFor="room-code-root" className="block text-center text-[13px] font-medium text-mute">
          Código da sala
        </label>
        <div id="room-code-root">
          <CodeBlocksInput value={code} onChange={(v) => setCode(v.slice(0, 6))} disabled={loading} />
        </div>
      </div>
      <Field label="Seu nome" htmlFor="student-name" required>
        <Input
          id="student-name"
          placeholder="Como você se chama?"
          autoComplete="off"
          className="h-12 text-base"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
        />
      </Field>
      <Button type="submit" size="lg" loading={loading} icon={<IconArrowRight size={18} />} className="w-full">
        Entrar na sala
      </Button>
    </form>
  );
}

export default function JoinPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          <BrandLogo size="lg" href="/" />
          <h1 className="font-display text-3xl font-bold text-ink">Entrar em uma sala</h1>
          <p className="-mt-2 text-sm text-mute">Peça o código ao seu professor.</p>
        </div>

        <div className="rounded-[14px] border border-line bg-surface p-6 sm:p-8">
          <Suspense fallback={<div className="skeleton-pulse h-72 w-full" />}>
            <JoinForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs">
          <Link href="/" className="text-faint transition-colors hover:text-mute">
            É professor? Acesse sua conta
          </Link>
        </p>
      </div>
    </main>
  );
}
