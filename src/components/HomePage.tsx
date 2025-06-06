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
            {/* ...existing code... */}
          </button>
        )}
      </nav>
      {/* ...existing code... */}
      <p className="mb-4 text-green-700">
        You&apos;re signed in and ready to build amazing things.
      </p>
      {/* ...existing code... */}
    </div>
  );
};

export default Homepage;
