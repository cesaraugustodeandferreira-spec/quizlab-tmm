import { AuthProvider } from "@/hooks/useAuth";
import { ProfessorShell } from "@/components/layout/ProfessorShell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ProfessorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/professor/dashboard");
  }

  return (
    <AuthProvider>
      <ProfessorShell>{children}</ProfessorShell>
    </AuthProvider>
  );
}
