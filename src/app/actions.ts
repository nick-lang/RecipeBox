"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function createGroup(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const { data: group, error } = await supabase
    .from("groups")
    .insert({
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !group) throw new Error(error?.message ?? "Could not create group");

  const { error: memberError } = await supabase.from("group_members").insert({
    group_id: group.id,
    user_id: user.id,
    role: "owner",
  });
  if (memberError) throw new Error(memberError.message);

  redirect(`/groups/${group.id}`);
}

export async function joinGroup(formData: FormData) {
  const { supabase } = await requireUser();
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return;

  const { data: groupId, error } = await supabase.rpc("join_group", { code });
  if (error) redirect("/dashboard?error=invalid-code");
  redirect(`/groups/${groupId}`);
}

export async function createCollection(formData: FormData) {
  const { supabase, user } = await requireUser();
  const groupId = String(formData.get("group_id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const { error } = await supabase.from("collections").insert({
    group_id: groupId,
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/groups/${groupId}`);
}

export async function updateRecipe(formData: FormData) {
  const { supabase } = await requireUser();
  const recipeId = String(formData.get("recipe_id"));
  const publish = formData.get("intent") === "publish";

  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const { error } = await supabase
    .from("recipes")
    .update({
      title: String(formData.get("title") ?? "").trim() || null,
      attribution: String(formData.get("attribution") ?? "").trim() || null,
      category: String(formData.get("category") ?? "").trim() || null,
      tags,
      body_md: String(formData.get("body_md") ?? "") || null,
      transcription_notes:
        String(formData.get("transcription_notes") ?? "").trim() || null,
      ...(publish ? { status: "published" } : {}),
    })
    .eq("id", recipeId);
  if (error) throw new Error(error.message);

  revalidatePath(`/recipes/${recipeId}`);
  redirect(`/recipes/${recipeId}`);
}

export async function deleteRecipe(formData: FormData) {
  const { supabase } = await requireUser();
  const recipeId = String(formData.get("recipe_id"));
  const backTo = String(formData.get("back_to") || "/dashboard");

  const { error } = await supabase.from("recipes").delete().eq("id", recipeId);
  if (error) throw new Error(error.message);
  redirect(backTo);
}
