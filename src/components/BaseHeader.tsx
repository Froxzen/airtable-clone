import React from "react";
import Image from "next/image";

interface BaseHeaderProps {
  baseName: string;
  userImage?: string;
  onSignOut: () => void;
  showProfileMenu: boolean;
  setShowProfileMenu: (v: boolean) => void;
  children?: React.ReactNode;
  baseColorClass?: string;
}

const BaseHeader: React.FC<BaseHeaderProps> = ({
  baseName,
  userImage,
  onSignOut,
  showProfileMenu,
  setShowProfileMenu,
  children,
  baseColorClass = "bg-purple-500",
}) => (
  <div
    className={`flex h-16 items-center px-6 py-4 text-sm text-white ${baseColorClass}`}
  >
    <div className="flex items-center space-x-4">
      <Image
        src="/logo.svg"
        alt="Logo"
        width={24}
        height={24}
        className="h-6 w-6"
        priority
      />
      <div className="flex items-center space-x-1">
        <span className="text-xl font-bold">{baseName}</span>
      </div>
    </div>
    <div className="relative ml-auto flex items-center space-x-4">
      {children}
      {userImage && (
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="focus:outline-none"
          >
            <Image
              src={userImage}
              alt="Profile"
              width={32}
              height={32}
              className="h-8 w-8 rounded-full border-2 border-white shadow"
            />
          </button>
          {showProfileMenu && (
            <div className="absolute right-0 z-50 mt-2 w-40 rounded bg-white py-2 shadow-lg">
              <button
                onClick={onSignOut}
                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  </div>
);

export default BaseHeader;
