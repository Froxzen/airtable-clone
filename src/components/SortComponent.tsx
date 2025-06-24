import React, { useRef, useEffect } from "react";
import { X } from "lucide-react";
import type { Sort, Column } from "../types";
import { SortAsc } from "lucide-react";

interface SortComponentProps {
  columns: Column[];
  sorts: Sort[];
  setSorts: React.Dispatch<React.SetStateAction<Sort[]>>;
  showSort: boolean;
  setShowSort: React.Dispatch<React.SetStateAction<boolean>>;
  sortButtonRef: React.RefObject<HTMLButtonElement>;
}

const SortComponent: React.FC<SortComponentProps> = ({
  columns,
  sorts,
  setSorts,
  showSort,
  setShowSort,
  sortButtonRef,
}) => {
  const sortPopupRef = useRef<HTMLDivElement>(null);

  // Compute available columns for new sort
  const usedColumnIds = sorts.map((s) => s.columnId);
  const availableColumns = columns.filter(
    (col) => !usedColumnIds.includes(col.id)
  );

  // Close popup on outside click
  useEffect(() => {
    if (!showSort) return;
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (
        sortPopupRef.current &&
        !sortPopupRef.current.contains(target) &&
        sortButtonRef.current &&
        !sortButtonRef.current.contains(target)
      ) {
        setShowSort(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSort, setShowSort, sortButtonRef]);

  return (
    <div className="relative inline-block">
      {sorts && sorts.length > 0 ? (
        <button
          ref={sortButtonRef}
          onClick={() => setShowSort(!showSort)}
          className={
            `flex items-center gap-1 rounded border border-yellow-300 bg-yellow-200 px-3 py-1 text-sm font-medium text-yellow-900 shadow` +
            ` disabled:cursor-not-allowed disabled:opacity-50`
          }
          type="button"
          disabled={false}
        >
          <SortAsc className="h-4 w-4" />
          Sorted by {sorts.length} field{sorts.length > 1 ? "s" : ""}
        </button>
      ) : (
        <button
          ref={sortButtonRef}
          onClick={() => setShowSort(!showSort)}
          className={`flex items-center gap-1 rounded bg-white px-3 py-1 text-sm font-medium text-gray-600 shadow hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50`}
          type="button"
          disabled={false}
        >
          <SortAsc className="h-4 w-4" />
          Sort
        </button>
      )}
      {/* Sort Popup */}
      {showSort && (
        <div
          ref={sortPopupRef}
          className="absolute left-0 top-full z-30 mt-2 w-[500px] max-w-lg rounded border bg-white p-4 shadow-lg"
        >
          <div className="mb-4 text-sm text-gray-500">
            Sort records in this view
          </div>
          <div className="space-y-2">
            {sorts.map((sort, index) => {
              // Only allow columns not already used by other sorts
              const otherUsed = sorts
                .filter((_, i) => i !== index)
                .map((s) => s.columnId);
              const selectableColumns = columns.filter(
                (col) => !otherUsed.includes(col.id)
              );
              return (
                <div
                  key={index}
                  className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2"
                >
                  <span className="text-sm text-gray-500">
                    {index === 0 ? "Sort by" : "Then by"}
                  </span>
                  <select
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-purple-500 focus:ring-purple-500"
                    value={sort.columnId}
                    onChange={(e) =>
                      setSorts((prev) =>
                        prev.map((s, i) =>
                          i === index ? { ...s, columnId: e.target.value } : s
                        )
                      )
                    }
                  >
                    <option value="">Select a column</option>
                    {selectableColumns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-purple-500 focus:ring-purple-500"
                    value={sort.direction}
                    onChange={(e) =>
                      setSorts((prev) =>
                        prev.map((s, i) =>
                          i === index
                            ? {
                                ...s,
                                direction: e.target.value as "asc" | "desc",
                              }
                            : s
                        )
                      )
                    }
                  >
                    <option value="">Select an order</option>
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                  <button
                    onClick={() =>
                      setSorts((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
            {sorts.length === 0 && (
              <div className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2">
                <span className="text-sm text-gray-500">Sort by</span>
                <select
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-purple-500 focus:ring-purple-500"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      setSorts([
                        { columnId: e.target.value, direction: "asc" },
                      ]);
                    }
                  }}
                >
                  <option value="">Select a column</option>
                  {columns.map((col: Column) => (
                    <option key={col.id} value={col.id}>
                      {col.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-purple-500 focus:ring-purple-500"
                  disabled
                >
                  <option value="">Select an order</option>
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
                <div className="w-4"></div>
              </div>
            )}
            {sorts.length > 0 && sorts.length < 3 && (
              <button
                onClick={() =>
                  setSorts((prev) => [
                    ...prev,
                    { columnId: "", direction: "asc" },
                  ])
                }
                className="text-sm text-purple-600 hover:text-purple-700"
              >
                + Add another sort
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SortComponent;
