import React, { useState, useRef, useEffect, useMemo } from "react";
import { trpc } from "~/utils/api";
import { useRouter } from "next/router";
import { useSession, signOut } from "next-auth/react";
import {
  ChevronDown,
  Plus,
  Grid3X3,
  Calendar,
  BarChart3,
  Clock,
  List,
  GanttChart,
  FileText,
  Settings,
  Search,
  SortAsc,
  Trash2,
  X,
} from "lucide-react";
import { Bars3BottomLeftIcon, HashtagIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import { useVirtualizer } from "@tanstack/react-virtual";
import { type Prisma } from "@prisma/client";
import { type Base, type Sort } from "~/types";
import { type Filter as FilterType } from "~/server/api/routers/base";
import FilterComponent from "~/components/FilterComponent";

// Define proper types for the data structures

const AirtableClone = () => {
  const router = useRouter();
  const baseId = router.query.id as string;
  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [newColumnName, setNewColumnName] = useState("");
  const [editingColumnName, setEditingColumnName] = useState("");

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

  // Load persisted filters and sorts on mount
  useEffect(() => {
    if (!baseId) return;

    const persistedTextFilters = localStorage.getItem(`textFilters_${baseId}`);
    const persistedNumberFilters = localStorage.getItem(
      `numberFilters_${baseId}`
    );
    const persistedSorts = localStorage.getItem(`sorts_${baseId}`);

    if (persistedTextFilters) {
      try {
        setTextFilters(JSON.parse(persistedTextFilters));
      } catch (e) {
        console.error("Failed to parse persisted text filters:", e);
      }
    }

    if (persistedNumberFilters) {
      try {
        setNumberFilters(JSON.parse(persistedNumberFilters));
      } catch (e) {
        console.error("Failed to parse persisted number filters:", e);
      }
    }

    if (persistedSorts) {
      try {
        setSorts(JSON.parse(persistedSorts));
      } catch (e) {
        console.error("Failed to parse persisted sorts:", e);
      }
    }
  }, [baseId]);

  // Persist filters and sorts whenever they change
  useEffect(() => {
    if (!baseId) return;
    localStorage.setItem(`textFilters_${baseId}`, JSON.stringify(textFilters));
  }, [baseId, textFilters]);

  useEffect(() => {
    if (!baseId) return;
    localStorage.setItem(
      `numberFilters_${baseId}`,
      JSON.stringify(numberFilters)
    );
  }, [baseId, numberFilters]);

  useEffect(() => {
    if (!baseId) return;
    localStorage.setItem(`sorts_${baseId}`, JSON.stringify(sorts));
  }, [baseId, sorts]);
  const [showSort, setShowSort] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sortPopupRef = useRef<HTMLDivElement>(null);

  // Fetch persistent columns and rows from backend
  const { data: base } = trpc.base.getTable.useQuery(
    { baseId },
    { enabled: !!baseId }
  ) as { data: Base | undefined };

  // Calculate base color (same logic as dashboard)
  const getBaseColor = useMemo(() => {
    if (!base?.id) return "bg-purple-500";

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

    return colors[hashString(base.id) % colors.length];
  }, [base?.id]);

  const getSecondaryBaseColor = useMemo(() => {
    if (!base?.id) return "bg-purple-600";

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
    return colors[hashString(base.id) % colors.length];
  }, [base?.id]);

  const utils = trpc.useUtils();
  const cellUpdateTimeouts = useRef(new Map<string, NodeJS.Timeout>());

  const isSortActive = sorts.length > 0;
  const isFilterActive = allFilters.length > 0;
  const isClearActive = isSortActive || isFilterActive;

  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const PAGE_SIZE = isBulkAdding ? 500 : 250; // Larger page size during bulk operations
  const [showAddColumnPopup, setShowAddColumnPopup] = useState(false);
  const addColumnButtonRef = useRef<HTMLButtonElement>(null);
  const addColumnPopupRef = useRef<HTMLDivElement>(null);
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.base.getRowsInfinite.useInfiniteQuery(
    {
      baseId,
      limit: PAGE_SIZE,
      searchTerm: isBulkAdding ? undefined : searchTerm,
      filters: isBulkAdding ? undefined : allFilters,
      sortConfig: isBulkAdding ? undefined : sorts,
    },
    {
      enabled: !!baseId,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      keepPreviousData: true,
    }
  );

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

  const allRows = useMemo(
    () =>
      infiniteData?.pages.flatMap((page) =>
        page.rows.map((row) => ({
          ...row,
          data:
            row.data && typeof row.data === "object" && !Array.isArray(row.data)
              ? row.data
              : {},
        }))
      ) ?? [],
    [infiniteData]
  );

  // Single computed variable that handles all filtering, sorting, and searching
  const processedRows = useMemo(() => {
    if (!allRows.length) return [];

    let rows = allRows;

    // Apply search filter
    if (searchTerm) {
      rows = rows.filter((row) => {
        return base?.columns?.some((col) => {
          const value = row.data[col.id];
          return (
            value &&
            value.toString().toLowerCase().includes(searchTerm.toLowerCase())
          );
        });
      });
    }

    // Apply column filters
    if (allFilters.length > 0) {
      rows = rows.filter((row) => {
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
    } // Apply sorting
    if (sorts.length > 0) {
      rows = [...rows].sort((a, b) => {
        for (const sort of sorts) {
          const { columnId, direction } = sort;
          const aVal = a.data[columnId];
          const bVal = b.data[columnId];

          const column = base?.columns.find((c) => c.id === columnId);

          let comparison = 0;

          if (column?.type === "NUMBER") {
            const aNum =
              aVal === null || aVal === undefined || aVal === ""
                ? -Infinity
                : Number(aVal);
            const bNum =
              bVal === null || bVal === undefined || bVal === ""
                ? -Infinity
                : Number(bVal);
            if (!isNaN(aNum) && !isNaN(bNum)) {
              comparison = aNum - bNum;
            }
          } else {
            const aStr = (aVal ?? "").toString().toLowerCase();
            const bStr = (bVal ?? "").toString().toLowerCase();
            if (aStr < bStr) comparison = -1;
            if (aStr > bStr) comparison = 1;
          }

          if (comparison !== 0) {
            return direction === "asc" ? comparison : -comparison;
          }
        }
        return 0;
      });
    }

    return rows;
  }, [allRows, searchTerm, allFilters, sorts, base?.columns]);

  type Row = (typeof allRows)[number];

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: processedRows.length,
    estimateSize: () => 40,
    getScrollElement: () => tableContainerRef.current,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) {
      return;
    }

    if (
      lastItem.index >= processedRows.length - 5 &&
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

  // Optimized mutations with proper cache updates
  const addColumn = trpc.base.addColumn.useMutation({
    onMutate: async ({ name, order }) => {
      // Cancel outgoing refetches
      await utils.base.getTable.cancel({ baseId });

      // Snapshot previous value
      const previousData = utils.base.getTable.getData({ baseId });

      // Optimistically update cache
      const tempId = `temp-col-${Date.now()}`;
      utils.base.getTable.setData({ baseId }, (old) =>
        old
          ? {
              ...old,
              columns: [
                ...old.columns,
                { id: tempId, baseId, name, order, type: "TEXT" },
              ],
            }
          : old
      );

      return { previousData, tempId };
    },
    onSuccess: (newCol, _, context) => {
      // Update with real data from server
      utils.base.getTable.setData({ baseId }, (old) => {
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
      // Rollback on error
      if (context?.previousData) {
        utils.base.getTable.setData({ baseId }, context.previousData);
      }
    },
  });

  const updateColumn = trpc.base.updateColumn.useMutation({
    onMutate: async ({ columnId, name }) => {
      // Cancel outgoing refetchs
      await utils.base.getTable.cancel({ baseId });

      // Snapshot previous value
      const previousData = utils.base.getTable.getData({ baseId });

      // Optimistically update cache
      utils.base.getTable.setData({ baseId }, (old) =>
        old
          ? {
              ...old,
              columns: old.columns.map((col) =>
                col.id === columnId ? { ...col, name } : col
              ),
            }
          : old
      );

      return { previousData };
    },
    onError: (_, __, context) => {
      // Rollback on error
      if (context?.previousData) {
        utils.base.getTable.setData({ baseId }, context.previousData);
      }
    },
  });
  const addRow = trpc.base.addRow.useMutation({
    onMutate: async ({ data }) => {
      const queryKey = {
        baseId,
        limit: PAGE_SIZE,
        searchTerm,
        filters: allFilters,
        sortConfig: sorts,
      };
      await utils.base.getRowsInfinite.cancel(queryKey);
      const previousData = utils.base.getRowsInfinite.getInfiniteData(queryKey);
      const tempId = `temp-row-${Date.now()}`;
      const tempRow = {
        id: tempId,
        baseId,
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
      if (context) {
        const queryKey = {
          baseId,
          limit: PAGE_SIZE,
          searchTerm,
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
        });
      }
    },
    onError: (_, __, context) => {
      if (context?.previousData) {
        const queryKey = {
          baseId,
          limit: PAGE_SIZE,
          searchTerm,
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
        baseId,
        limit: PAGE_SIZE,
        searchTerm,
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
        baseId,
        limit: PAGE_SIZE,
        searchTerm,
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
        baseId,
        limit: PAGE_SIZE,
        searchTerm,
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

  // Memoize views to prevent unnecessary re-renders
  const views = useMemo(
    () => [
      { name: "Grid view", icon: Grid3X3, active: true },
      { name: "Calendar", icon: Calendar },
      { name: "Gallery", icon: BarChart3 },
      { name: "Kanban", icon: BarChart3 },
      { name: "Timeline", icon: Clock, badge: "Team" },
      { name: "List", icon: List },
      { name: "Gantt", icon: GanttChart, badge: "Team" },
      { name: "New Section", badge: "Team" },
      { name: "Form", icon: FileText },
    ],
    []
  );

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
        !sortPopupRef.current.contains(target)
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
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSort, showAddColumnPopup]);

  const handleAddColumn = (type: "TEXT" | "NUMBER") => {
    if (!base) return;

    const name = newColumnName.trim();
    if (!name) {
      return;
    }

    void addColumn.mutateAsync({
      baseId,
      name,
      order: base.columns.length,
      type: type,
    });
    setShowAddColumnPopup(false);
    setNewColumnName("");
  };

  const handleAddRow = () => {
    if (!base) return;
    const emptyData = Object.fromEntries(
      base.columns.map((col) => [col.id, ""])
    );
    void addRow.mutateAsync({ baseId, data: emptyData });
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

      const col = base?.columns.find((c) => c.id === colId);
      const dataObj = row.data ?? {};
      let finalValue: string | number | null = value;

      if (col?.type === "NUMBER") {
        // User might still be typing a valid number (e.g., "12.", "-")
        // We don't want to save these intermediate states.
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
    setEditingCell({ row: rowIdx, col: colIdx });
    wrapperRef.current?.blur();
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!selectedCell || editingCell || !base) return;
    const { row, col } = selectedCell;

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
      case "Enter":
        if (e.shiftKey) {
          if (row > 0) setSelectedCell({ row: row - 1, col });
        } else {
          if (row < allRows.length - 1) setSelectedCell({ row: row + 1, col });
        }
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const rowData = allRows[row];
          const colId = base.columns[col]?.id;
          if (rowData && colId) {
            handleCellValueChange(rowData.id, colId, e.key);
            setEditingCell({ row, col });
          }
        }
        break;
    }
  };

  // Handle input change for editing cells
  const handleInputChange = (rowId: string, colId: string, value: string) => {
    const column = base?.columns.find((c) => c.id === colId);

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
  };

  // Handle column editing
  const handleColumnClick = (columnId: string, currentName: string) => {
    // Don't edit if it's a temporary column (still being created)
    if (columnId.startsWith("temp-col-")) return;
    setEditingColumn(columnId);
    setEditingColumnName(currentName);
  };

  const handleColumnNameChange = (columnId: string, newName: string) => {
    // Don't update if it's a temporary column (still being created)
    if (columnId.startsWith("temp-col-")) {
      setEditingColumn(null);
      return;
    }

    if (
      newName.trim() &&
      newName !== base?.columns.find((col) => col.id === columnId)?.name
    ) {
      void updateColumn.mutateAsync({
        columnId,
        name: newName.trim(),
      });
    }
    setEditingColumn(null);
  };

  // Handle sign out
  const handleSignOut = () => {
    void signOut({ redirect: false }).then(() => {
      void router.push("/");
    });
  };
  const addManyRows = trpc.base.addManyRows.useMutation({
    // Invalidation will be handled manually after all batches are complete
  });

  const handleAddManyRows = async () => {
    if (!base) return;

    setIsBulkAdding(true);

    const emptyData = Object.fromEntries(
      base.columns.map((col) => [col.id, ""])
    );
    const totalRows = 100;
    const BATCH_SIZE = 1250;

    const batches = [];
    for (let i = 0; i < totalRows; i += BATCH_SIZE) {
      const batch = Array.from(
        { length: Math.min(BATCH_SIZE, totalRows - i) },
        () => emptyData
      );
      batches.push(batch);
    }

    const CONCURRENT_BATCHES = 4;
    for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
      const currentBatches = batches.slice(i, i + CONCURRENT_BATCHES);

      await Promise.all(
        currentBatches.map((batch) =>
          addManyRows.mutateAsync({ baseId, rows: batch })
        )
      );
    }

    // Reset to clean state first (no filters/sorts) for fastest loading
    // This will use the fast path in the backend
    await utils.base.getRowsInfinite.reset({
      baseId,
      limit: PAGE_SIZE,
      // Don't pass any filters, sorts, or search terms for fastest reset
    });

    setIsBulkAdding(false);
  };

  if (session === undefined) {
    // Session is loading
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <span className="text-lg font-medium text-gray-500">Loading...</span>
      </div>
    );
  }
  if (!session) {
    // Not signed in
    return (
      <div className="p-8 text-gray-500">
        Please sign in to access this page.
      </div>
    );
  }
  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Main Header */}
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
              {base?.name ?? "Untitled Base"}
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
      {/* Secondary Header / Actions */}
      <div
        className={`flex h-12 items-center px-4 text-sm text-white ${
          getSecondaryBaseColor ?? "bg-purple-600"
        }`}
      >
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <span>Table 1</span>
          </div>
        </div>
      </div>
      {/* Controls Bar: Sort, Filter, Search */}
      <div className="flex items-center gap-4 border-b border-gray-200 bg-purple-50 px-4 py-3">
        <button
          onClick={() => {
            void handleAddManyRows();
          }}
          disabled={isBulkAdding}
          className="flex items-center gap-1 rounded bg-white px-3 py-1 text-sm font-medium text-gray-600 shadow hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          <span>{isBulkAdding ? "Adding..." : "Add 100k rows"}</span>
        </button>
        <div className="relative inline-block">
          <button
            className="flex items-center gap-1 rounded bg-white px-3 py-1 text-sm font-medium text-gray-600 shadow hover:bg-gray-100"
            onClick={() => {
              setShowSort((v) => !v);
            }}
            type="button"
          >
            <SortAsc className="h-4 w-4" />
            Sort
          </button>{" "}
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
                {sorts.map((sort, index) => (
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
                      {base?.columns.map((col) => (
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
                ))}
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
                      {base?.columns.map((col) => (
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
        {base && (
          <>
            <FilterComponent
              columns={base.columns.filter((c) => c.type === "TEXT")}
              filters={textFilters}
              onAddFilter={handleAddTextFilter}
              onRemoveFilter={handleRemoveTextFilter}
              onUpdateFilter={handleUpdateTextFilter}
              filterType="TEXT"
              buttonLabel="Filter Text"
            />
            <FilterComponent
              columns={base.columns.filter((c) => c.type === "NUMBER")}
              filters={numberFilters}
              onAddFilter={handleAddNumberFilter}
              onRemoveFilter={handleRemoveNumberFilter}
              onUpdateFilter={handleUpdateNumberFilter}
              filterType="NUMBER"
              buttonLabel="Filter Number"
            />
          </>
        )}{" "}
        <button
          className={`ml-2 flex items-center rounded px-2 py-1 ${
            isClearActive
              ? "cursor-pointer bg-red-100 text-red-600 hover:bg-red-200"
              : "cursor-not-allowed bg-gray-100 text-gray-400"
          }`}
          disabled={!isClearActive}
          onClick={() => {
            setSorts([]);
            setTextFilters([]);
            setNumberFilters([]);
            setShowSort(false);
            // Clear persisted data
            if (baseId) {
              localStorage.removeItem(`textFilters_${baseId}`);
              localStorage.removeItem(`numberFilters_${baseId}`);
              localStorage.removeItem(`sorts_${baseId}`);
            }
          }}
          title="Clear sorting and filters"
          type="button"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <div className="relative ml-auto">
          <input
            type="text"
            placeholder="Find..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 focus:border-purple-400 focus:outline-none"
          />
          <span className="absolute right-2 top-2 text-gray-400">
            <Search className="h-4 w-4" />
          </span>
        </div>
      </div>
      <div className="flex flex-1">
        {/* Left Sidebar: Views & Create */}
        <div className="w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50 p-3">
          {/* Views Section */}
          <div className="mb-16">
            <div className="relative mb-3">
              <Search className="absolute left-2 top-2 h-4 w-4 text-gray-400" />
              <input
                placeholder="Find a view"
                className="w-full rounded border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm"
              />
              <Settings className="absolute right-2 top-2 h-4 w-4 text-gray-400" />
            </div>
            <div className="space-y-1">
              {views.slice(0, 1).map((view) => (
                <div
                  key={view.name}
                  className="flex items-center justify-between rounded px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                >
                  <div className="flex items-center space-x-2">
                    {view.icon && <view.icon className={`h-4 w-4`} />}
                    <span>{view.name}</span>
                    {view.badge && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-600">
                        {view.badge}
                      </span>
                    )}
                  </div>
                  <Plus className="h-3 w-3" />
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
              {views.slice(0, 7).map((view) => (
                <div
                  key={view.name}
                  className="flex items-center justify-between rounded px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                >
                  <div className="flex items-center space-x-2">
                    {view.icon && <view.icon className={`h-4 w-4`} />}
                    <span>{view.name}</span>
                    {view.badge && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-600">
                        {view.badge}
                      </span>
                    )}
                  </div>
                  <Plus className="h-3 w-3" />
                </div>
              ))}
              <div className="flex items-center justify-between rounded px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
                <div className="flex items-center space-x-2">
                  <span className="text-sm">New section</span>
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-600">
                    Team
                  </span>
                </div>
                <Plus className="h-3 w-3" />
              </div>
              <div className="flex items-center justify-between rounded px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span>Form</span>
                </div>
                <Plus className="h-3 w-3" />
              </div>
            </div>
          </div>
        </div>
        {/* Main Content: Table Grid */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Horizontally scrolling container */}
          <div
            ref={wrapperRef}
            className="flex-1 overflow-x-auto focus:outline-none"
            tabIndex={0}
            onKeyDown={editingCell ? undefined : handleKeyDown}
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
                  <tr className="flex">
                    <th className="sticky left-0 top-0 z-20 flex h-10 w-12 flex-shrink-0 items-center justify-center border-b border-r border-gray-200 bg-gray-50 text-center text-xs font-medium text-gray-500">
                      #
                    </th>
                    {base?.columns?.map((col) => (
                      <th
                        key={col.id}
                        className="sticky top-0 z-10 h-10 w-48 flex-shrink-0 border-b border-r border-gray-200 bg-gray-50 px-3 text-left text-xs font-medium text-gray-700"
                      >
                        <div className="flex h-full items-center space-x-2">
                          {col.type === "TEXT" ? (
                            <Bars3BottomLeftIcon className="h-4 w-4 flex-shrink-0 text-gray-500" />
                          ) : (
                            <HashtagIcon className="h-4 w-4 flex-shrink-0 text-gray-500" />
                          )}
                          <div className="flex flex-1 items-center">
                            {editingColumn === col.id ? (
                              <input
                                autoFocus
                                className="w-full rounded border border-blue-500 bg-white px-2 py-1 text-xs"
                                value={editingColumnName}
                                onChange={(e) =>
                                  setEditingColumnName(e.target.value)
                                }
                                onBlur={(e) =>
                                  handleColumnNameChange(col.id, e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleColumnNameChange(
                                      col.id,
                                      e.currentTarget.value
                                    );
                                  } else if (e.key === "Escape") {
                                    setEditingColumn(null);
                                  }
                                }}
                              />
                            ) : (
                              <span
                                className="flex-1 cursor-pointer truncate rounded px-1 py-0.5 hover:bg-gray-100"
                                onClick={() =>
                                  handleColumnClick(col.id, col.name)
                                }
                              >
                                {col.name}
                              </span>
                            )}
                          </div>
                          <ChevronDown className="h-3 w-3 text-gray-400" />
                        </div>
                      </th>
                    ))}{" "}
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
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    position: "relative",
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const rowIdx = virtualRow.index;
                    const row = processedRows[rowIdx];

                    if (!row) return null;

                    return (
                      <tr
                        key={row.id}
                        className="flex hover:bg-gray-50"
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
                        {base?.columns.map((col, colIdx) => {
                          const isSelected =
                            selectedCell?.row === rowIdx &&
                            selectedCell?.col === colIdx;
                          const isEditing =
                            editingCell?.row === rowIdx &&
                            editingCell?.col === colIdx;
                          const value = getCellValue(row, col.id);
                          const isTempRow = row.id.startsWith("temp-row-");
                          return (
                            <td
                              key={col.id}
                              className={`relative flex h-10 w-48 flex-shrink-0 cursor-pointer items-center border-b border-r border-gray-200 px-3 ${
                                isSelected || isEditing
                                  ? "bg-white shadow-[inset_0_0_0_3px_#3b82f6]"
                                  : ""
                              }`}
                              onClick={() => handleCellClick(rowIdx, colIdx)}
                              onDoubleClick={() =>
                                handleCellDoubleClick(rowIdx, colIdx)
                              }
                            >
                              {isEditing ? (
                                <input
                                  disabled={isTempRow}
                                  className="absolute inset-0 h-full w-full border-none bg-white px-3 py-0 text-sm outline-none"
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
                                    if (
                                      e.key === "Enter" ||
                                      e.key === "Escape"
                                    ) {
                                      e.preventDefault();
                                      handleEditEnd();
                                    }
                                  }}
                                />
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
                </tbody>{" "}
                <tfoot>
                  {" "}
                  {/* Row Placeholder */}{" "}
                  <tr
                    className="group flex hover:bg-gray-600"
                    style={{ width: "max-content" }}
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
                    </td>{" "}
                    {base?.columns.map((col, index) => (
                      <td
                        key={col.id}
                        className={`h-10 w-48 flex-shrink-0 border-b border-gray-200 group-hover:bg-gray-50 ${
                          index === base.columns.length - 1 ? "border-r" : ""
                        }`}
                      ></td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
      {/* Bottom Status Bar */}
      <div className="flex h-8 items-center border-t border-gray-200 bg-white px-4">
        <span className="text-xs text-gray-500">
          {allRows.length} records
          {isFetchingNextPage ? " (loading more...)" : ""}
        </span>
      </div>
      {showAddColumnPopup && (
        <div
          ref={addColumnPopupRef}
          className="absolute z-20 w-56 rounded-md border border-gray-200 bg-white p-2 shadow-lg"
          style={{
            top: addColumnButtonRef.current
              ? addColumnButtonRef.current.getBoundingClientRect().bottom +
                window.scrollY
              : 0,
            left: addColumnButtonRef.current
              ? addColumnButtonRef.current.getBoundingClientRect().right +
                window.scrollX
              : 0,
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
    </div>
  );
};

export default AirtableClone;
