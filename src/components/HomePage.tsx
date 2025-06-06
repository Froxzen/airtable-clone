import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";

const Homepage = () => {
  const { data: session } = useSession();

  const handleGoogleLogin = () => {
    void signIn("google");
  };

  const handleSignOut = () => {
    void signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation */}
      <nav className="flex items-center justify-between border-b border-gray-100 bg-white/80 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center space-x-2">
          {/* Airtable Logo */}
          <Image
            src="/logo.svg"
            alt="Logo"
            className="h-8 w-8"
            width={32}
            height={32}
          />
          <span className="text-xl font-semibold text-gray-900">Airtable</span>
        </div>

        {/* Conditional Auth Button */}
        {session ? (
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
              onClick={handleSignOut}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={handleGoogleLogin}
            className="flex items-center space-x-2 rounded-lg border border-gray-300 bg-white px-4 py-2 shadow-sm transition-colors hover:bg-gray-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-sm font-medium text-gray-700">
              Sign in with Google
            </span>
          </button>
        )}
      </nav>

      {/* Hero Section */}
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-16 text-center">
          <h1 className="mb-6 text-5xl font-bold leading-tight text-gray-900 md:text-6xl">
            Digital operations for the
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AI era
            </span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-xl leading-relaxed text-gray-600">
            Create modern business apps to manage and automate critical
            processes.
          </p>

          {!session && (
            <button
              onClick={handleGoogleLogin}
              className="inline-flex transform items-center space-x-3 rounded-xl bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Get started with Google</span>
            </button>
          )}

          {session && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-6">
              <h2 className="mb-2 text-2xl font-semibold text-green-800">
                Welcome back, {session.user?.name?.split(" ")[0]}!
              </h2>
              <p className="mb-4 text-green-700">
                You&apos;re signed in and ready to build amazing things.
              </p>
              <button
                onClick={() => (window.location.href = "/dashboard")}
                className="inline-flex items-center space-x-2 rounded-lg bg-green-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-green-700"
              >
                <span>Go to Dashboard</span>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Feature Preview */}
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
          <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4">
            <div className="flex items-center space-x-3">
              <div className="flex space-x-1">
                <div className="h-3 w-3 rounded-full bg-red-400"></div>
                <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
                <div className="h-3 w-3 rounded-full bg-green-400"></div>
              </div>
              <span className="text-sm font-medium text-gray-600">
                Product Roadmap
              </span>
            </div>
          </div>

          <div className="p-6">
            {/* Mock Table Header */}
            <div className="mb-4 grid grid-cols-4 gap-4 border-b border-gray-200 pb-3">
              <div className="text-sm font-semibold text-gray-700">Feature</div>
              <div className="text-sm font-semibold text-gray-700">Status</div>
              <div className="text-sm font-semibold text-gray-700">
                Priority
              </div>
              <div className="text-sm font-semibold text-gray-700">Owner</div>
            </div>

            {/* Mock Table Rows */}
            {[
              {
                feature: "User Authentication",
                status: "✅ Complete",
                priority: "High",
                owner: "Engineering",
              },
              {
                feature: "Table Views",
                status: "🔄 In Progress",
                priority: "High",
                owner: "Product",
              },
              {
                feature: "Advanced Filtering",
                status: "📋 Planned",
                priority: "Medium",
                owner: "Engineering",
              },
              {
                feature: "Mobile App",
                status: "💭 Backlog",
                priority: "Low",
                owner: "Design",
              },
            ].map((row, index) => (
              <div
                key={index}
                className="grid grid-cols-4 gap-4 rounded-lg border-b border-gray-100 py-3 transition-colors hover:bg-gray-50"
              >
                <div className="text-sm text-gray-900">{row.feature}</div>
                <div className="text-sm">{row.status}</div>
                <div className="text-sm">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      row.priority === "High"
                        ? "bg-red-100 text-red-800"
                        : row.priority === "Medium"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {row.priority}
                  </span>
                </div>
                <div className="text-sm text-gray-600">{row.owner}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          <div className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
              <svg
                className="h-6 w-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              AI with real business impact
            </h3>
            <p className="text-gray-600">
              In minutes, embed AI into your workflows to perform recurring
              actions. Shape AI to the unique context of your business, defined
              by the people closest to the work.
            </p>
          </div>

          <div className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
              <svg
                className="h-6 w-6 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              Create and evolve apps instantly
            </h3>
            <p className="text-gray-600">
              With Cobuilder, use AI to build apps in seconds. Keep iterating
              with intuitive drag-and-drop interfaces and automations.
            </p>
          </div>

          <div className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              Manage and govern apps at scale
            </h3>
            <p className="text-gray-600">
              Standardize processes on top of shared data sets. Centrally
              control data access and AI usage.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Homepage;
