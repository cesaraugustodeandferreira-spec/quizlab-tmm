import { AuthProvider } from "@/hooks/useAuth";
import { ProfessorShell } from "@/components/layout/ProfessorShell";

export default function ProfessorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ProfessorShell>{children}</ProfessorShell>
    </AuthProvider>
  );
}
