import React, { useState, useRef, useEffect } from "react";
import { type Column } from "~/types";
import { type Filter } from "~/server/api/routers/base";
import { X } from "lucide-react";

interface FilterProps {
  columns: Column[];
  filters: Filter[];
  onAddFilter: (filter: Omit<Filter, "id">) => void;
  onRemoveFilter: (filterId: string) => void;
  onUpdateFilter: (filter: Filter) => void;
  filterType: "TEXT" | "NUMBER";
  buttonLabel: string;
  disabled?: boolean;
}

const TEXT_CONDITIONS = [
  { value: "contains", label: "contains" },
  { value: "notContains", label: "does not contain" },
  { value: "equals", label: "is" },
  { value: "notEquals", label: "is not" },
  { value: "isEmpty", label: "is empty" },
  { value: "isNotEmpty", label: "is not empty" },
];

const NUMBER_CONDITIONS = [
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
];

const FilterComponent: React.FC<FilterProps> = ({
  columns,
  filters,
  onAddFilter,
  onRemoveFilter,
  onUpdateFilter,
  filterType,
  buttonLabel,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const relevantColumns = columns.filter((c) => c.type === filterType);

  const handleAddFilter = () => {
    const firstColumn = relevantColumns[0];
    if (firstColumn) {
      const isText = firstColumn.type === "TEXT";
      onAddFilter({
        columnId: firstColumn.id,
        columnType: firstColumn.type,
        condition: isText ? "contains" : "gt",
        value: isText ? "" : "0",
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Remove incomplete filters automatically, but only if the popup isn't open
  useEffect(() => {
    if (!isOpen) {
      const incompleteFilters = filters.filter((f) => {
        if (f.condition === "isEmpty" || f.condition === "isNotEmpty")
          return false;
        return String(f.value ?? "").trim() === "";
      });
      if (incompleteFilters.length > 0) {
        incompleteFilters.forEach((f) => onRemoveFilter(f.id));
      }
    }
    // Only run when filters or isOpen change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, isOpen]);

  const relevantFilters = filters.filter((f) =>
    relevantColumns.some((c) => c.id === f.columnId)
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => !disabled && setIsOpen((v) => !v)}
        // Highlighting and text logic for filtered state
        className={(() => {
          // Only count filters where all values are inputted
          const validFilters = filters.filter((f) => {
            if (f.condition === "isEmpty" || f.condition === "isNotEmpty")
              return true;
            return String(f.value ?? "").trim() !== "";
          });
          // Unique column names only
          const filterNames = Array.from(
            new Set(
              validFilters
                .map((f) => columns.find((c) => c.id === f.columnId)?.name)
                .filter(Boolean)
            )
          );
          const isFiltered = filterNames.length > 0;
          const isNameFilter = validFilters.some((f) => {
            const col = columns.find((c) => c.id === f.columnId);
            return col && col.name.toLowerCase() === "name";
          });
          let baseClass =
            "flex items-center gap-1 rounded px-3 py-1 text-sm font-medium shadow ";
          if (disabled)
            baseClass +=
              " pointer-events-none opacity-50 disabled:cursor-not-allowed disabled:opacity-50";
          if (isFiltered && isNameFilter) {
            baseClass += " border border-cyan-300 bg-cyan-100 text-cyan-900";
          } else if (isFiltered) {
            baseClass += " border border-green-300 bg-green-200 text-green-900";
          } else {
            baseClass += " bg-white text-gray-600 hover:bg-gray-100";
          }
          return baseClass;
        })()}
        disabled={disabled}
        type="button"
        style={{
          maxWidth: 240,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {(() => {
          // Only count filters where all values are inputted
          const validFilters = filters.filter((f) => {
            if (f.condition === "isEmpty" || f.condition === "isNotEmpty")
              return true;
            return String(f.value ?? "").trim() !== "";
          });
          // Unique column names only
          const filterNames = Array.from(
            new Set(
              validFilters
                .map((f) => columns.find((c) => c.id === f.columnId)?.name)
                .filter(Boolean)
            )
          );
          if (filterNames.length > 0) {
            let filterText = filterNames.join(", ");
            if (filterText.length > 30)
              filterText = filterText.slice(0, 30) + "...";
            return `Filtered by ${filterText}`;
          }
          return buttonLabel;
        })()}
      </button>

      {isOpen && (
        <div
          ref={popupRef}
          className="absolute left-0 top-full z-30 mt-2 w-[500px] max-w-lg rounded border bg-white p-4 shadow-lg"
        >
          <div className="mb-4 text-sm text-gray-500">
            In this view, show records
          </div>

          {relevantFilters.map((filter) => (
            <div
              key={filter.id}
              className="mb-2 grid grid-cols-[auto_1fr_1fr_1fr_auto] items-center gap-2"
            >
              <span className="text-sm text-gray-500">Where</span>
              {/* Column Selector */}
              <select
                value={filter.columnId}
                onChange={(e) => {
                  const newColumnId = e.target.value;
                  const newColumn = columns.find((c) => c.id === newColumnId);
                  if (newColumn) {
                    const isText = newColumn.type === "TEXT";
                    onUpdateFilter({
                      ...filter,
                      columnId: newColumn.id,
                      columnType: newColumn.type,
                      condition: isText ? "contains" : "gt",
                      value: isText ? "" : "0",
                    });
                  }
                }}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-purple-500 focus:ring-purple-500"
              >
                {relevantColumns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>{" "}
              {/* Condition Selector */}
              <select
                value={filter.condition}
                onChange={(e) =>
                  onUpdateFilter({
                    ...filter,
                    condition: e.target.value,
                    value:
                      filter.columnType === "NUMBER"
                        ? (filter.value as string) || "0"
                        : "",
                  })
                }
                className="rounded border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-purple-500 focus:ring-purple-500"
              >
                {(filter.columnType === "TEXT"
                  ? TEXT_CONDITIONS
                  : NUMBER_CONDITIONS
                ).map((cond) => (
                  <option key={cond.value} value={cond.value}>
                    {cond.label}
                  </option>
                ))}
              </select>
              {/* Value Input */}
              <div className="relative">
                {filter.condition !== "isEmpty" &&
                  filter.condition !== "isNotEmpty" && (
                    <input
                      type={filter.columnType === "NUMBER" ? "number" : "text"}
                      value={String(filter.value ?? "")}
                      onChange={(e) =>
                        onUpdateFilter({ ...filter, value: e.target.value })
                      }
                      className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-purple-500 focus:ring-purple-500"
                      placeholder="Enter a value"
                    />
                  )}
              </div>
              <button
                onClick={() => onRemoveFilter(filter.id)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          ))}

          <button
            onClick={handleAddFilter}
            disabled={relevantColumns.length === 0}
            className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-800 disabled:cursor-not-allowed disabled:text-gray-400"
          >
            + Add condition
          </button>
        </div>
      )}
    </div>
  );
};

export default FilterComponent;
