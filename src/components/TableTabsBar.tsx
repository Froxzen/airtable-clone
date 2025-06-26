import React from "react";
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
}) => (
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
);

export default TableTabsBar;
