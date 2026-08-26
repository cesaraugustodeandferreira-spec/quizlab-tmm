import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar seu perfil.");
  return (data as Profile) ?? null;
}

export async function updateProfile(
  userId: string,
  patch: { full_name?: string; school?: string },
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId);
  if (error) throw new Error("Não foi possível salvar o perfil.");
}

export async function changePassword(newPassword: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message === "New password should be different from the old password."
    ? "A nova senha precisa ser diferente da atual."
    : "Não foi possível alterar a senha.");
}

export async function changeEmail(email: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ email });
  if (error) {
    if (error.message.includes("already")) throw new Error("Este e-mail já está em uso.");
    throw new Error("Não foi possível solicitar a troca de e-mail.");
  }
}
