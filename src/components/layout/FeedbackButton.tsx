"use client";

import { Modal } from "@/components/ui/Modal";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { IconMessageCircle, IconSend, IconCheck, IconAlertCircle } from "@tabler/icons-react";

export function FeedbackButton() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openModal = () => {
    setOpen(true);
    setSent(false);
    setError(null);
  };

  const closeModal = () => {
    if (sending) return;
    setOpen(false);
  };

  const handleSubmit = async () => {
    const texto = mensagem.trim();
    if (texto.length < 3) {
      setError("Escreva um pouco mais sobre o que aconteceu (mínimo de 3 caracteres).");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagem: texto,
          url_contexto: pathname,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Erro ao enviar relato");
      }
      setSent(true);
      setMensagem("");
      setTimeout(() => setOpen(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar seu relato.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={openModal}
        aria-label="Relatar um problema"
        title="Relatar um problema"
        className="fixed right-4 bottom-20 z-40 flex size-11 cursor-pointer items-center justify-center rounded-full bg-accent text-white shadow-[0_6px_20px_rgba(37,99,235,0.4)] transition-transform hover:scale-105 active:scale-95 sm:right-5 sm:bottom-5"
      >
        <IconMessageCircle size={20} />
      </button>

      <Modal
        open={open}
        onClose={closeModal}
        title="Relatar um problema"
        description={
          sent
            ? "Obrigado, recebemos seu relato."
            : "Descreva o que aconteceu para podermos corrigir."
        }
        size="md"
        hideClose={sent}
        footer={
          sent ? (
            <button
              onClick={() => setOpen(false)}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-bright"
            >
              <IconCheck size={16} /> Fechar
            </button>
          ) : (
            <>
              <button
                onClick={closeModal}
                disabled={sending}
                className="h-10 cursor-pointer rounded-[10px] px-4 text-sm text-mute transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={sending}
                className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-bright disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <IconSend size={16} /> Enviar
                  </>
                )}
              </button>
            </>
          )
        }
      >
        {sent ? (
          <div className="flex items-center gap-3 py-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ok/15 text-ok">
              <IconCheck size={18} />
            </span>
            <div>
              <p className="text-sm font-medium text-ink">Obrigado, recebemos seu relato.</p>
              <p className="mt-0.5 text-xs text-faint">
                Já registramos sua mensagem junto com a tela em que você estava.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-bad-deep px-3 py-2 text-sm text-bad">
                <IconAlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <textarea
              value={mensagem}
              onChange={(e) => {
                setMensagem(e.target.value);
                if (error) setError(null);
              }}
              placeholder="O que aconteceu?"
              rows={5}
              maxLength={2000}
              autoFocus
              className="min-h-[120px] w-full resize-y rounded-xl border border-line-strong bg-surface px-4 py-3 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-faint">
                Você também envia: tela atual ({pathname})
              </span>
              <span className="text-xs text-faint">{mensagem.length}/2000</span>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}