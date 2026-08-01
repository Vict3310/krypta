"use server";

import { createClient } from "@/utils/supabase/server";
import { createRepositoryWebhook } from "@/lib/github";
import { revalidatePath } from "next/cache";

export async function connectRepository(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const repoFullName = formData.get("repoFullName") as string;
  const githubRepoId = Number(formData.get("githubRepoId"));
  const defaultBranch = (formData.get("defaultBranch") as string) || "main";

  const [owner, repoName] = repoFullName.split("/");

  if (!owner || !repoName) {
    throw new Error("Invalid repository name format");
  }

  let webhookId = null;

  // Attempt to create a webhook if we have a provider token
  const { data: { session } } = await supabase.auth.getSession();
  const providerToken = session?.provider_token;
  if (providerToken) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://krypta.dev");
      const webhookUrl = `${baseUrl}/api/webhooks/github`;
      const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

      if (!webhookSecret) {
        throw new Error("GITHUB_WEBHOOK_SECRET not configured");
      }

      const webhook = await createRepositoryWebhook(
        providerToken,
        owner,
        repoName,
        webhookUrl,
        webhookSecret
      );
      webhookId = webhook.id;
    } catch (error) {
      console.error("[Webhook] Failed to create:", (error as Error).message);
      // Continue — webhook is optional
    }
  }

  // Insert into DB
  const { error: insertError } = await supabase.from("repositories").insert({
    user_id: user.id,
    github_repo_id: githubRepoId,
    full_name: repoFullName,
    default_branch: defaultBranch,
    webhook_id: webhookId,
    is_active: true,
  });

  if (insertError) {
    console.error("[DB] Failed to connect repository");
    throw new Error(`Failed to save repository: ${insertError.message}`);
  }

  console.log("[DB] Repository connected");
  revalidatePath("/dashboard/repositories/new");
  revalidatePath("/dashboard");
}
