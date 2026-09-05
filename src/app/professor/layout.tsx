import { AuthProvider } from "@/hooks/useAuth";
import { ProfessorShell } from "@/components/layout/ProfessorShell";
import { FeedbackButton } from "@/components/layout/FeedbackButton";

export default function ProfessorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ProfessorShell>
        {children}
        <FeedbackButton />
      </ProfessorShell>
    </AuthProvider>
  );
}
