import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { fmtDateTime } from "@/lib/utils";
import { IconArrowLeft, IconMessageCircle, IconAlertCircle } from "@tabler/icons-react";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "cesaraugustodeandferreira@gmail.com";

export default async function AdminFeedbackPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || (user.email ?? "").toLowerCase() !== ADMIN_EMAIL) {
    redirect("/professor/dashboard");
  }

  const { data: feedbacks, error } = await supabase
    .from("feedback")
    .select("id, professor_email, mensagem, url_contexto, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-10 px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Relatos de problemas</h1>
          <p className="mt-1 text-sm text-mute">
            Feedback enviado pelos professores. {feedbacks?.length ?? 0} relato(s).
          </p>
        </div>
        <Link
          href="/professor/dashboard"
          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border border-line-strong px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-2 hover:border-white/20"
        >
          <IconArrowLeft size={16} />
          Voltar ao dashboard
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-bad-deep px-3 py-2 text-sm text-bad">
          <IconAlertCircle size={16} className="shrink-0" />
          <span>Erro ao carregar relatos: {error.message}</span>
        </div>
      )}

      {!feedbacks?.length ? (
        <div className="rounded-[14px] border border-line bg-surface p-8 text-center">
          <IconMessageCircle size={36} stroke={1.4} className="mx-auto text-faint" />
          <p className="mt-3 text-sm text-mute">Nenhum relato enviado ainda.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {feedbacks.map((f) => (
            <li key={f.id} className="rounded-[14px] border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">{f.professor_email}</span>
                <span className="text-xs text-faint">
                  {fmtDateTime(f.created_at)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-mute">{f.mensagem}</p>
              {f.url_contexto && (
                <p className="mt-3 border-t border-line pt-2 text-xs text-faint">
                  Ocorrido em: <code className="text-accent-bright">{f.url_contexto}</code>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}