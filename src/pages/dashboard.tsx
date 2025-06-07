import { type NextPage } from "next";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Image from "next/image";
import { trpc } from "src/utils/api";
import type { Base } from "@prisma/client";

const Dashboard: NextPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Modal and base name state
  const [showModal, setShowModal] = useState(false);
  const [baseName, setBaseName] = useState("");

  // Fetch bases from backend
  const isAuthed = status === "authenticated";

  // Only fetch bases if authenticated
  const { data: bases, refetch } = trpc.base.getAll.useQuery(undefined, {
    enabled: isAuthed,
  });
  const createBase = trpc.base.create.useMutation({
    onSuccess: () => {
      void refetch();
      setShowModal(false);
      setBaseName("");
    },
  });

  useEffect(() => {
    if (status !== "loading" && !session) {
      void router.push("/");
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  // Handle base creation
  const handleCreateBase = () => {
    if (baseName.trim()) {
      createBase.mutate({ name: baseName.trim() });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Create Base
            </h2>
            <input
              className="mb-4 w-full rounded border border-gray-300 px-3 py-2"
              placeholder="Base name"
              value={baseName}
              onChange={(e) => setBaseName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateBase();
              }}
            />
            <div className="flex justify-end space-x-2">
              <button
                className="rounded px-4 py-2 text-gray-600 hover:bg-gray-100"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                onClick={handleCreateBase}
                disabled={!baseName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Image
                  src="/logo.svg"
                  alt="Logo"
                  className="h-8 w-8"
                  width={32}
                  height={32}
                />
                <span className="text-xl font-semibold text-gray-900">
                  Airtable
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {session.user?.image && (
                  <Image
                    src={session.user.image}
                    alt="Profile"
                    className="h-8 w-8 rounded-full"
                    width={32}
                    height={32}
                  />
                )}
                <span className="text-sm text-gray-700">
                  {session.user?.name || session.user?.email}
                </span>
              </div>
              <button
                onClick={() => {
                  void signOut();
                }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {session.user?.name?.split(" ")[0]}!
          </h1>
          <p className="mt-2 text-gray-600">
            Manage your bases and tables from your dashboard.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <div className="inline-block">
            <div
              className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
              onClick={() => setShowModal(true)}
            >
              <div className="flex items-center space-x-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                  <svg
                    className="h-4 w-4 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900">
                    Create Base
                  </h3>
                  <p className="text-xs text-gray-500">
                    Start with a new workspace
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Bases Section */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-medium text-gray-900">Recent Bases</h2>
          </div>
          <div className="p-6">
            {!bases || bases.length === 0 ? (
              <div className="py-12 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">
                  No bases yet
                </h3>
                <p className="mt-2 text-gray-500">
                  Create your first base to get started with organizing your
                  data.
                </p>
                <button
                  className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                  onClick={() => setShowModal(true)}
                >
                  <svg
                    className="mr-2 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Create your first base
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {bases.map((base: Base, idx: number) => {
                  const initials = base.name
                    .split(" ")
                    .map((word: string) => word[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  const colors = [
                    "bg-red-600",
                    "bg-blue-600",
                    "bg-green-600",
                    "bg-purple-600",
                    "bg-yellow-600",
                    "bg-pink-600",
                  ];
                  const color = colors[idx % colors.length] ?? "bg-gray-400";

                  return (
                    <div
                      key={base.id}
                      className="flex cursor-pointer items-center space-x-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md"
                    >
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-lg text-white ${color}`}
                      >
                        <span className="text-md font-bold">{initials}</span>
                      </div>
                      <div>
                        <div className="text-md font-medium text-gray-900">
                          {base.name}
                        </div>
                        <div className="text-sm text-gray-500">Base</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
