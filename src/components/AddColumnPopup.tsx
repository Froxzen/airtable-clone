import React, { useEffect } from "react";
import {
  Bars3BottomLeftIcon,
  HashtagIcon,
} from "@heroicons/react/24/outline";

interface AddColumnPopupProps {
  isOpen: boolean;
  onClose: () => void;
  newColumnName: string;
  setNewColumnName: (name: string) => void;
  onAddColumn: (type: "TEXT" | "NUMBER") => void;
  addColumnButtonRef: React.RefObject<HTMLButtonElement>;
  addColumnPopupRef: React.RefObject<HTMLDivElement>;
}

const AddColumnPopup: React.FC<AddColumnPopupProps> = ({
  isOpen,
  onClose,
  newColumnName,
  setNewColumnName,
  onAddColumn,
  addColumnButtonRef,
  addColumnPopupRef,
}) => {
  // Click outside to close popup
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        addColumnPopupRef.current &&
        !addColumnPopupRef.current.contains(target) &&
        addColumnButtonRef.current &&
        !addColumnButtonRef.current.contains(target)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, addColumnPopupRef, addColumnButtonRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={addColumnPopupRef}
      className="absolute z-20 w-56 rounded-md border border-gray-200 bg-white p-2 shadow-lg"
      style={{
        top:
          (addColumnButtonRef.current?.getBoundingClientRect().bottom ?? 0) +
          window.scrollY,
        left:
          (addColumnButtonRef.current?.getBoundingClientRect().right ?? 0) +
          window.scrollX,
        transform: "translateX(-100%)",
      }}
    >
      <input
        type="text"
        value={newColumnName}
        onChange={(e) => setNewColumnName(e.target.value)}
        placeholder="Column name"
        className="my-2 w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter" && newColumnName.trim()) {
            e.preventDefault();
            onAddColumn("TEXT");
          }
        }}
      />
      <div className="border-t border-gray-200 pt-2">
        <div className="mb-1 px-1 text-xs font-semibold text-gray-500">
          SELECT A FIELD TYPE
        </div>
        <button
          onClick={() => onAddColumn("TEXT")}
          className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!newColumnName.trim()}
        >
          <Bars3BottomLeftIcon className="h-4 w-4" />
          Text
        </button>
        <button
          onClick={() => onAddColumn("NUMBER")}
          className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!newColumnName.trim()}
        >
          <HashtagIcon className="h-4 w-4" />
          Number
        </button>
      </div>
    </div>
  );
};

export default AddColumnPopup;
