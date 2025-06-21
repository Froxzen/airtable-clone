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

  const relevantFilters = filters.filter((f) =>
    relevantColumns.some((c) => c.id === f.columnId)
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1 rounded bg-white px-3 py-1 text-sm font-medium text-gray-600 shadow hover:bg-gray-100"
      >
        {buttonLabel}
      </button>

      {isOpen && (
        <div
          ref={popupRef}
          className="absolute left-0 top-full z-10 mt-2 w-[500px] max-w-lg rounded border bg-white p-4 shadow-lg"
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
              </select>              {/* Condition Selector */}
              <select
                value={filter.condition}
                onChange={(e) =>
                  onUpdateFilter({
                    ...filter,
                    condition: e.target.value,
                    value: filter.columnType === "NUMBER" ? (filter.value || "0") : "",
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
                      value={filter.value}
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
