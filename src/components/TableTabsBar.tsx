import React, { useEffect } from "react";
import { Plus } from "lucide-react";

interface Table {
  id: string;
  name: string;
}

interface TableTabsBarProps {
  tables: Table[];
  activeTableId: string | null;
  onTableSelect: (id: string) => void;
  onAddTable: () => void;
  showAddTableModal: boolean;
  setShowAddTableModal: (v: boolean) => void;
  newTableName: string;
  setNewTableName: (v: string) => void;
  addTableButtonRef: React.RefObject<HTMLButtonElement>;
  addTablePopupRef: React.RefObject<HTMLDivElement>;
  baseId: string;
}

const TableTabsBar: React.FC<TableTabsBarProps> = ({
  tables,
  activeTableId,
  onTableSelect,
  onAddTable,
  showAddTableModal,
  setShowAddTableModal,
  newTableName,
  setNewTableName,
  addTableButtonRef,
  addTablePopupRef,
  baseId,
}) => {
  // Click outside to close Add Table modal
  useEffect(() => {
    if (!showAddTableModal) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        addTablePopupRef.current &&
        !addTablePopupRef.current.contains(target) &&
        addTableButtonRef.current &&
        !addTableButtonRef.current.contains(target)
      ) {
        setShowAddTableModal(false);
        setNewTableName("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [
    showAddTableModal,
    setShowAddTableModal,
    setNewTableName,
    addTablePopupRef,
    addTableButtonRef,
  ]);

  return (
    <>
      <div className="min-w-0 flex-1">
        <div className="scrollbar-thin table-tabs-scrollbar overflow-x-auto">
          <div
            className="flex min-w-max items-center space-x-1 py-1"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {tables.map((table) => (
              <button
                key={table.id}
                onClick={() => onTableSelect(table.id)}
                className={`rounded px-3 py-1 text-sm font-medium ${
                  activeTableId === table.id
                    ? "bg-white bg-opacity-20 text-white"
                    : "text-white hover:bg-white hover:bg-opacity-10"
                }`}
              >
                {table.name.length > 30
                  ? table.name.slice(0, 30) + "..."
                  : table.name}
              </button>
            ))}
            {/* Add Table Button */}
            <button
              ref={addTableButtonRef}
              onClick={(e) => {
                e.stopPropagation();
                if (showAddTableModal) {
                  setShowAddTableModal(false);
                  setNewTableName("");
                } else {
                  setShowAddTableModal(true);
                }
              }}
              className="flex items-center gap-1 rounded px-3 py-1 text-sm font-medium text-white hover:bg-white hover:bg-opacity-10"
            >
              <Plus className="h-4 w-4" />
              Add Table
            </button>
          </div>
        </div>
      </div>

      {/* Add Table Fullscreen Modal */}
      {showAddTableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-20">
          <div
            ref={addTablePopupRef}
            className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
          >
            <div className="mb-4 text-lg font-semibold text-gray-900">
              Create Table
            </div>
            <input
              type="text"
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              placeholder="Table name"
              className="mb-6 w-full rounded border border-gray-400 px-4 py-2 text-base text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTableName.trim()) {
                  e.preventDefault();
                  onAddTable();
                }
              }}
            />
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowAddTableModal(false)}
                className="rounded px-2 py-1 text-base text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newTableName.trim()) {
                    onAddTable();
                  }
                }}
                className="rounded bg-blue-600 px-6 py-2 text-base font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
                disabled={!newTableName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TableTabsBar;
