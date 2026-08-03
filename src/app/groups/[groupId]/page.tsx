import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createCollection } from "@/app/actions";
import type { Collection, Group, GroupRole, Profile } from "@/lib/types";

export default async function GroupPage(props: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: group } = (await supabase
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .single()) as { data: Group | null };
  if (!group) notFound();

  const [{ data: collections }, { data: members }] = await Promise.all([
    supabase
      .from("collections")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false }),
    supabase
      .from("group_members")
      .select("user_id, role, profiles(id, display_name, avatar_url)")
      .eq("group_id", groupId)
      .order("joined_at"),
  ]);

  const memberRows = (members ?? []) as unknown as {
    user_id: string;
    role: GroupRole;
    profiles: Profile;
  }[];
  const myRole = memberRows.find((m) => m.user_id === user.id)?.role;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">{group.name}</h1>
      {group.description && (
        <p className="mt-1 text-neutral-500">{group.description}</p>
      )}
      <p className="mt-2 text-sm text-neutral-500">
        Invite code:{" "}
        <code className="rounded bg-neutral-100 px-2 py-0.5 font-mono dark:bg-neutral-800">
          {group.invite_code}
        </code>{" "}
        — share it to let others join.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Collections</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {((collections ?? []) as Collection[]).map((c) => (
            <li key={c.id}>
              <Link
                href={`/groups/${groupId}/collections/${c.id}`}
                className="block rounded-lg border border-neutral-200 p-4 hover:border-amber-600 dark:border-neutral-800"
              >
                <span className="font-semibold">{c.name}</span>
                {c.description && (
                  <p className="mt-1 text-sm text-neutral-500">{c.description}</p>
                )}
              </Link>
            </li>
          ))}
          {(collections ?? []).length === 0 && (
            <li className="text-neutral-500">
              No collections yet — start one below (e.g. &ldquo;2026
              Cookbook&rdquo;).
            </li>
          )}
        </ul>

        <form action={createCollection} className="mt-4 flex flex-wrap gap-2">
          <input type="hidden" name="group_id" value={groupId} />
          <input
            name="name"
            required
            maxLength={100}
            placeholder="New collection, e.g. 2026 Cookbook"
            className="flex-1 rounded-md border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button className="rounded-md bg-amber-700 px-4 py-2 font-medium text-white hover:bg-amber-800">
            Add collection
          </button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">
          Members{myRole ? ` — you are ${myRole === "owner" ? "the owner" : `a ${myRole}`}` : ""}
        </h2>
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {memberRows.map((m) => (
            <li key={m.user_id} className="flex justify-between">
              <span>{m.profiles?.display_name || "Member"}</span>
              <span className="uppercase text-neutral-400">{m.role}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
