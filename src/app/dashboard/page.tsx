import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createGroup, joinGroup } from "@/app/actions";
import type { Group, GroupRole } from "@/lib/types";

export default async function DashboardPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("group_members")
    .select("role, groups(id, name, description)")
    .eq("user_id", user.id)
    .order("joined_at");

  const groups = (memberships ?? []) as unknown as {
    role: GroupRole;
    groups: Pick<Group, "id" | "name" | "description">;
  }[];

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">My groups</h1>
      {error === "invalid-code" && (
        <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          That invite code didn&apos;t match any group.
        </p>
      )}

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {groups.map(({ role, groups: g }) => (
          <li key={g.id}>
            <Link
              href={`/groups/${g.id}`}
              className="block rounded-lg border border-neutral-200 p-4 hover:border-amber-600 dark:border-neutral-800"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{g.name}</span>
                <span className="text-xs uppercase text-neutral-400">{role}</span>
              </div>
              {g.description && (
                <p className="mt-1 text-sm text-neutral-500">{g.description}</p>
              )}
            </Link>
          </li>
        ))}
        {groups.length === 0 && (
          <li className="text-neutral-500">
            You&apos;re not in any groups yet — create one or join with an
            invite code.
          </li>
        )}
      </ul>

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <form action={createGroup} className="flex flex-col gap-3">
          <h2 className="font-semibold">Create a group</h2>
          <input
            name="name"
            required
            maxLength={100}
            placeholder="e.g. First Baptist Cookbook Club"
            className="rounded-md border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <input
            name="description"
            placeholder="Description (optional)"
            className="rounded-md border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button className="rounded-md bg-amber-700 px-4 py-2 font-medium text-white hover:bg-amber-800">
            Create group
          </button>
        </form>

        <form action={joinGroup} className="flex flex-col gap-3">
          <h2 className="font-semibold">Join a group</h2>
          <input
            name="code"
            required
            placeholder="Invite code"
            className="rounded-md border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button className="rounded-md border border-amber-700 px-4 py-2 font-medium text-amber-700 hover:bg-amber-50 dark:hover:bg-neutral-900">
            Join
          </button>
        </form>
      </div>
    </main>
  );
}
