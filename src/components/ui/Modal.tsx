"use client";

import { cn } from "@/lib/utils";
import { IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: ModalSize;
  hideClose?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-6xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  hideClose = false,
  children,
  footer,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(
      "input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    (focusable ?? panel)?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        aria-hidden
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-black/55"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "acrylic animate-scale-in relative flex max-h-[88dvh] w-full flex-col overflow-hidden focus:outline-none",
          sizeClasses[size],
        )}
      >
        {(title || !hideClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div>
              {title && <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-mute">{description}</p>}
            </div>
            {!hideClose && (
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="-mr-2 -mt-1 rounded-lg p-2 text-faint transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <IconX size={18} />
              </button>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-line px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

export function ConfirmModal({
  state,
  onClose,
  loading = false,
}: {
  state: ConfirmState | null;
  onClose: () => void;
  loading?: boolean;
}) {
  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={state?.title}
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={loading}
            className="h-10 cursor-pointer rounded-[10px] px-4 text-sm text-mute transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Cancelar
          </button>
          <button
            data-testid="confirm-danger"
            onClick={() => state?.onConfirm()}
            disabled={loading}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] bg-bad-deep px-4 text-sm font-medium text-bad transition-colors hover:bg-bad/25 disabled:opacity-50"
          >
            {state?.confirmLabel ?? "Confirmar"}
          </button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-mute">{state?.message}</p>
    </Modal>
  );
}

export type { ConfirmState };
