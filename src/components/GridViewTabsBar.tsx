import React, { useRef, useEffect } from "react";
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
  // Add Grid View popup props
  newGridViewName: string;
  setNewGridViewName: (name: string) => void;
  handleCreateGridView: () => void;
  handleCancelAddGridView: () => void;
  addGridViewPopupRef: React.RefObject<HTMLDivElement>;
  addGridViewPopupPos: { top: number; left: number };
}

const GridViewTabsBar: React.FC<GridViewTabsBarProps> = ({
  gridViews,
  selectedGridViewId,
  onSelectGridView,
  showAddGridViewPopup,
  handleShowAddGridViewPopup,
  addGridViewButtonRef,
  newGridViewName,
  setNewGridViewName,
  handleCreateGridView,
  handleCancelAddGridView,
  addGridViewPopupRef,
  addGridViewPopupPos,
}) => {
  // Click outside to close Add Grid View popup
  useEffect(() => {
    if (!showAddGridViewPopup) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        addGridViewPopupRef.current &&
        !addGridViewPopupRef.current.contains(target) &&
        addGridViewButtonRef.current &&
        !addGridViewButtonRef.current.contains(target)
      ) {
        handleCancelAddGridView();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [
    showAddGridViewPopup,
    handleCancelAddGridView,
    addGridViewPopupRef,
    addGridViewButtonRef,
  ]);

  // If gridViews is empty, only render the grid view+ button
  if (!gridViews || gridViews.length === 0) {
    return (
      <>
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

        {/* Add Grid View Popup */}
        {showAddGridViewPopup && (
          <div
            ref={addGridViewPopupRef}
            className="absolute z-50 w-72 rounded border border-gray-200 bg-white p-4 shadow-lg"
            style={{
              top: addGridViewPopupPos.top,
              left: addGridViewPopupPos.left,
              position: "absolute",
            }}
          >
            <input
              type="text"
              className="mb-3 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              placeholder="Grid view name"
              value={newGridViewName}
              onChange={(e) => setNewGridViewName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newGridViewName.trim()) {
                  e.preventDefault();
                  handleCreateGridView();
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
                onClick={handleCancelAddGridView}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={handleCreateGridView}
                disabled={!newGridViewName.trim()}
                type="button"
              >
                Create new view
              </button>
            </div>
          </div>
        )}
      </>
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

      {/* Add Grid View Popup */}
      {showAddGridViewPopup && (
        <div
          ref={addGridViewPopupRef}
          className="absolute z-50 w-72 rounded border border-gray-200 bg-white p-4 shadow-lg"
          style={{
            top: addGridViewPopupPos.top,
            left: addGridViewPopupPos.left,
            position: "absolute",
          }}
        >
          <input
            type="text"
            className="mb-3 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
            placeholder="Grid view name"
            value={newGridViewName}
            onChange={(e) => setNewGridViewName(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && newGridViewName.trim()) {
                e.preventDefault();
                handleCreateGridView();
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <button
              className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
              onClick={handleCancelAddGridView}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={handleCreateGridView}
              disabled={!newGridViewName.trim()}
              type="button"
            >
              Create new view
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default GridViewTabsBar;
