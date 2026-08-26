"use client";

import { usePageHeader } from "@/components/layout/ProfessorShell";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Progress";
import { useToast } from "@/components/ui/Toast";
import { changeEmail, changePassword, updateProfile } from "@/lib/api/profile";
import { IconLogout } from "@tabler/icons-react";
import { useEffect, useState } from "react";

export default function ProfilePage() {
  const { user, profile, loading, signOut } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState("");
  const [school, setSchool] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [email, setEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPass, setSavingPass] = useState(false);

  usePageHeader({
    breadcrumb: [
      { label: "Início", href: "/professor/dashboard" },
      { label: "Perfil" },
    ],
    pill: "Conta",
  });

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name);
    setSchool(profile.school ?? "");
  }, [profile]);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  if (loading || !profile) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  async function handleProfile(e: React.FormEvent) {
    e.preventDefault();
    if (fullName.trim().length < 3) {
      toast("Informe seu nome completo.", "bad");
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile(user!.id, { full_name: fullName.trim(), school: school.trim() });
      toast("Perfil atualizado.", "ok");
      window.location.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar.", "bad");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast("Informe um e-mail válido.", "bad");
      return;
    }
    setSavingEmail(true);
    setEmailNotice(null);
    try {
      await changeEmail(email.trim());
      setEmailNotice(`Enviamos uma confirmação para ${email}. A troca é concluída ao confirmar o novo e-mail.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao solicitar troca de e-mail.", "bad");
    } finally {
      setSavingEmail(false);
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast("A senha precisa ter pelo menos 6 caracteres.", "bad");
      return;
    }
    if (password !== confirm) {
      toast("As senhas não coincidem.", "bad");
      return;
    }
    setSavingPass(true);
    try {
      await changePassword(password);
      setPassword("");
      setConfirm("");
      toast("Senha alterada com sucesso.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao alterar senha.", "bad");
    } finally {
      setSavingPass(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Meu Perfil</h1>
        <p className="mt-0.5 text-sm text-mute">Gerencie suas informações de acesso.</p>
      </div>

      <Card>
        <div className="mb-5 flex items-center gap-4">
          <Avatar name={profile.full_name} size="lg" />
          <div>
            <p className="font-medium text-ink">{profile.full_name}</p>
            <p className="text-sm text-faint">{user?.email}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={<IconLogout size={15} />}
            className="ml-auto"
            onClick={() => void signOut()}
          >
            Sair
          </Button>
        </div>

        <form onSubmit={handleProfile} className="space-y-4 border-t border-line pt-5" noValidate>
          <CardTitle>Dados pessoais</CardTitle>
          <Field label="Nome completo" htmlFor="pf-name" required>
            <Input id="pf-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </Field>
          <Field label="Escola (opcional)" htmlFor="pf-school">
            <Input id="pf-school" value={school} onChange={(e) => setSchool(e.target.value)} autoComplete="organization" placeholder="Nome da escola" />
          </Field>
          <Button type="submit" loading={savingProfile}>
            Salvar dados
          </Button>
        </form>
      </Card>

      <Card>
        <form onSubmit={handleEmail} className="space-y-4" noValidate>
          <CardTitle>E-mail de acesso</CardTitle>
          <Field label="Novo e-mail" htmlFor="pf-email">
            <Input id="pf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {emailNotice && (
            <p role="status" className="rounded-[10px] border border-ok/30 bg-ok-deep px-4 py-3 text-sm text-ok">
              {emailNotice}
            </p>
          )}
          <Button type="submit" variant="outline" loading={savingEmail}>
            Solicitar troca de e-mail
          </Button>
        </form>
      </Card>

      <Card>
        <form onSubmit={handlePassword} className="space-y-4" noValidate>
          <CardTitle>Alterar senha</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nova senha" htmlFor="pf-pass" required hint="Mínimo de 6 caracteres.">
              <Input
                id="pf-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirmar nova senha" htmlFor="pf-pass2" required>
              <Input
                id="pf-pass2"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
          </div>
          <Button type="submit" variant="outline" loading={savingPass}>
            Alterar senha
          </Button>
        </form>
      </Card>
    </div>
  );
}
