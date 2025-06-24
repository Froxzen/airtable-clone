import React from "react";
import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = "Find...",
  className = "",
}) => {
  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 focus:border-purple-400 focus:outline-none w-full"
        disabled={disabled}
      />
      <span className="absolute right-2 top-2 text-gray-400 pointer-events-none">
        <Search className="h-4 w-4" />
      </span>
    </div>
  );
};

export default SearchBar;
