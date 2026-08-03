export type GroupRole = "owner" | "admin" | "member";
export type RecipeStatus = "processing" | "draft" | "published" | "failed";

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
  profiles?: Profile;
}

export interface Collection {
  id: string;
  group_id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface Recipe {
  id: string;
  collection_id: string;
  uploaded_by: string;
  status: RecipeStatus;
  title: string | null;
  attribution: string | null;
  category: string | null;
  tags: string[];
  body_md: string | null;
  transcription_notes: string | null;
  pipeline_meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeImage {
  id: string;
  recipe_id: string;
  kind: "original" | "cleaned";
  storage_path: string;
  position: number;
}
