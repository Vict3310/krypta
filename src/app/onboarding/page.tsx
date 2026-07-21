export const metadata = {
  title: "Setup Wizard - Krypta",
  description: "Get your security scanning setup in 5 minutes",
};

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import OnboardingWizard from "@/components/OnboardingWizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <OnboardingWizard userId={session.user.id} />
    </div>
  );
}
