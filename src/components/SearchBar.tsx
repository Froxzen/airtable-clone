import React, { useRef, useEffect } from "react";
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
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts: Ctrl+F to focus, Escape to clear and blur
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (
        event.key === "Escape" &&
        document.activeElement === inputRef.current
      ) {
        onChange("");
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onChange]);

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 focus:border-purple-400 focus:outline-none"
        disabled={disabled}
      />
      <span className="pointer-events-none absolute right-2 top-2 text-gray-400">
        <Search className="h-4 w-4" />
      </span>
    </div>
  );
};

export default SearchBar;
