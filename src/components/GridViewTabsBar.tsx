import React from "react";
import { Check, Plus, Grid3X3 } from "lucide-react";

interface GridView {
  id: string;
  name: string;
}

interface GridViewTabsBarProps {
  gridViews: GridView[];
  selectedGridViewId: string | null;
  onSelectGridView: (id: string) => void;
  showAddGridViewPopup: boolean;
  handleShowAddGridViewPopup: (e: React.MouseEvent<HTMLDivElement>) => void;
  addGridViewButtonRef: React.RefObject<HTMLDivElement>;
}

const GridViewTabsBar: React.FC<GridViewTabsBarProps> = ({
  gridViews,
  selectedGridViewId,
  onSelectGridView,
  showAddGridViewPopup,
  handleShowAddGridViewPopup,
  addGridViewButtonRef,
}) => {
  // If gridViews is empty, only render the grid view+ button
  if (!gridViews || gridViews.length === 0) {
    return (
      <div
        ref={addGridViewButtonRef}
        className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        onClick={handleShowAddGridViewPopup}
      >
        <div className="flex items-center gap-2">
          <Grid3X3 className="h-4 w-4" />
          <span>Grid view</span>
        </div>
        <Plus className="h-4 w-4" />
      </div>
    );
  }

  return (
    <>
      {/* Scrollable grid views if 5 or more */}
      <div
        className={
          gridViews && gridViews.length >= 5
            ? "custom-scrollbar max-h-36 space-y-1 overflow-y-auto pr-1"
            : "space-y-1"
        }
        style={
          gridViews && gridViews.length >= 5
            ? { WebkitOverflowScrolling: "touch" }
            : {}
        }
      >
        {/* Main Grid View (no plus, tick if selected) - always show */}
        <div
          key={gridViews?.[0]?.id || "main-grid-view"}
          className={`flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm ${
            selectedGridViewId === gridViews?.[0]?.id
              ? "bg-blue-100 font-semibold text-blue-700"
              : "text-gray-700 hover:bg-gray-100"
          }`}
          onClick={() => gridViews?.[0] && onSelectGridView(gridViews[0].id)}
        >
          <div className="flex items-center gap-2">
            <Grid3X3 className="h-4 w-4" />
            <span>{gridViews?.[0]?.name || "Grid view"}</span>
          </div>
          {selectedGridViewId === gridViews?.[0]?.id && (
            <Check className="h-4 w-4 text-blue-600" />
          )}
        </div>
        {/* Additional Grid Views (clones) */}
        {gridViews?.slice(1).map((view) => (
          <div
            key={view.id}
            className={`flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm ${
              selectedGridViewId === view.id
                ? "bg-blue-100 font-semibold text-blue-700"
                : "text-gray-700 hover:bg-gray-100"
            }`}
            onClick={() => onSelectGridView(view.id)}
          >
            <div className="flex items-center gap-2">
              <Grid3X3 className="h-4 w-4" />
              <span>{view.name}</span>
            </div>
            {selectedGridViewId === view.id ? (
              <Check className="h-4 w-4 text-blue-600" />
            ) : (
              <Plus className="h-4 w-4 opacity-0" />
            )}
          </div>
        ))}
      </div>
      {/* Grid view + row (to add new grid view) */}
      <div
        ref={addGridViewButtonRef}
        className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        onClick={handleShowAddGridViewPopup}
      >
        <div className="flex items-center gap-2">
          <Grid3X3 className="h-4 w-4" />
          <span>Grid view</span>
        </div>
        <Plus className="h-4 w-4" />
      </div>
    </>
  );
};

export default GridViewTabsBar;
