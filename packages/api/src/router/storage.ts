import type { TRPCRouterRecord } from "@trpc/server";
import { createClient } from "@supabase/supabase-js";
import { TRPCError } from "@trpc/server";

import { env } from "../env";
import { protectedProcedure } from "../trpc";

type SupabaseClient = ReturnType<typeof createClient>;
let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(
      env.SUPABASE_URL ?? "",
      env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      { auth: { persistSession: false } },
    );
  }
  return supabaseClient;
}

export const storageRouter = {
  getAvatarUploadUrl: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const path = `${userId}.jpg`;
    const bucket = env.SUPABASE_AVATAR_BUCKET;

    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: true });

    if (error || !data) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to create upload URL: ${error?.message ?? "unknown error"}`,
      });
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return {
      uploadUrl: data.signedUrl,
      token: data.token,
      path: data.path,
      publicUrl: publicUrlData.publicUrl,
    };
  }),
} satisfies TRPCRouterRecord;
