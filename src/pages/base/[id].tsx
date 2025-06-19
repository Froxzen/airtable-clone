import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
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
  Filter,
  SortAsc,
  Trash2,
} from "lucide-react";
import Image from "next/image";
// import { useVirtualizer } from '@tanstack/react-virtual'

// Define proper types for the data structures
interface Column {
  id: string;
  baseId: string;
  name: string;
  order: number;
}

interface Row {
  id: string;
  baseId: string;
  data: Record<string, unknown>;
}

interface Base {
  id?: string;
  name: string;
  columns: Column[];
  rows: Row[];
}

interface ApiRow {
  id: string;
  baseId: string;
  data: unknown; // This matches what comes from your API
}

const AirtableClone = () => {
  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);

  const { data: session } = useSession();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Add local state for cell values during editing
  const [localCellValues, setLocalCellValues] = useState<
    Record<string, string>
  >({});

  const [searchTerm, setSearchTerm] = useState("");
  const [showTextFilter, setShowTextFilter] = useState(false);
  const [showNumberFilter, setShowNumberFilter] = useState(false);
  const [filterConfig, setFilterConfig] = useState<{
    columnId?: string;
    type?: string;
    value?: string;
  }>({});
  const [filters, setFilters] = useState<
    Record<string, { type: string; value: string }>
  >({});
  const [sortConfig, setSortConfig] = useState<{
    columnId?: string;
    direction?: "asc" | "desc";
  }>({});
  const [showSort, setShowSort] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const sortPopupRef = useRef<HTMLDivElement>(null);
  const textFilterPopupRef = useRef<HTMLDivElement>(null);
  const numberFilterPopupRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const baseId = router.query.id as string;

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

  // Get darker variant for secondary header
  const getBaseColorDark = useMemo(() => {
    return getBaseColor
      ? getBaseColor.replace("-600", "-700")
      : "bg-purple-700";
  }, [getBaseColor]);

  const utils = trpc.useUtils();
  const cellUpdateTimeouts = useRef(new Map<string, NodeJS.Timeout>());

  const isSortActive = !!(sortConfig.columnId && sortConfig.direction);
  const isFilterActive = Object.keys(filters).length > 0;
  const isClearActive = isSortActive || isFilterActive;

  const PAGE_SIZE = 500;
  const [pagedRows, setPagedRows] = useState<Row[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);

  const fetchRowsPage = useCallback(async () => {
    if (!baseId || loadingRows || !hasMore) return;
    setLoadingRows(true);
    const rows = await utils.base.getRowsPage.fetch({
      baseId,
      offset: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    });
    // Ensure each row's data is a Record<string, unknown>
    const normalizedRows: Row[] = rows.map((row: ApiRow) => ({
      ...row,
      data: row.data && typeof row.data === "object" ? row.data : {},
    })) as Row[];

    // Don't add duplicates - check if rows already exist
    setPagedRows((prev) => {
      const existingIds = new Set(prev.map((r) => r.id));
      const newRows = normalizedRows.filter((row) => !existingIds.has(row.id));
      return [...prev, ...newRows];
    });

    setHasMore(rows.length === PAGE_SIZE);
    setLoadingRows(false);
  }, [baseId, page, loadingRows, hasMore, utils.base.getRowsPage]);

  const [resetPagingFlag, setResetPagingFlag] = useState(false);
  // Initial load
  useEffect(() => {
    setPagedRows([]);
    setPage(0);
    setHasMore(true);
  }, [baseId, resetPagingFlag]);

  useEffect(() => {
    void fetchRowsPage();
    // eslint-disable-next-line
  }, [page, fetchRowsPage]);

  // Scroll handler
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const el = tableContainerRef.current;
      if (!el || loadingRows || !hasMore) return;
      // Only trigger when we're within 50px of the bottom
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 50) {
        setPage((p) => p + 1);
      }
    };
    const el = tableContainerRef.current;
    if (el) {
      el.addEventListener("scroll", handleScroll);
      return () => el.removeEventListener("scroll", handleScroll);
    }
  }, [loadingRows, hasMore]);

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
              columns: [...old.columns, { id: tempId, baseId, name, order }],
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
      // Cancel outgoing refetches
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
      // Cancel outgoing refetches
      await utils.base.getTable.cancel({ baseId });

      // Snapshot previous value
      const previousPagedRows = pagedRows;

      // Optimistically add row to paginated data
      const tempId = `temp-row-${Date.now()}`;
      const tempRow: Row = { id: tempId, baseId, data };
      setPagedRows((prev) => [...prev, tempRow]);

      return { previousPagedRows, tempId };
    },
    onSuccess: (newRow, _, context) => {
      // Update with real data from server
      if (context) {
        setPagedRows((prev) =>
          prev.map((row) =>
            row.id === context.tempId
              ? ({
                  ...newRow,
                  data:
                    newRow.data && typeof newRow.data === "object"
                      ? newRow.data
                      : {},
                } as Row)
              : row
          )
        );
      }
    },
    onError: (_, __, context) => {
      // Rollback on error
      if (context?.previousPagedRows) {
        setPagedRows(context.previousPagedRows);
      }
    },
  });
  const updateRow = trpc.base.updateRow.useMutation({
    onMutate: async ({ rowId, data }) => {
      // Cancel outgoing refetches
      await utils.base.getTable.cancel({ baseId });

      // Snapshot previous value
      const previousPagedRows = pagedRows;

      // Optimistically update the row in paginated data
      setPagedRows((prev) =>
        prev.map((row) => (row.id === rowId ? { ...row, data } : row))
      );

      return { previousPagedRows };
    },
    onSuccess: (updatedRow) => {
      // Update with real data from server
      setPagedRows((prev) =>
        prev.map((row) =>
          row.id === updatedRow.id
            ? ({
                ...updatedRow,
                data:
                  updatedRow.data && typeof updatedRow.data === "object"
                    ? updatedRow.data
                    : {},
              } as Row)
            : row
        )
      );
    },
    onError: (_, __, context) => {
      // Rollback on error
      if (context?.previousPagedRows) {
        setPagedRows(context.previousPagedRows);
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

      // Check if click is outside text filter popup
      if (
        showTextFilter &&
        textFilterPopupRef.current &&
        !textFilterPopupRef.current.contains(target)
      ) {
        setShowTextFilter(false);
      }

      // Check if click is outside number filter popup
      if (
        showNumberFilter &&
        numberFilterPopupRef.current &&
        !numberFilterPopupRef.current.contains(target)
      ) {
        setShowNumberFilter(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSort, showTextFilter, showNumberFilter]);

  // Optimized handlers - no more refetch calls
  const handleAddColumn = () => {
    if (!base) return;
    void addColumn.mutateAsync({
      baseId,
      name: `Column ${base.columns.length + 1}`,
      order: base.columns.length,
    });
    // No refetch needed - optimistic updates handle this
  };

  const handleAddRow = () => {
    if (!base) return;
    const emptyData = Object.fromEntries(
      base.columns.map((col) => [col.id, ""])
    );
    void addRow.mutateAsync({ baseId, data: emptyData }); // No refetch needed - optimistic updates handle this
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
      const row = pagedRows.find((r) => r.id === rowId);
      if (!row) return;

      const dataObj = row.data ?? {};
      const newData = { ...dataObj, [colId]: value };

      void updateRow.mutateAsync({ rowId, data: newData });
      cellUpdateTimeouts.current.delete(key);
    }, 300);

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
        if (row < pagedRows.length - 1) setSelectedCell({ row: row + 1, col });
        break;
      case "ArrowUp":
        if (row > 0) setSelectedCell({ row: row - 1, col });
        break;
      case "Enter":
        setEditingCell({ row, col });
        break;
    }
  };

  // Handle input change for editing cells
  const handleInputChange = (rowId: string, colId: string, value: string) => {
    handleCellValueChange(rowId, colId, value);
  }; // Handle ending edit mode
  const handleEditEnd = () => {
    if (editingCell) {
      const row = pagedRows[editingCell.row];
      if (row && row.id.startsWith("temp-row-")) return;
      const col = base?.columns[editingCell.col];
      if (row && col) {
        const key = `${row.id}-${col.id}`;

        const existingTimeout = cellUpdateTimeouts.current.get(key);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          cellUpdateTimeouts.current.delete(key);
        }

        if (localCellValues[key] !== undefined) {
          const value = localCellValues[key];
          const dataObj = row.data ?? {};
          const newData = { ...dataObj, [col.id]: value };
          void updateRow.mutateAsync({ rowId: row.id, data: newData });
        }
      }
    }
    setLocalCellValues({});
    setEditingCell(null);
  };

  // Handle column editing
  const handleColumnClick = (columnId: string) => {
    // Don't edit if it's a temporary column (still being created)
    if (columnId.startsWith("temp-col-")) return;
    setEditingColumn(columnId);
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
    onMutate: ({ rows }) => {
      // Optimistically add rows to UI immediately
      const tempRows = rows.map((data, i) => ({
        id: `temp-row-bulk-${Date.now()}-${i}`,
        baseId,
        data,
      })) as Row[];

      setPagedRows((prev) => [...prev, ...tempRows]);
      return { tempRows };
    },
  });
  useEffect(() => {
    if (resetPagingFlag) {
      setPagedRows([]);
      setPage(0);
      setHasMore(true);
      setResetPagingFlag(false);
    }
  }, [resetPagingFlag]);
  const handleAddFiveRows = async () => {
    if (!base) return;
    const emptyData = Object.fromEntries(
      base.columns.map((col) => [col.id, ""])
    );
    const totalRows = 1000;
    const BATCH_SIZE = 500;

    // Process batches in parallel
    const batches = [];
    for (let i = 0; i < totalRows; i += BATCH_SIZE) {
      const batch = Array.from(
        { length: Math.min(BATCH_SIZE, totalRows - i) },
        () => emptyData
      );
      batches.push(batch);
    }

    // Process batches with limited concurrency
    const CONCURRENT_BATCHES = 3;
    for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
      const currentBatches = batches.slice(i, i + CONCURRENT_BATCHES);

      // Process these batches in parallel
      await Promise.all(
        currentBatches.map((batch) =>
          addManyRows.mutateAsync({ baseId, rows: batch })
        )
      );
    }

    // Refresh data after all batches complete
    await utils.base.getTable.invalidate({ baseId });
    setResetPagingFlag(true);
  };

  const filteredRows = useMemo(() => {
    if (!pagedRows.length) return [];
    return pagedRows.filter((row) => {
      // For each filter applied, check if the row matches
      return Object.entries(filters).every(([colId, filter]) => {
        const value = row.data[colId];

        // Text filters
        if (
          [
            "contains",
            "notContains",
            "equal",
            "notEqual",
            "empty",
            "notEmpty",
          ].includes(filter.type)
        ) {
          const str = (value ?? "").toString().toLowerCase();
          const filterVal = (filter.value ?? "").toLowerCase();
          if (filter.type === "contains") return str.includes(filterVal);
          if (filter.type === "notContains") return !str.includes(filterVal);
          if (filter.type === "equal") return str === filterVal;
          if (filter.type === "notEqual") return str !== filterVal;
          if (filter.type === "empty") return !str;
          if (filter.type === "notEmpty") return !!str;
        }

        // Number filters
        if (["gt", "lt"].includes(filter.type)) {
          const num = Number(value);
          const filterNum = Number(filter.value);
          if (isNaN(num) || isNaN(filterNum)) return false;
          if (filter.type === "gt") return num > filterNum;
          if (filter.type === "lt") return num < filterNum;
        }

        return true;
      });
    });
  }, [pagedRows, filters]);

  const sortedRows = useMemo(() => {
    if (!filteredRows) return [];
    if (!sortConfig.columnId || !sortConfig.direction) return filteredRows;
    const colId = sortConfig.columnId;
    return [...filteredRows].sort((a, b) => {
      const aVal = a.data[colId];
      const bVal = b.data[colId];
      // Try number sort first, fallback to string
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
      }
      const aStr = (aVal ?? "").toString().toLowerCase();
      const bStr = (bVal ?? "").toString().toLowerCase();
      if (aStr < bStr) return sortConfig.direction === "asc" ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortConfig]);

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
      {" "}
      {/* Top Header */}
      <div
        className={`flex h-16 items-center px-6 py-4 text-sm text-white ${getBaseColor}`}
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
      {/* Secondary Header */}
      <div
        className={`flex h-12 items-center px-4 text-sm text-white ${getSecondaryBaseColor}`}
      >
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <span>Table 1</span>
          </div>
          <div
            className="flex cursor-pointer items-center space-x-1 rounded bg-white/20 px-2 py-1 hover:bg-white/30"
            onClick={() => {
              void handleAddFiveRows();
            }}
          >
            <Plus className="h-4 w-4" />
            <span>Add 1000 rows</span>
          </div>
        </div>
      </div>
      {/* Controls Row: Filter, Sort, Find */}
      <div className="flex items-center gap-4 border-b border-gray-200 bg-purple-50 px-4 py-3">
        <div className="relative inline-block">
          {" "}
          <button
            className="flex items-center gap-1 rounded bg-white px-3 py-1 text-sm font-medium text-gray-600 shadow hover:bg-gray-100"
            onClick={() => {
              setShowSort((v) => !v);
              setShowTextFilter(false);
              setShowNumberFilter(false);
            }}
            type="button"
          >
            <SortAsc className="h-4 w-4" />
            Sort
          </button>{" "}
          {showSort && (
            <div
              ref={sortPopupRef}
              className="absolute left-0 top-full z-10 mt-2 w-64 max-w-xs rounded border bg-white p-4 shadow-lg"
            >
              <div className="mb-2 text-xs font-semibold text-gray-700">
                Sort by
              </div>
              <select
                className="mb-2 w-full rounded border px-2 py-1 text-xs"
                value={sortConfig.columnId || ""}
                onChange={(e) =>
                  setSortConfig((s) => ({ ...s, columnId: e.target.value }))
                }
              >
                <option value="">Select column</option>
                {base?.columns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
              <select
                className="mb-2 w-full rounded border px-2 py-1 text-xs"
                value={sortConfig.direction || ""}
                onChange={(e) =>
                  setSortConfig((s) => ({
                    ...s,
                    direction: e.target.value as "asc" | "desc",
                  }))
                }
              >
                <option value="">Select order</option>
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          )}
        </div>
        <div className="relative">
          {" "}
          <button
            className="flex items-center gap-1 rounded bg-white px-3 py-1 text-sm font-medium text-gray-600 shadow hover:bg-gray-100"
            onClick={() => {
              setShowTextFilter((v) => !v);
              setShowSort(false);
              setShowNumberFilter(false);
            }}
            type="button"
          >
            <Filter className="h-4 w-4" />
            Filter Text
          </button>{" "}
          {showTextFilter && (
            <div
              ref={textFilterPopupRef}
              className="absolute left-0 z-10 mt-2 w-64 rounded border bg-white p-4 shadow-lg"
            >
              <div className="mb-2 text-xs font-semibold text-gray-700">
                Where
              </div>
              <select
                className="mb-2 w-full rounded border px-2 py-1 text-xs"
                value={filterConfig.columnId || ""}
                onChange={(e) =>
                  setFilterConfig((f) => ({ ...f, columnId: e.target.value }))
                }
              >
                <option value="">Select column</option>
                {base?.columns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
              <select
                className="mb-2 w-full rounded border px-2 py-1 text-xs"
                value={filterConfig.type || ""}
                onChange={(e) =>
                  setFilterConfig((f) => ({ ...f, type: e.target.value }))
                }
              >
                <option value="">Select condition</option>
                <option value="contains">Contains</option>
                <option value="notContains">Not contains</option>
                <option value="equal">Equal to</option>
                <option value="notEqual">Not equal to</option>
                <option value="empty">Is empty</option>
                <option value="notEmpty">Is not empty</option>
              </select>
              {filterConfig.type &&
                !["empty", "notEmpty"].includes(filterConfig.type) && (
                  <input
                    className="mb-2 w-full rounded border px-2 py-1 text-xs"
                    value={filterConfig.value || ""}
                    onChange={(e) =>
                      setFilterConfig((f) => ({ ...f, value: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        filterConfig.columnId &&
                        filterConfig.type &&
                        (["empty", "notEmpty"].includes(filterConfig.type) ||
                          filterConfig.value)
                      ) {
                        setFilters((f) => ({
                          ...f,
                          [filterConfig.columnId!]: {
                            type: filterConfig.type!,
                            value: filterConfig.value || "",
                          },
                        }));
                        setShowTextFilter(false); // or setShowNumberFilter(false) for number filter
                        setFilterConfig({});
                      }
                    }}
                    placeholder="Value"
                  />
                )}{" "}
              <button
                className={`w-full rounded ${
                  getBaseColor ?? "bg-purple-500"
                } py-1 text-xs font-semibold text-white hover:${
                  getSecondaryBaseColor ?? "bg-purple-600"
                }`}
                onClick={() => {
                  if (filterConfig.columnId && filterConfig.type) {
                    setFilters((f) => ({
                      ...f,
                      [filterConfig.columnId as string]: {
                        type: filterConfig.type as string,
                        value: filterConfig.value || "",
                      },
                    }));
                    setShowTextFilter(false);
                    setFilterConfig({});
                  }
                }}
              >
                Apply
              </button>
            </div>
          )}
        </div>
        <div className="relative">
          {" "}
          <button
            className="flex items-center gap-1 rounded bg-white px-3 py-1 text-sm font-medium text-gray-600 shadow hover:bg-gray-100"
            onClick={() => {
              setShowNumberFilter((v) => !v);
              setShowSort(false);
              setShowTextFilter(false);
            }}
            type="button"
          >
            <Filter className="h-4 w-4" />
            Filter Number
          </button>{" "}
          {showNumberFilter && (
            <div
              ref={numberFilterPopupRef}
              className="absolute left-0 z-10 mt-2 w-64 rounded border bg-white p-4 shadow-lg"
            >
              <div className="mb-2 text-xs font-semibold text-gray-700">
                Where
              </div>
              <select
                className="mb-2 w-full rounded border px-2 py-1 text-xs"
                value={filterConfig.columnId || ""}
                onChange={(e) =>
                  setFilterConfig((f) => ({ ...f, columnId: e.target.value }))
                }
              >
                <option value="">Select column</option>
                {base?.columns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
              <select
                className="mb-2 w-full rounded border px-2 py-1 text-xs"
                value={filterConfig.type || ""}
                onChange={(e) =>
                  setFilterConfig((f) => ({ ...f, type: e.target.value }))
                }
              >
                <option value="">Select condition</option>
                <option value="gt">Greater than</option>
                <option value="lt">Smaller than</option>
              </select>
              {filterConfig.type &&
                !["empty", "notEmpty"].includes(filterConfig.type) && (
                  <input
                    className="mb-2 w-full rounded border px-2 py-1 text-xs"
                    value={filterConfig.value || ""}
                    onChange={(e) =>
                      setFilterConfig((f) => ({ ...f, value: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        filterConfig.columnId &&
                        filterConfig.type &&
                        (["empty", "notEmpty"].includes(filterConfig.type) ||
                          filterConfig.value)
                      ) {
                        setFilters((f) => ({
                          ...f,
                          [filterConfig.columnId!]: {
                            type: filterConfig.type!,
                            value: filterConfig.value || "",
                          },
                        }));
                        setShowTextFilter(false); // or setShowNumberFilter(false) for number filter
                        setFilterConfig({});
                      }
                    }}
                    placeholder="Value"
                  />
                )}
              <button
                className={`w-full rounded ${getBaseColor} py-1 text-xs font-semibold text-white hover:${getSecondaryBaseColor}`}
                onClick={() => {
                  if (filterConfig.columnId && filterConfig.type) {
                    setFilters((f) => ({
                      ...f,
                      [filterConfig.columnId!]: {
                        type: filterConfig.type!,
                        value: filterConfig.value || "",
                      },
                    }));
                    setShowNumberFilter(false);
                    setFilterConfig({});
                  }
                }}
              >
                Apply
              </button>
            </div>
          )}
        </div>{" "}
        <button
          className={`ml-2 flex items-center rounded px-2 py-1 ${
            isClearActive
              ? "cursor-pointer bg-red-100 text-red-600 hover:bg-red-200"
              : "cursor-not-allowed bg-gray-100 text-gray-400"
          }`}
          disabled={!isClearActive}
          onClick={() => {
            setSortConfig({});
            setFilters({});
            setShowSort(false);
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
        {/* Left Sidebar */}
        <div className="w-64 border-r border-gray-200 bg-gray-50 p-3">
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

        {/* Main Content */}
        <div className="flex flex-1 flex-col">
          {/* Table Container */}
          <div ref={tableContainerRef} className="flex-1 overflow-auto">
            <div
              ref={wrapperRef}
              className="outline-none"
              tabIndex={0}
              onKeyDown={editingCell ? undefined : handleKeyDown}
            >
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="h-10 w-12 border-b border-r border-gray-200 bg-gray-50 text-center text-xs font-medium text-gray-500">
                      #
                    </th>{" "}
                    {base?.columns?.map((col) => (
                      <th
                        key={col.id}
                        className="relative h-10 min-w-[150px] border-b border-r border-gray-200 bg-gray-50 px-3 text-left text-xs font-medium text-gray-700"
                      >
                        <div className="flex items-center space-x-1">
                          {editingColumn === col.id ? (
                            <input
                              autoFocus
                              className="flex-1 rounded border border-blue-500 bg-white px-2 py-1 text-xs"
                              defaultValue={col.name}
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
                              className="cursor-pointer rounded px-1 py-0.5 hover:bg-gray-100"
                              onClick={() => handleColumnClick(col.id)}
                            >
                              {col.name}
                            </span>
                          )}
                          <ChevronDown className="h-3 w-3 text-gray-400" />
                        </div>
                      </th>
                    ))}
                    <th className="h-10 w-8 border-b border-gray-200 bg-gray-50 text-center">
                      <button
                        onClick={handleAddColumn}
                        disabled={addColumn.isLoading}
                        className="mx-auto flex h-6 w-6 items-center justify-center rounded text-blue-500 hover:bg-blue-50 disabled:opacity-50"
                        title="Add column"
                        type="button"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows
                    .filter((row) => {
                      if (!searchTerm) return true;
                      // Check if any cell contains the search term (case-insensitive)
                      return base?.columns?.some((col) => {
                        const value = row.data[col.id];
                        return (
                          typeof value === "string" &&
                          value.toLowerCase().includes(searchTerm.toLowerCase())
                        );
                      });
                    })
                    .map((row, rowIdx) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="h-10 w-12 border-b border-r border-gray-200 bg-gray-50 text-center text-xs text-gray-500">
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
                              className={`relative h-10 cursor-pointer border-b border-r border-gray-200 px-3 ${
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
                        <td className="h-10 w-8 border-b border-gray-200"></td>
                      </tr>
                    ))}
                  <tr>
                    <td
                      colSpan={(base?.columns?.length ?? 0) + 2}
                      className="h-10 text-center"
                    >
                      <button
                        onClick={handleAddRow}
                        disabled={addRow.isLoading}
                        className="mx-auto flex h-6 w-6 items-center justify-center rounded text-blue-500 hover:bg-blue-50 disabled:opacity-50"
                        title="Add row"
                        type="button"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Status */}
          <div className="flex h-8 items-center border-t border-gray-200 bg-white px-4">
            <span className="text-xs text-gray-500">
              {pagedRows.length} records loaded
              {hasMore ? " (loading more...)" : ""}
            </span>
            <div className="ml-auto">
              <button className="rounded bg-gray-800 px-2 py-1 text-xs text-white">
                Getting started
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AirtableClone;
