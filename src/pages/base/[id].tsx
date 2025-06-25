import React, { useState, useRef, useEffect, useMemo } from "react";
import { trpc } from "~/utils/api";
import { useRouter } from "next/router";
import { useSession, signOut } from "next-auth/react";
import {
  Check,
  Plus,
  Grid3X3,
  ChevronDown,
  Settings,
  Search,
  Trash2,
} from "lucide-react";
import { Bars3BottomLeftIcon, HashtagIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import { useVirtualizer } from "@tanstack/react-virtual";
import { type Prisma } from "@prisma/client";
import { type Sort, type Column } from "~/types";
import { type Filter as FilterType } from "~/server/api/routers/base";
import FilterComponent from "~/components/FilterComponent";
import AddManyRowsButton from "../../components/AddManyRowsButton";
import SortComponent from "../../components/SortComponent";
import SearchBar from "../../components/SearchBar";

const AirtableClone = () => {
  // =============================
  // State and Refs
  // =============================

  const router = useRouter();
  const baseId = router.query.id as string;
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const addTableButtonRef = useRef<HTMLButtonElement>(null);
  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: number;
  } | null>(null);

  // State for expanded cell editing
  const [expandedCell, setExpandedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [expandedCellValue, setExpandedCellValue] = useState<string>("");

  const [newColumnName, setNewColumnName] = useState("");

  const { data: session } = useSession();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Add local state for cell values during editing
  const [localCellValues, setLocalCellValues] = useState<
    Record<string, string>
  >({});
  const [searchTerm, setSearchTerm] = useState("");
  const [textFilters, setTextFilters] = useState<FilterType[]>([]);
  const [numberFilters, setNumberFilters] = useState<FilterType[]>([]);
  const allFilters = useMemo(
    () => [...textFilters, ...numberFilters],
    [textFilters, numberFilters]
  );

  const [sorts, setSorts] = useState<Sort[]>([]);
  const [sortingFrozen, setSortingFrozen] = useState(false);
  const sortingUnfreezeTimeout = useRef<NodeJS.Timeout | null>(null);

  // =============================
  // Effects: Load/Persist Filters, Sorts, Table Selection
  // =============================

  const [showSort, setShowSort] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sortPopupRef = useRef<HTMLDivElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const addTablePopupRef = useRef<HTMLDivElement>(null);

  // State for temporary row display
  const [tempRowIds, setTempRowIds] = useState<Set<string>>(new Set());
  const [animatingOutRowIds, setAnimatingOutRowIds] = useState<Set<string>>(
    new Set()
  );

  // Fetch base with all tables
  const { data: baseWithTables } = trpc.base.getById.useQuery(
    { id: baseId },
    { enabled: !!baseId }
  );
  // Set active table to first table if none selected
  useEffect(() => {
    if (
      baseWithTables?.tables &&
      baseWithTables.tables.length > 0 &&
      !activeTableId
    ) {
      setActiveTableId(baseWithTables.tables[0]?.id ?? null);
    }
  }, [baseWithTables, activeTableId]);

  // Fetch current table data
  const { data: currentTable } = trpc.base.getTableById.useQuery(
    activeTableId ? { tableId: activeTableId } : { tableId: "" },
    { enabled: !!activeTableId }
  ) as { data: { columns: Column[] } | undefined };

  const base = currentTable;

  // =============================
  // Grid Views State & Handlers (per-table)
  // =============================
  const { data: gridViewsData, refetch: refetchGridViews } =
    trpc.base.getGridViews.useQuery(
      activeTableId ? { tableId: activeTableId } : { tableId: "" },
      { enabled: !!activeTableId }
    );
  const createGridView = trpc.base.createGridView.useMutation({
    onSuccess: () => refetchGridViews(),
  });
  const updateGridView = trpc.base.updateGridView.useMutation({
    onSuccess: () => refetchGridViews(),
  });

  const [selectedGridViewId, setSelectedGridViewId] = useState<string | null>(
    null
  );

  // Add state and refs for Add Grid View popup
  const [showAddGridViewPopup, setShowAddGridViewPopup] = useState(false);
  const [newGridViewName, setNewGridViewName] = useState("");
  const addGridViewButtonRef = useRef<HTMLDivElement>(null);
  const addGridViewPopupRef = useRef<HTMLDivElement>(null);
  const [addGridViewPopupPos, setAddGridViewPopupPos] = useState({
    top: 0,
    left: 0,
  });

  // Handler to show Add Grid View popup
  const handleShowAddGridViewPopup = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (showAddGridViewPopup) {
      setShowAddGridViewPopup(false);
      setNewGridViewName("");
    } else {
      // Position popup to the right of the button
      if (addGridViewButtonRef.current) {
        const rect = addGridViewButtonRef.current.getBoundingClientRect();
        setAddGridViewPopupPos({
          top: rect.top + window.scrollY,
          left: rect.right + window.scrollX,
        });
      }
      // Prefill with 'Grid {number of grid views + 1}'
      const nextNumber = (gridViewsData ? gridViewsData.length : 0) + 1;
      setNewGridViewName(`Grid ${nextNumber}`);
      setShowAddGridViewPopup(true);
    }
  };

  // Handler to create a new grid view
  const handleCreateGridView = () => {
    if (!activeTableId || !newGridViewName.trim()) return;
    createGridView.mutate({
      tableId: activeTableId,
      name: newGridViewName.trim(),
      filter: null,
      sort: null,
    });
    setShowAddGridViewPopup(false);
    setNewGridViewName("");
  };

  // Handler to cancel Add Grid View popup
  const handleCancelAddGridView = () => {
    setShowAddGridViewPopup(false);
    setNewGridViewName("");
  };

  // When grid views or table changes, select the first grid view by default
  useEffect(() => {
    if (!activeTableId || !gridViewsData || gridViewsData.length === 0) {
      setSelectedGridViewId(null);
      return;
    }
    // If current selected is not in the list, select the first
    if (
      !selectedGridViewId ||
      !gridViewsData.some((v) => v.id === selectedGridViewId)
    ) {
      if (gridViewsData[0]) setSelectedGridViewId(gridViewsData[0].id);
    }
  }, [activeTableId, gridViewsData, selectedGridViewId]);

  const handleSelectGridView = (id: string) => {
    setSelectedGridViewId(id);
  };

  // Calculate base color (same logic as dashboard)
  const getBaseColor = useMemo(() => {
    if (!baseWithTables?.id) return "bg-purple-500";

    const colors = [
      "bg-red-500",
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-yellow-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-teal-500",
      "bg-orange-500",
      "bg-cyan-500",
      "bg-lime-500",
      "bg-amber-500",
      "bg-rose-500",
      "bg-fuchsia-500",
      "bg-violet-500",
      "bg-emerald-500",
      "bg-sky-500",
      "bg-gray-500",
    ];

    function hashString(id: string) {
      let hash = 0;
      for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
      }
      return Math.abs(hash);
    }

    return colors[hashString(baseWithTables.id) % colors.length];
  }, [baseWithTables?.id]);

  const getSecondaryBaseColor = useMemo(() => {
    if (!baseWithTables?.id) return "bg-purple-600";

    const colors = [
      "bg-red-600",
      "bg-blue-600",
      "bg-green-600",
      "bg-purple-600",
      "bg-yellow-600",
      "bg-pink-600",
      "bg-indigo-600",
      "bg-teal-600",
      "bg-orange-600",
      "bg-cyan-600",
      "bg-lime-600",
      "bg-amber-600",
      "bg-rose-600",
      "bg-fuchsia-600",
      "bg-violet-600",
      "bg-emerald-600",
      "bg-sky-600",
      "bg-gray-600",
    ];

    function hashString(id: string) {
      let hash = 0;
      for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
      }
      return Math.abs(hash);
    }
    return colors[hashString(baseWithTables.id) % colors.length];
  }, [baseWithTables?.id]);

  const utils = trpc.useUtils();
  const cellUpdateTimeouts = useRef(new Map<string, NodeJS.Timeout>());

  const isSortActive = sorts.length > 0;
  const isFilterActive = allFilters.length > 0;
  const isClearActive = isSortActive || isFilterActive;

  const PAGE_SIZE = 5000; // Optimized for fast scrolling - loads more data per request
  const [showAddColumnPopup, setShowAddColumnPopup] = useState(false);
  const addColumnButtonRef = useRef<HTMLButtonElement>(null);
  const addColumnPopupRef = useRef<HTMLDivElement>(null);
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.base.getRowsInfinite.useInfiniteQuery(
    activeTableId
      ? {
          tableId: activeTableId,
          limit: PAGE_SIZE,
          filters: allFilters,
          sortConfig: sorts,
        }
      : {
          tableId: "",
          limit: PAGE_SIZE,
          filters: allFilters,
          sortConfig: sorts,
        },
    {
      enabled: !!activeTableId,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      keepPreviousData: true,
    }
  );

  // =============================
  // Data Fetching: Base, Table, Rows
  // =============================

  const handleAddTextFilter = (filter: Omit<FilterType, "id">) => {
    setTextFilters((prev) => [
      ...prev,
      { ...filter, id: `filter-${Date.now()}` },
    ]);
  };

  const handleRemoveTextFilter = (filterId: string) => {
    setTextFilters((prev) => prev.filter((f) => f.id !== filterId));
  };

  const handleUpdateTextFilter = (filter: FilterType) => {
    setTextFilters((prev) =>
      prev.map((f) => (f.id === filter.id ? filter : f))
    );
  };

  const handleAddNumberFilter = (filter: Omit<FilterType, "id">) => {
    setNumberFilters((prev) => [
      ...prev,
      { ...filter, id: `filter-${Date.now()}` },
    ]);
  };

  const handleRemoveNumberFilter = (filterId: string) => {
    setNumberFilters((prev) => prev.filter((f) => f.id !== filterId));
  };

  const handleUpdateNumberFilter = (filter: FilterType) => {
    setNumberFilters((prev) =>
      prev.map((f) => (f.id === filter.id ? filter : f))
    );
  };

  // =============================
  // Memoized/Derived Data
  // =============================

  // Define a Row type for allRows and processedRows

  type Row = {
    id: string;
    data: Record<string, unknown>;
  };

  // Fix allRows type and mapping
  const allRows = useMemo(
    () =>
      infiniteData?.pages.flatMap((page) =>
        page.rows.map(
          (row: { id: string; tableId: string; data: unknown }) => ({
            id: row.id,
            tableId: row.tableId,
            data:
              row.data &&
              typeof row.data === "object" &&
              !Array.isArray(row.data)
                ? (row.data as Record<string, unknown>)
                : {},
          })
        )
      ) ?? [],
    [infiniteData]
  );

  // Helper function to check if cell matches search
  const cellMatchesSearch = (value: string, searchTerm: string): boolean => {
    if (!searchTerm.trim()) return false;
    return value.toLowerCase().includes(searchTerm.toLowerCase());
  };

  // Single computed variable that handles filtering and searched
  const processedRows = useMemo(() => {
    if (!allRows.length) return [];

    let rows = allRows;

    // Apply sorting if there are sorts and sorting is not frozen
    if (sorts.length > 0 && !sortingFrozen) {
      rows = rows.sort((a, b) => {
        // Keep temporary rows at the end during their display period
        if (tempRowIds.has(a.id) && !tempRowIds.has(b.id)) return 1;
        if (!tempRowIds.has(a.id) && tempRowIds.has(b.id)) return -1;
        if (tempRowIds.has(a.id) && tempRowIds.has(b.id)) return 0;

        for (const sort of sorts) {
          const { columnId, direction } = sort;
          const aVal = a.data[columnId];
          const bVal = b.data[columnId];

          const column = base?.columns.find((c) => c.id === columnId);

          let comparison = 0;

          if (column?.type === "NUMBER") {
            // Handle null/undefined/empty values properly
            const aIsEmpty = aVal === null || aVal === undefined || aVal === "";
            const bIsEmpty = bVal === null || bVal === undefined || bVal === "";

            // If both are empty, they're equal
            if (aIsEmpty && bIsEmpty) {
              comparison = 0;
            }
            // Empty values go to the end (treated as larger)
            else if (aIsEmpty && !bIsEmpty) {
              comparison = 1;
            } else if (!aIsEmpty && bIsEmpty) {
              comparison = -1;
            }
            // Both have values, compare as numbers
            else {
              const aNum = Number(aVal);
              const bNum = Number(bVal);

              // Handle NaN cases
              if (isNaN(aNum) && isNaN(bNum)) {
                comparison = 0;
              } else if (isNaN(aNum)) {
                comparison = 1;
              } else if (isNaN(bNum)) {
                comparison = -1;
              } else {
                comparison = aNum - bNum;
              }
            }
          } else {
            // Text sorting
            const aStr = (aVal ?? "").toString().toLowerCase();
            const bStr = (bVal ?? "").toString().toLowerCase();
            if (aStr < bStr) comparison = -1;
            else if (aStr > bStr) comparison = 1;
            else comparison = 0;
          }

          if (comparison !== 0) {
            return direction === "asc" ? comparison : -comparison;
          }
        }
        return 0;
      });
    }

    // Apply column filters (moved outside of the sorting block)
    if (allFilters.length > 0) {
      rows = rows.filter((row) => {
        // Always show temporary rows during their display period
        if (tempRowIds.has(row.id)) return true;

        return allFilters.every((filter) => {
          const columnId = filter.columnId;
          const columnType = filter.columnType;
          const condition = filter.condition;
          const value = filter.value as unknown;
          const cellValue = row.data[columnId];

          if (columnType === "TEXT") {
            const str = String(cellValue ?? "").toLowerCase();
            const filterVal = String(value ?? "").toLowerCase();
            if (condition === "contains") return str.includes(filterVal);
            if (condition === "notContains") return !str.includes(filterVal);
            if (condition === "equals") return str === filterVal;
            if (condition === "notEquals") return str !== filterVal;
            if (condition === "isEmpty") return !str;
            if (condition === "isNotEmpty") return !!str;
          } else if (columnType === "NUMBER") {
            const filterNum = Number(value);

            // If filter value is not a valid number, skip this filter
            if (isNaN(filterNum)) return true;

            // Convert cell value to number, treat empty/null as 0
            const cellNum =
              cellValue === null || cellValue === undefined || cellValue === ""
                ? 0
                : Number(cellValue);

            // If cell value is not a valid number, treat as 0
            const finalCellNum = isNaN(cellNum) ? 0 : cellNum;

            if (condition === "gt") return finalCellNum > filterNum;
            if (condition === "lt") return finalCellNum < filterNum;
          }

          return true;
        });
      });
    }

    return rows;
  }, [allRows, allFilters, sorts, base?.columns, tempRowIds, sortingFrozen]);

  // Create a stable key for the virtualizer to prevent unnecessary re-renders
  const virtualizerKey = useMemo(() => {
    return `${allFilters.length}-${sorts.length}-${searchTerm}-${processedRows.length}`;
  }, [allFilters.length, sorts.length, searchTerm, processedRows.length]);

  // =============================
  // Virtualization Setup
  // =============================

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: processedRows.length + 1, // +1 for placeholder row
    estimateSize: () => 40,
    getScrollElement: () => tableContainerRef.current,
    overscan: 25, // Increased for smoother fast scrolling
    // Preserve scroll position when data changes
    scrollToFn: (offset, options) => {
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTo({
          top: offset,
          ...options,
        });
      }
    },
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  // Preserve scroll position when filters/sorts change
  const lastScrollTop = useRef(0);
  const isScrolling = useRef(false);

  useEffect(() => {
    if (tableContainerRef.current && !isScrolling.current) {
      lastScrollTop.current = tableContainerRef.current.scrollTop;
    }
  }, [allFilters, sorts]);

  // Restore scroll position after data changes
  useEffect(() => {
    if (tableContainerRef.current && lastScrollTop.current > 0) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (tableContainerRef.current) {
          isScrolling.current = true;
          tableContainerRef.current.scrollTop = lastScrollTop.current;
          // Reset the flag after a short delay
          setTimeout(() => {
            isScrolling.current = false;
          }, 100);
        }
      });
    }
  }, [processedRows.length]);

  // Add scroll event listener to track manual scrolling
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (!isScrolling.current) {
        lastScrollTop.current = container.scrollTop;
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Infinite scroll logic
  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) {
      return;
    } // Load next page earlier when scrolling fast - trigger at 100 rows before end
    if (
      lastItem.index >= processedRows.length - 500 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      void fetchNextPage();
    }
  }, [
    virtualItems,
    processedRows.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  // =============================
  // Handlers: Filters, Sorts, Search, Columns, Rows
  // =============================

  const addColumn = trpc.base.addColumn.useMutation({
    onMutate: async ({ name, order }) => {
      if (!activeTableId) return;
      await utils.base.getTableById.cancel({ tableId: activeTableId });

      const previousData = utils.base.getTableById.getData({
        tableId: activeTableId,
      });

      const tempId = `temp-col-${Date.now()}`;
      utils.base.getTableById.setData({ tableId: activeTableId }, (old) =>
        old
          ? {
              ...old,
              columns: [
                ...old.columns,
                {
                  id: tempId,
                  tableId: activeTableId,
                  name,
                  order,
                  type: "TEXT",
                },
              ],
            }
          : old
      );

      return { previousData, tempId };
    },
    onSuccess: (newCol, _, context) => {
      if (!activeTableId) return;
      // Update with real data from server
      utils.base.getTableById.setData({ tableId: activeTableId }, (old) => {
        if (!old || !context) return old;
        return {
          ...old,
          columns: old.columns.map((col) =>
            col.id === context.tempId ? newCol : col
          ),
        };
      });
    },
    onError: (_, __, context) => {
      if (!activeTableId) return;
      // Rollback on error
      if (context?.previousData) {
        utils.base.getTableById.setData(
          { tableId: activeTableId },
          context.previousData
        );
      }
    },
  });

  const addTable = trpc.base.addTable.useMutation({
    onSuccess: (newTable) => {
      // Refetch the base with tables
      void utils.base.getById.invalidate({ id: baseId });
      // Switch to the new table
      setActiveTableId(newTable.id);
      setShowAddTableModal(false);
      setNewTableName("");
    },
    onError: (error) => {
      console.error("Failed to add table:", error);
    },
  });
  const addRow = trpc.base.addRow.useMutation({
    onMutate: async ({ data }) => {
      if (!activeTableId) return;
      const queryKey = {
        tableId: activeTableId,
        limit: PAGE_SIZE,
        filters: allFilters,
        sortConfig: sorts,
      };
      await utils.base.getRowsInfinite.cancel(queryKey);
      const previousData = utils.base.getRowsInfinite.getInfiniteData(queryKey);
      const tempId = `temp-row-${Date.now()}`;
      const tempRow = {
        id: tempId,
        tableId: activeTableId,
        data: data as Prisma.JsonObject,
      };

      utils.base.getRowsInfinite.setInfiniteData(queryKey, (old) => {
        if (!old || old.pages.length === 0) {
          return {
            pages: [{ rows: [tempRow], nextCursor: undefined }],
            pageParams: [undefined],
          };
        }

        const newPages = [...old.pages];
        const lastPage = newPages[newPages.length - 1];

        if (lastPage) {
          newPages[newPages.length - 1] = {
            ...lastPage,
            rows: [...lastPage.rows, tempRow],
          };
        }

        return {
          ...old,
          pages: newPages,
        };
      });
      return { previousData, tempId };
    },
    onSuccess: (newRow, _, context) => {
      if (context && activeTableId) {
        const queryKey = {
          tableId: activeTableId,
          limit: PAGE_SIZE,
          filters: allFilters,
          sortConfig: sorts,
        };
        utils.base.getRowsInfinite.setInfiniteData(queryKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              rows: page.rows.map((row) =>
                row.id === context.tempId
                  ? {
                      ...newRow,
                      data:
                        newRow.data &&
                        typeof newRow.data === "object" &&
                        !Array.isArray(newRow.data)
                          ? newRow.data
                          : {},
                    }
                  : row
              ),
            })),
          };
        }); // Handle temporary row display logic when filters/sorts are active
        const hasActiveFiltersOrSorts =
          allFilters.length > 0 || sorts.length > 0;
        if (hasActiveFiltersOrSorts) {
          // Mark this row as temporary
          setTempRowIds((prev) => new Set(prev).add(newRow.id));

          // After 1 second, check if the row should be hidden
          setTimeout(() => {
            const cleanedNewRow = {
              ...newRow,
              data:
                newRow.data &&
                typeof newRow.data === "object" &&
                !Array.isArray(newRow.data)
                  ? newRow.data
                  : {},
            }; // Check if the new row matches current filters/sorts
            // Helper to check if a row matches current filters and sorts
            function checkIfRowMatches(
              row: {
                id: string;
                tableId: string;
                data: Record<string, unknown>;
              },
              searchTerm: string,
              filters: FilterType[],
              sorts: Sort[],
              columns?: Column[]
            ): boolean {
              // Filter logic
              const passesFilters = filters.every((filter) => {
                const columnId = filter.columnId;
                const columnType = filter.columnType;
                const condition = filter.condition;
                const value = filter.value as unknown;
                const cellValue = row.data[columnId];

                if (columnType === "TEXT") {
                  const str = String(cellValue ?? "").toLowerCase();
                  const filterVal = String(value ?? "").toLowerCase();
                  if (condition === "contains") return str.includes(filterVal);
                  if (condition === "notContains")
                    return !str.includes(filterVal);
                  if (condition === "equals") return str === filterVal;
                  if (condition === "notEquals") return str !== filterVal;
                  if (condition === "isEmpty") return !str;
                  if (condition === "isNotEmpty") return !!str;
                } else if (columnType === "NUMBER") {
                  const filterNum = Number(value);
                  if (isNaN(filterNum)) return true;
                  const cellNum =
                    cellValue === null ||
                    cellValue === undefined ||
                    cellValue === ""
                      ? 0
                      : Number(cellValue);
                  const finalCellNum = isNaN(cellNum) ? 0 : cellNum;
                  if (condition === "gt") return finalCellNum > filterNum;
                  if (condition === "lt") return finalCellNum < filterNum;
                }
                return true;
              });

              // Search logic
              let passesSearch = true;
              if (searchTerm && columns) {
                passesSearch = columns.some((col) => {
                  const value = row.data[col.id];
                  return (
                    typeof value === "string" &&
                    value.toLowerCase().includes(searchTerm.toLowerCase())
                  );
                });
              }

              return passesFilters && passesSearch;
            }

            const shouldBeVisible = checkIfRowMatches(
              cleanedNewRow,
              "",
              allFilters,
              sorts,
              base?.columns
            );

            if (!shouldBeVisible) {
              // Start the animation out
              setAnimatingOutRowIds((prev) => new Set(prev).add(newRow.id));

              // Remove from temporary rows and animating rows after animation completes
              setTimeout(() => {
                setTempRowIds((prev) => {
                  const newSet = new Set(prev);
                  newSet.delete(newRow.id);
                  return newSet;
                });
                setAnimatingOutRowIds((prev) => {
                  const newSet = new Set(prev);
                  newSet.delete(newRow.id);
                  return newSet;
                });
              }, 300); // Animation duration
            } else {
              // Row matches filters, just remove from temp tracking
              setTempRowIds((prev) => {
                const newSet = new Set(prev);
                newSet.delete(newRow.id);
                return newSet;
              });
            }
          }, 1000); // Show for 1 second
        }
      }
    },
    onError: (_, __, context) => {
      if (context?.previousData) {
        const queryKey = {
          tableId: activeTableId ?? "",
          limit: PAGE_SIZE,
          filters: allFilters,
          sortConfig: sorts,
        };
        utils.base.getRowsInfinite.setInfiniteData(
          queryKey,
          context.previousData
        );
      }
    },
  });
  const updateRow = trpc.base.updateRow.useMutation({
    onMutate: async ({ rowId, data }) => {
      const queryKey = {
        tableId: activeTableId ?? "",
        limit: PAGE_SIZE,
        filters: allFilters,
        sortConfig: sorts,
      };
      await utils.base.getRowsInfinite.cancel(queryKey);
      const previousData = utils.base.getRowsInfinite.getInfiniteData(queryKey);

      utils.base.getRowsInfinite.setInfiniteData(queryKey, (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            rows: page.rows.map((row) =>
              row.id === rowId
                ? { ...row, data: data as Prisma.JsonObject }
                : row
            ),
          })),
        };
      });

      return { previousData };
    },
    onSuccess: (updatedRow) => {
      const queryKey = {
        tableId: activeTableId ?? "",
        limit: PAGE_SIZE,
        filters: allFilters,
        sortConfig: sorts,
      };
      utils.base.getRowsInfinite.setInfiniteData(queryKey, (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            rows: page.rows.map((row) =>
              row.id === updatedRow.id
                ? {
                    ...updatedRow,
                    data:
                      updatedRow.data &&
                      typeof updatedRow.data === "object" &&
                      !Array.isArray(updatedRow.data)
                        ? updatedRow.data
                        : {},
                  }
                : row
            ),
          })),
        };
      });
    },
    onError: (_error, _variables, context) => {
      const queryKey = {
        tableId: activeTableId ?? "",
        limit: PAGE_SIZE,
        filters: allFilters,
        sortConfig: sorts,
      };
      if (context?.previousData) {
        utils.base.getRowsInfinite.setInfiniteData(
          queryKey,
          context.previousData
        );
      }
    },
  });

  // --- Per-grid-view sorting/filtering state and logic ---
  // Type guards for backend data
  const isSort = (obj: unknown): obj is Sort => {
    if (!obj || typeof obj !== "object") return false;
    const o = obj as Partial<Sort>;
    return (
      typeof o.columnId === "string" &&
      (o.direction === "asc" || o.direction === "desc")
    );
  };
  const isFilter = (obj: unknown): obj is FilterType => {
    if (!obj || typeof obj !== "object") return false;
    const o = obj as Partial<FilterType>;
    return (
      typeof o.columnId === "string" &&
      (o.columnType === "TEXT" || o.columnType === "NUMBER") &&
      typeof o.condition === "string"
    );
  };

  // Track last loaded grid view to prevent overwriting local sorts/filters
  const lastLoadedGridViewId = useRef<string | null>(null);

  // Load sorts/filters from backend only when switching grid views
  useEffect(() => {
    if (!selectedGridViewId || !gridViewsData) return;
    if (lastLoadedGridViewId.current === selectedGridViewId) return;
    const selectedView = gridViewsData.find((v) => v.id === selectedGridViewId);
    if (!selectedView) return;
    // Always expect arrays for both sorts and filters
    const backendSorts = Array.isArray(selectedView.sort)
      ? (selectedView.sort.filter(isSort) as unknown as Sort[])
      : [];
    const backendFilters = Array.isArray(selectedView.filter)
      ? (selectedView.filter.filter(isFilter) as unknown as FilterType[])
      : [];
    const backendTextFilters = backendFilters.filter(
      (f) => f.columnType === "TEXT"
    );
    const backendNumberFilters = backendFilters.filter(
      (f) => f.columnType === "NUMBER"
    );
    setSorts(backendSorts);
    setTextFilters(backendTextFilters);
    setNumberFilters(backendNumberFilters);
    lastLoadedGridViewId.current = selectedGridViewId;
  }, [selectedGridViewId, gridViewsData]);

  // Save sorts/filters to backend when they change for the current grid view
  const lastSyncedSorts = useRef<string>("");
  const lastSyncedFilters = useRef<string>("");

  useEffect(() => {
    if (!selectedGridViewId || !gridViewsData) return;
    const selectedView = gridViewsData.find((v) => v.id === selectedGridViewId);
    if (!selectedView) return;
    const newSort = sorts.filter(isSort);
    const newFilter = [...textFilters, ...numberFilters].filter(isFilter);
    const backendSort = Array.isArray(selectedView.sort)
      ? selectedView.sort.filter(isSort)
      : [];
    const backendFilter = Array.isArray(selectedView.filter)
      ? selectedView.filter.filter(isFilter)
      : [];
    const newSortStr = JSON.stringify(newSort);
    const newFilterStr = JSON.stringify(newFilter);
    const backendSortStr = JSON.stringify(backendSort);
    const backendFilterStr = JSON.stringify(backendFilter);

    // Only update if local and backend are different, and not already just sent
    if (
      (backendSortStr !== newSortStr || backendFilterStr !== newFilterStr) &&
      (lastSyncedSorts.current !== newSortStr ||
        lastSyncedFilters.current !== newFilterStr)
    ) {
      updateGridView.mutate({
        id: selectedGridViewId,
        sort: newSort,
        filter: newFilter,
      });
      lastSyncedSorts.current = newSortStr;
      lastSyncedFilters.current = newFilterStr;
    }
  }, [
    sorts,
    textFilters,
    numberFilters,
    selectedGridViewId,
    gridViewsData,
    updateGridView,
  ]);
  // =============================
  // Mutations: Add/Update Table, Column, Row, Many Rows
  // =============================

  // Memoize views to prevent unnecessary re-renders
  useEffect(() => {
    if (selectedCell && !editingCell && wrapperRef.current) {
      wrapperRef.current.focus();
    }
  }, [selectedCell, editingCell]);

  // Click outside to close popups
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if click is outside sort popup
      if (
        showSort &&
        sortPopupRef.current &&
        !sortPopupRef.current.contains(target) &&
        sortButtonRef.current &&
        !sortButtonRef.current.contains(target)
      ) {
        setShowSort(false);
      }

      if (
        addColumnPopupRef.current &&
        !addColumnPopupRef.current.contains(event.target as Node) &&
        addColumnButtonRef.current &&
        !addColumnButtonRef.current.contains(event.target as Node)
      ) {
        setShowAddColumnPopup(false);
      }

      if (
        showAddTableModal &&
        addTablePopupRef.current &&
        !addTablePopupRef.current.contains(target) &&
        addTableButtonRef.current &&
        !addTableButtonRef.current.contains(target)
      ) {
        setShowAddTableModal(false);
        setNewTableName("");
      }

      // Grid View Popup
      if (
        showAddGridViewPopup &&
        addGridViewPopupRef.current &&
        !addGridViewPopupRef.current.contains(target) &&
        addGridViewButtonRef.current &&
        !addGridViewButtonRef.current.contains(target)
      ) {
        setShowAddGridViewPopup(false);
        setNewGridViewName("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSort, showAddColumnPopup, showAddTableModal, showAddGridViewPopup]);
  // Click outside to close Add Table popup
  useEffect(() => {
    if (!showAddTableModal) return;
    function handleClick(event: PointerEvent) {
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
    }
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [showAddTableModal]);

  const handleAddColumn = (type: "TEXT" | "NUMBER") => {
    if (!base || !activeTableId) return;

    const name = newColumnName.trim();
    if (!name) {
      return;
    }
    // Prevent duplicate column names (case-insensitive)
    if (
      base.columns.some(
        (col) => col.name.trim().toLowerCase() === name.toLowerCase()
      )
    ) {
      alert("A column with this name already exists.");
      return;
    }

    void addColumn.mutateAsync({
      tableId: activeTableId,
      name,
      order: base.columns.length,
      type: type,
    });
    setShowAddColumnPopup(false);
    setNewColumnName("");
  };
  const handleAddRow = () => {
    if (!base || !activeTableId) return;
    const emptyData = Object.fromEntries(
      base.columns.map((col) => [col.id, ""])
    );
    void addRow.mutateAsync({ tableId: activeTableId, data: emptyData });
  };
  // Debounced cell update to prevent excessive API calls
  const handleCellValueChange = (
    rowId: string,
    colId: string,
    value: string
  ) => {
    if (rowId.startsWith("temp-row-")) return;
    const key = `${rowId}-${colId}`;
    setLocalCellValues((prev) => ({ ...prev, [key]: value }));

    // Clear existing timeout for this cell
    const existingTimeout = cellUpdateTimeouts.current.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout for backend update
    const timeout = setTimeout(() => {
      const row = allRows.find((r) => r.id === rowId);
      if (!row) return;

      const col = base?.columns.find((c: Column) => c.id === colId);
      const dataObj = row.data ?? {};
      let finalValue: string | number | null = value;

      if (col?.type === "NUMBER") {
        if (value.endsWith(".") || value === "-") {
          return;
        }
        if (value === "") {
          finalValue = null;
        } else {
          const numValue = Number(value);
          if (isNaN(numValue)) {
            finalValue = null;
          } else {
            finalValue = numValue;
          }
        }
      }

      const newData = { ...dataObj, [colId]: finalValue };

      void updateRow.mutateAsync({ rowId, data: newData });
      cellUpdateTimeouts.current.delete(key);
    }, 300); // Debounce time

    cellUpdateTimeouts.current.set(key, timeout);
  };

  // Memoize cell value extraction to avoid repeated computation
  const getCellValue = useMemo(() => {
    return (row: Row, colId: string): string => {
      const key = `${row.id}-${colId}`;

      // Return local value if it exists (during editing)
      if (localCellValues[key] !== undefined) {
        return localCellValues[key];
      }

      // Otherwise return persisted value
      if (!row.data || typeof row.data !== "object" || row.data === null) {
        return "";
      }
      const value = row.data[colId];
      return typeof value === "string" || typeof value === "number"
        ? String(value)
        : "";
    };
  }, [localCellValues]);

  // Cell selection handlers
  const handleCellClick = (rowIdx: number, colIdx: number) => {
    setSelectedCell({ row: rowIdx, col: colIdx });
    setEditingCell(null);
  };

  const handleCellDoubleClick = (rowIdx: number, colIdx: number) => {
    const row = processedRows[rowIdx];
    const col = base?.columns[colIdx];
    if (!row || !col) return;
    const value = getCellValue(row, col.id);
    setEditingCell({ row: rowIdx, col: colIdx });
    if (sorts && sorts.length > 0) setSortingFrozen(true); // Freeze table if sorts are active
    wrapperRef.current?.blur();
    // If value contains a newline, open expanded mode immediately
    if (typeof value === "string" && value.includes("\n")) {
      setExpandedCell({ row: rowIdx, col: colIdx });
      setExpandedCellValue(value); // Preserve newlines
    }
  };
  const handleKeyDown = async (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!selectedCell || !base) return;
    const { row, col } = selectedCell;

    if (editingCell) return; // Don't handle navigation if already editing

    // Copy (Ctrl+C)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      e.preventDefault();
      const rowObj = processedRows[row];
      const colObj = base.columns[col];
      if (rowObj && colObj) {
        const value = getCellValue(rowObj, colObj.id);
        try {
          await navigator.clipboard.writeText(value || "");
          console.log("Copied:", value); // Debug log
        } catch (error) {
          console.error("Failed to copy:", error);
        }
      }
      return;
    }

    // Paste (Ctrl+V): Replace only the selected cell's value
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
      e.preventDefault();
      const rowObj = processedRows[row];
      const colObj = base.columns[col];

      if (rowObj && colObj) {
        try {
          const clipboardValue = await navigator.clipboard.readText();
          console.log("Pasting:", clipboardValue);

          const cleanedValue = clipboardValue.trim();

          // Update the row data
          const dataObj = rowObj.data ?? {};
          const newData = { ...dataObj, [colObj.id]: cleanedValue };

          // Update local state immediately for responsiveness
          setLocalCellValues((prev) => ({
            ...prev,
            [`${rowObj.id}-${colObj.id}`]: cleanedValue,
          }));

          // Update the backend
          try {
            await updateRow.mutateAsync({ rowId: rowObj.id, data: newData });
            console.log("Successfully updated row"); // Debug log
          } catch (updateError) {
            console.error("Failed to update row:", updateError);
            // Revert local state on error
            setLocalCellValues((prev) => {
              const newPrev = { ...prev };
              delete newPrev[`${rowObj.id}-${colObj.id}`];
              return newPrev;
            });
          }
        } catch (error) {
          console.error("Failed to read clipboard:", error);
          // Fallback: try to use the legacy clipboard API
          try {
            const clipboardValue = await navigator.clipboard.readText();
            // Process as above...
          } catch (fallbackError) {
            console.error("Clipboard access failed entirely:", fallbackError);
          }
        }
      }
      return;
    }

    switch (e.key) {
      case "ArrowRight":
        if (col < base.columns.length - 1)
          setSelectedCell({ row, col: col + 1 });
        break;
      case "ArrowLeft":
        if (col > 0) setSelectedCell({ row, col: col - 1 });
        break;
      case "ArrowDown":
        if (row < allRows.length - 1) setSelectedCell({ row: row + 1, col });
        break;
      case "ArrowUp":
        if (row > 0) setSelectedCell({ row: row - 1, col });
        break;
      case "Tab":
        e.preventDefault();
        if (col < base.columns.length - 1) {
          setSelectedCell({ row, col: col + 1 });
        }
        break;
      case "Enter":
        setEditingCell({ row, col });
        setSortingFrozen(true);
        wrapperRef.current?.blur();
        break;
      default:
        // Only enter editing mode, don't update value here. Input will handle the value.
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          setEditingCell({ row, col });
          setSortingFrozen(true);
        }
        break;
    }
  };

  // Handle input change for editing cells
  const handleInputChange = (rowId: string, colId: string, value: string) => {
    const column = base?.columns.find((c: Column) => c.id === colId);

    if (column?.type === "NUMBER") {
      // Allow empty string, a single minus sign, and valid numeric patterns (int/float).
      if (value !== "" && !/^-?\d*\.?\d*$/.test(value)) {
        // Prevents typing invalid characters into number cells.
        return;
      }
    }
    handleCellValueChange(rowId, colId, value);
  };

  const handleEditEndAndNavigate = (direction: "up" | "down" | "none") => {
    if (!editingCell || !base) return;

    const { row: currentRow, col: currentCol } = editingCell;

    const row = allRows[currentRow];
    if (row && !row.id.startsWith("temp-row-")) {
      const col = base.columns[currentRow];
      if (col) {
        const key = `${row.id}-${col.id}`;

        // Immediately clear any pending debounced update for this cell
        const existingTimeout = cellUpdateTimeouts.current.get(key);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          cellUpdateTimeouts.current.delete(key);
        }

        // Use the most recent value from the local state
        if (localCellValues[key] !== undefined) {
          let value: string | number | null = localCellValues[key];
          const dataObj = row.data ?? {};

          if (col.type === "NUMBER") {
            if (value === "" || value === null) {
              value = null;
            } else {
              const numValue = Number(value);
              if (isNaN(numValue)) {
                value = null;
              } else {
                value = numValue;
              }
            }
          }

          const newData = { ...dataObj, [col.id]: value };
          // Directly call the mutation, bypassing the debounce
          void updateRow.mutateAsync({ rowId: row.id, data: newData });
        }
      }
    }
    // Clear the local value after saving
    setLocalCellValues({});

    if (direction === "down") {
      if (currentRow < allRows.length - 1) {
        const nextRow = currentRow + 1;
        setSelectedCell({ row: nextRow, col: currentCol });
        setEditingCell({ row: nextRow, col: currentCol });
      } else {
        setEditingCell(null);
      }
    } else if (direction === "up") {
      if (currentRow > 0) {
        const nextRow = currentRow - 1;
        setSelectedCell({ row: nextRow, col: currentCol });
        setEditingCell({ row: nextRow, col: currentCol });
      } else {
        setEditingCell(null);
      }
    } else {
      setEditingCell(null);
    }
  };

  // Handle ending edit mode
  const handleEditEnd = () => {
    handleEditEndAndNavigate("none");
    // Unfreeze sorting after 1 second
    if (sortingUnfreezeTimeout.current) {
      clearTimeout(sortingUnfreezeTimeout.current);
    }
    if (sorts && sorts.length > 0) {
      setSortingFrozen(false); // Unfreeze and re-apply sorts
    }
    sortingUnfreezeTimeout.current = setTimeout(() => {
      setSortingFrozen(false);
    }, 1000);
  };

  // Freeze table when entering editing mode (any cell)
  useEffect(() => {
    if (editingCell) {
      setSortingFrozen(true);
    }
  }, [editingCell]);

  // Unfreeze table when exiting editing mode
  useEffect(() => {
    if (!editingCell) {
      setSortingFrozen(false);
    }
  }, [editingCell]);

  // Handle sign out
  const handleSignOut = () => {
    void signOut({ redirect: false }).then(() => {
      void router.push("/");
    });
  };

  // Helper to determine highlight type for a column
  const getColumnHighlightType = (
    colId: string
  ): "filter-text" | "filter-number" | "sort" | null => {
    if (textFilters.some((f) => f.columnId === colId)) return "filter-text";
    if (numberFilters.some((f) => f.columnId === colId)) return "filter-number";
    if (sorts.some((s) => s.columnId === colId)) return "sort";
    return null;
  };

  // =============================
  // Render: Main Component Output
  // =============================
  return (
    <div className="flex h-screen flex-col bg-white">
      {/* =============================
          Main Header
      ============================= */}
      <div
        className={`flex h-16 items-center px-6 py-4 text-sm text-white ${
          getBaseColor ?? "bg-purple-500"
        }`}
      >
        <div className="flex items-center space-x-4">
          <Image
            src="/logo.svg"
            alt="Logo"
            width={24}
            height={24}
            className="h-6 w-6"
            priority
          />
          <div className="flex items-center space-x-1">
            <span className="text-xl font-bold">
              {baseWithTables?.name ?? "Untitled Base"}
            </span>
          </div>
        </div>
        <div className="relative ml-auto flex items-center space-x-4">
          {/* ...other header items... */}
          {session?.user?.image && (
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu((v) => !v)}
                className="focus:outline-none"
              >
                <Image
                  src={session.user.image}
                  alt="Profile"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full border-2 border-white shadow"
                />
              </button>
              {/* Profile Menu Popup */}
              {showProfileMenu && (
                <div className="absolute right-0 z-50 mt-2 w-40 rounded bg-white py-2 shadow-lg">
                  <button
                    onClick={handleSignOut}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* =============================
          Secondary Header / Actions
      ============================= */}
      <div
        className={`flex h-12 items-center px-4 text-sm text-white ${
          getSecondaryBaseColor ?? "bg-purple-600"
        }`}
      >
        <div className="flex w-full items-center space-x-4">
          {/* Horizontally scrollable table tabs */}
          <div className="min-w-0 flex-1">
            <div className="scrollbar-thin table-tabs-scrollbar overflow-x-auto">
              <div
                className="flex min-w-max items-center space-x-1 py-1"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {baseWithTables?.tables?.map((table) => (
                  <button
                    key={table.id}
                    onClick={() => {
                      setActiveTableId(table.id);
                      setSorts([]);
                      setTextFilters([]);
                      setNumberFilters([]);
                      setSearchTerm("");
                      setShowSort(false);
                      // Remove localStorage persistence for sorts/filters when switching tables
                    }}
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
        </div>
      </div>
      {/* =============================
          Controls Bar: Sort, Filter, Search
      ============================= */}
      <div className="flex items-center gap-4 border-b border-gray-200 bg-purple-50 px-4 py-3">
        <AddManyRowsButton tableId={activeTableId} disabled={!base} />
        {/* Filter/Sort Indicators */}
        <SortComponent
          columns={base?.columns || []}
          sorts={sorts}
          setSorts={setSorts}
          showSort={showSort}
          setShowSort={setShowSort}
          sortButtonRef={sortButtonRef}
        />
        {base && (
          <>
            <FilterComponent
              columns={base.columns.filter((c: Column) => c.type === "TEXT")}
              filters={textFilters}
              onAddFilter={handleAddTextFilter}
              onRemoveFilter={handleRemoveTextFilter}
              onUpdateFilter={handleUpdateTextFilter}
              filterType="TEXT"
              buttonLabel="Filter Text"
              disabled={false}
            />
            <FilterComponent
              columns={base.columns.filter((c: Column) => c.type === "NUMBER")}
              filters={numberFilters}
              onAddFilter={handleAddNumberFilter}
              onRemoveFilter={handleRemoveNumberFilter}
              onUpdateFilter={handleUpdateNumberFilter}
              filterType="NUMBER"
              buttonLabel="Filter Number"
              disabled={false}
            />
          </>
        )}{" "}
        <button
          className={`ml-2 flex items-center rounded px-2 py-1 ${
            isClearActive
              ? "cursor-pointer bg-red-100 text-red-600 hover:bg-red-200"
              : "cursor-not-allowed bg-gray-100 text-gray-400"
          }`}
          disabled={!isClearActive || false}
          onClick={() => {
            setSorts([]);
            setTextFilters([]);
            setNumberFilters([]);
            setShowSort(false);
            // Also update backend for current grid view
            if (selectedGridViewId) {
              updateGridView.mutate({
                id: selectedGridViewId,
                sort: [],
                filter: [],
              });
            }
          }}
          title="Clear sorting and filters"
          type="button"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <div className="relative ml-auto">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            className="w-64"
          />
        </div>
      </div>
      <div className="flex flex-1">
        {/* =============================
            Left Sidebar: Views & Create
        ============================= */}
        <div className="w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50 p-3">
          {/* Views Section */}
          <div className="mb-4">
            <div className="relative mb-3">
              <Search className="absolute left-2 top-2 h-4 w-4 text-gray-400" />
              <input
                placeholder="Find a view"
                className="w-full rounded border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm"
              />
              <Settings className="absolute right-2 top-2 h-4 w-4 text-gray-400" />
            </div>
            {/* Scrollable grid views if 5 or more */}
            <div
              className={
                gridViewsData && gridViewsData.length >= 5
                  ? "custom-scrollbar max-h-36 space-y-1 overflow-y-auto pr-1"
                  : "space-y-1"
              }
              style={
                gridViewsData && gridViewsData.length >= 5
                  ? { WebkitOverflowScrolling: "touch" }
                  : {}
              }
            >
              {/* Main Grid View (no plus, tick if selected) - always show */}
              <div
                key={gridViewsData?.[0]?.id || "main-grid-view"}
                className={`flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm ${
                  selectedGridViewId === gridViewsData?.[0]?.id
                    ? "bg-blue-100 font-semibold text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() =>
                  gridViewsData?.[0] &&
                  handleSelectGridView(gridViewsData[0].id)
                }
              >
                <div className="flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4" />
                  <span>{gridViewsData?.[0]?.name || "Grid view"}</span>
                </div>
                {selectedGridViewId === gridViewsData?.[0]?.id && (
                  <Check className="h-4 w-4 text-blue-600" />
                )}
              </div>
              {/* Additional Grid Views (clones) */}
              {gridViewsData?.slice(1).map((view) => (
                <div
                  key={view.id}
                  className={`flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm ${
                    selectedGridViewId === view.id
                      ? "bg-blue-100 font-semibold text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                  onClick={() => handleSelectGridView(view.id)}
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
          </div>
          {/* Create Section */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Create...
              </span>
              <ChevronDown className="h-3 w-3 text-gray-400" />
            </div>
            <div className="space-y-1">
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
              {/* ...other view types can go here... */}
            </div>
          </div>
        </div>
        {/* =============================
            Main Content: Table Grid
        ============================= */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Horizontally scrolling container */}
          <div
            ref={wrapperRef}
            className="flex-1 overflow-x-auto focus:outline-none"
            tabIndex={0}
            onKeyDown={
              editingCell
                ? undefined
                : (e) => {
                    if (e.shiftKey && e.key === "Enter") {
                      e.preventDefault();
                      handleAddRow();
                      return;
                    }
                    void handleKeyDown(e);
                  }
            }
          >
            {" "}
            {/* Vertically scrolling container */}
            <div
              ref={tableContainerRef}
              className="h-full max-h-[calc(100vh-200px)] overflow-y-auto"
            >
              <table className="w-full min-w-max table-auto border-separate border-spacing-0">
                {/* Table Header */}
                <thead>
                  <tr className="table-heading-scrollbar flex">
                    <th className="sticky left-0 top-0 z-20 flex h-10 w-12 flex-shrink-0 items-center justify-center border-b border-r border-gray-200 bg-gray-50 text-center text-xs font-medium text-gray-500">
                      #
                    </th>
                    {base?.columns?.map((col: Column) => {
                      return (
                        <th
                          key={col.id}
                          className={`sticky top-0 z-10 h-10 w-48 flex-shrink-0 border-b border-r border-gray-200 bg-gray-50 px-3 text-left text-xs font-medium text-gray-700`}
                        >
                          <div className="flex h-full items-center space-x-2">
                            {col.type === "TEXT" ? (
                              <Bars3BottomLeftIcon className="h-4 w-4 flex-shrink-0 text-gray-500" />
                            ) : (
                              <HashtagIcon className="h-4 w-4 flex-shrink-0 text-gray-500" />
                            )}
                            <div className="flex flex-1 items-center">
                              <span
                                className="block max-w-[170px] truncate rounded px-1 py-0.5"
                                title={
                                  col.name.length > 10 ? col.name : undefined
                                }
                                style={{ verticalAlign: "middle" }}
                              >
                                {col.name.length > 10
                                  ? col.name.slice(0, 10) + "…"
                                  : col.name}
                              </span>
                            </div>
                            <ChevronDown className="h-3 w-3 text-gray-400" />
                          </div>
                        </th>
                      );
                    })}{" "}
                    <th className="w-12 flex-shrink-0 border-b border-l border-r border-gray-200 bg-gray-50 p-0">
                      <button
                        ref={addColumnButtonRef}
                        onClick={() => {
                          setNewColumnName("");
                          setShowAddColumnPopup((v) => !v);
                        }}
                        className="flex h-full w-full items-center justify-center rounded-none p-0 text-gray-500 hover:bg-gray-200"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </th>
                  </tr>
                </thead>
                {/* Table Body */}
                <tbody
                  key={virtualizerKey}
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    position: "relative",
                  }}
                >
                  {" "}
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const rowIdx = virtualRow.index;
                    const isPlaceholderRow = rowIdx === processedRows.length;
                    if (isPlaceholderRow) {
                      return (
                        <tr
                          key="placeholder-row"
                          className="group flex transition-all duration-300 ease-out hover:bg-gray-50"
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "max-content",
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <td className="sticky left-0 z-10 flex h-10 w-12 flex-shrink-0 items-center justify-center border-b border-gray-200 bg-white group-hover:bg-gray-50">
                            <button
                              onClick={handleAddRow}
                              disabled={addRow.isLoading}
                              className="flex h-6 w-6 items-center justify-center rounded text-gray-500 disabled:opacity-50"
                              title="Add row"
                              type="button"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </td>
                          {base?.columns.map((col: Column, index: number) => (
                            <td
                              key={col.id}
                              className={`h-10 w-48 flex-shrink-0 border-b border-gray-200 group-hover:bg-gray-50 ${
                                index === base.columns.length - 1
                                  ? "border-r"
                                  : ""
                              }`}
                            ></td>
                          ))}
                        </tr>
                      );
                    }
                    const row = processedRows[rowIdx];
                    if (!row || !base) return null;
                    const isAnimatingOut = animatingOutRowIds.has(row.id);
                    const isTemporary = tempRowIds.has(row.id);
                    return (
                      <tr
                        key={
                          row.id.startsWith("temp-row-")
                            ? `temp-${row.id}`
                            : `row-${row.id}`
                        }
                        className={`flex transition-all duration-300 hover:bg-gray-50 ${
                          isAnimatingOut
                            ? "translate-y-[-20px] transform opacity-0"
                            : "translate-y-0 transform opacity-100"
                        } ${isTemporary ? "border-green-200 bg-green-50" : ""}`}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "max-content",
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <td className="sticky left-0 z-10 flex h-10 w-12 flex-shrink-0 items-center justify-center border-b border-r border-gray-200 bg-gray-50 text-center text-xs text-gray-500">
                          {rowIdx + 1}
                        </td>
                        {base.columns.map((col: Column, colIdx: number) => {
                          const isSelected =
                            selectedCell?.row === rowIdx &&
                            selectedCell?.col === colIdx;
                          const isEditing =
                            editingCell?.row === rowIdx &&
                            editingCell?.col === colIdx;
                          const value = getCellValue(row, col.id);
                          const isTempRow = row.id.startsWith("temp-row-");
                          // Track if this cell is in expanded (textarea) mode
                          const isExpandedEditing =
                            isEditing &&
                            expandedCell &&
                            expandedCell.row === rowIdx &&
                            expandedCell.col === colIdx;
                          const highlightType = getColumnHighlightType(col.id);
                          let highlightClass = "";
                          if (highlightType === "filter-text")
                            highlightClass = "bg-blue-100";
                          else if (highlightType === "filter-number")
                            highlightClass = "bg-green-100";
                          else if (highlightType === "sort")
                            highlightClass = "bg-yellow-100";
                          // Only show blue border if selected or editing
                          const borderClass =
                            isSelected || isEditing
                              ? "shadow-[inset_0_0_0_3px_#3b82f6]"
                              : "";
                          // Determine background color precedence
                          let cellBgClass = highlightClass;
                          if (cellMatchesSearch(value, searchTerm)) {
                            cellBgClass =
                              isSelected || isEditing
                                ? "bg-yellow-200 " + borderClass
                                : "bg-yellow-200";
                          } else if (
                            (isSelected || isEditing) &&
                            highlightClass
                          ) {
                            // If selected/edited and filtered, use filter color (not white)
                            cellBgClass = highlightClass + " " + borderClass;
                          } else if (isSelected || isEditing) {
                            cellBgClass = "bg-white " + borderClass;
                          }
                          return (
                            <td
                              key={col.id}
                              className={`relative flex h-10 w-48 flex-shrink-0 cursor-pointer items-center border-b border-r border-gray-200 px-3 ${cellBgClass}`}
                              onClick={() => handleCellClick(rowIdx, colIdx)}
                              onDoubleClick={() =>
                                handleCellDoubleClick(rowIdx, colIdx)
                              }
                              data-cell-row={rowIdx}
                              data-cell-col={colIdx}
                            >
                              {isEditing ? (
                                isExpandedEditing ? (
                                  <textarea
                                    disabled={isTempRow}
                                    className="resize-vertical absolute left-0 top-0 z-[100] h-auto min-h-[40px] w-full border-2 border-blue-400 bg-white px-3 py-2 text-sm shadow-2xl focus:outline-none"
                                    autoFocus
                                    value={expandedCellValue}
                                    onChange={(e) =>
                                      setExpandedCellValue(e.target.value)
                                    }
                                    onBlur={() => {
                                      handleInputChange(
                                        row.id,
                                        col.id,
                                        expandedCellValue // Save with newlines preserved
                                      );
                                      setExpandedCell(null);
                                      setEditingCell(null);
                                      setExpandedCellValue("");
                                      if (sortingUnfreezeTimeout.current)
                                        clearTimeout(
                                          sortingUnfreezeTimeout.current
                                        );
                                      sortingUnfreezeTimeout.current =
                                        setTimeout(
                                          () => setSortingFrozen(false),
                                          1000
                                        );
                                    }}
                                    onKeyDown={(e) => {
                                      if (
                                        e.key === "Escape" ||
                                        e.key === "Tab"
                                      ) {
                                        e.preventDefault();
                                        handleInputChange(
                                          row.id,
                                          col.id,
                                          expandedCellValue // Save with newlines preserved
                                        );
                                        setExpandedCell(null);
                                        setEditingCell(null);
                                        setExpandedCellValue("");
                                        if (sortingUnfreezeTimeout.current)
                                          clearTimeout(
                                            sortingUnfreezeTimeout.current
                                          );
                                        sortingUnfreezeTimeout.current =
                                          setTimeout(
                                            () => setSortingFrozen(false),
                                            1000
                                          );
                                      }
                                      // Let Enter insert newlines natively
                                    }}
                                    ref={(
                                      textarea: HTMLTextAreaElement | null
                                    ) => {
                                      if (textarea && isExpandedEditing) {
                                        // Set cursor to end when textarea is first rendered
                                        setTimeout(() => {
                                          const length = textarea.value.length;
                                          textarea.setSelectionRange(
                                            length,
                                            length
                                          );
                                        }, 0);
                                      }
                                    }}
                                    style={{
                                      minHeight: 40,
                                      width: "100%",
                                      zIndex: 100,
                                      boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                                      background: "white",
                                      resize: "vertical",
                                    }}
                                  />
                                ) : (
                                  <input
                                    disabled={isTempRow}
                                    className="absolute inset-0 h-full w-full border-none bg-transparent px-3 py-0 text-sm outline-none"
                                    autoFocus
                                    value={value}
                                    onChange={(e) =>
                                      handleInputChange(
                                        row.id,
                                        col.id,
                                        e.target.value
                                      )
                                    }
                                    onBlur={handleEditEnd}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();

                                        // Store cursor position before switching
                                        const input =
                                          e.target as HTMLInputElement;
                                        const cursorPos =
                                          input.selectionStart ?? 0;
                                        const currentValue = input.value;
                                        const newValue =
                                          currentValue.slice(0, cursorPos) +
                                          "\n" +
                                          currentValue.slice(cursorPos);

                                        setExpandedCell({
                                          row: rowIdx,
                                          col: colIdx,
                                        });
                                        setExpandedCellValue(newValue);
                                      } else if (e.key === "Escape") {
                                        e.preventDefault();
                                        handleEditEnd();
                                      } else if (e.key === "Tab") {
                                        e.preventDefault();
                                        if (editingCell && base) {
                                          const { row, col } = editingCell;
                                          if (col < base.columns.length - 1) {
                                            handleEditEndAndNavigate("none");
                                            setSelectedCell({
                                              row,
                                              col: col + 1,
                                            });
                                            setEditingCell({
                                              row,
                                              col: col + 1,
                                            });
                                          }
                                        }
                                      }
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => e.stopPropagation()}
                                    data-cell-row={rowIdx}
                                    data-cell-col={colIdx}
                                  />
                                )
                              ) : (
                                <div className="truncate text-sm text-gray-700">
                                  {value}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {/* =============================
          Bottom Status Bar
      ============================= */}
      <div className="flex h-8 items-center border-t border-gray-200 bg-white px-4">
        <span className="text-xs text-gray-500">
          {allRows.length} records
          {isFetchingNextPage ? " (loading more...)" : ""}
        </span>
      </div>
      {/* =============================
          Popups/Modals
      ============================= */}
      {showAddColumnPopup && (
        // =============================
        // Add Column Popup
        // =============================
        <div
          ref={addColumnPopupRef}
          className="absolute z-20 w-56 rounded-md border border-gray-200 bg-white p-2 shadow-lg"
          style={{
            top:
              (addColumnButtonRef.current?.getBoundingClientRect().bottom ??
                0) + window.scrollY,
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
                handleAddColumn("TEXT");
              }
            }}
          />
          <div className="border-t border-gray-200 pt-2">
            <div className="mb-1 px-1 text-xs font-semibold text-gray-500">
              SELECT A FIELD TYPE
            </div>
            <button
              onClick={() => handleAddColumn("TEXT")}
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!newColumnName.trim()}
            >
              <Bars3BottomLeftIcon className="h-4 w-4" />
              Text
            </button>
            <button
              onClick={() => handleAddColumn("NUMBER")}
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!newColumnName.trim()}
            >
              <HashtagIcon className="h-4 w-4" />
              Number
            </button>
          </div>
        </div>
      )}

      {showAddTableModal && (
        // =============================
        // Add Table Fullscreen Modal
        // =============================
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-20">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
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
                  addTable.mutate({ name: newTableName.trim(), baseId });
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
                    addTable.mutate({ name: newTableName.trim(), baseId });
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
      {/* =============================
          Add Grid View Popup
      ============================= */}
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
      <style jsx global>{`
        .table-tabs-scrollbar::-webkit-scrollbar {
          height: 6px;
          background: transparent;
        }
        .table-tabs-scrollbar::-webkit-scrollbar-thumb {
          background: #fff;
          border-radius: 3px;
        }
        .table-tabs-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .table-tabs-scrollbar {
          scrollbar-color: #fff transparent;
          scrollbar-width: thin;
        }
        .table-heading-scrollbar::-webkit-scrollbar {
          height: 4px;
          background: transparent;
        }
        .table-heading-scrollbar::-webkit-scrollbar-thumb {
          background: #bbb;
          border-radius: 2px;
        }
        .table-heading-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .table-heading-scrollbar {
          scrollbar-color: #bbb transparent;
          scrollbar-width: thin;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 4px;
        }
        .custom-scrollbar {
          scrollbar-color: #e5e7eb transparent;
          scrollbar-width: thin;
        }
      `}</style>
    </div>
  );
};

export default AirtableClone;
