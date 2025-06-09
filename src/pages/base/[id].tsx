import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import { trpc } from "~/utils/api";

type MyColumn = { accessorKey: string; header: string };
type TableRow = Record<string, string>;
type BackendColumn = { id: string; name: string };
type BackendRow = { data: TableRow };

export default function BaseTablePage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session } = useSession();

  // Fetch table data from backend
  const { data: tableData, refetch } = trpc.base.getTable.useQuery(
    { baseId: id as string },
    { enabled: !!id }
  );

  // Local state for columns and rowsf
  const [columns, setColumns] = useState<MyColumn[]>([]);
  const [data, setData] = useState<TableRow[]>([]);

  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);


  // Update local state when backend data changes
  useEffect(() => {
    if (tableData) {
      setColumns(
        (tableData.columns as BackendColumn[]).map((col) => ({
          accessorKey: col.id,
          header: col.name,
        }))
      );
      setData((tableData.rows as BackendRow[]).map((row) => row.data));
    }
  }, [tableData]);

  // Add column (persisted)
  const addColumn = trpc.base.addColumn.useMutation({
    onMutate: (newCol) => {
      setColumns((prev) => [
        ...prev,
        { accessorKey: `optimistic-${Date.now()}`, header: newCol.name },
      ]);
    },
    onSuccess: () => {
      void refetch();
    },
    onError: () => {
      void refetch();
    },
  });
  
  const handleAddColumn = () => {
    const newColName = `Column ${columns.length + 1}`;
    addColumn.mutate({
      baseId: id as string,
      name: newColName,
      order: columns.length,
    });
  };

  // Add row (persisted)
  const addRow = trpc.base.addRow.useMutation({
    onMutate: (newRow) => {
      setData((prev) => [...prev, newRow.data]);
    },
    onSuccess: () => {
      void refetch();
    },
    onError: () => {
      void refetch();
    },
  });

  const handleAddRow = () => {
    const newRow: TableRow = {};
    columns.forEach((col) => {
      newRow[col.accessorKey] = "";
    });
    addRow.mutate({
      baseId: id as string,
      data: newRow,
    });
  };

  const { data: base } = trpc.base.getById.useQuery(
    { id: id as string },
    { enabled: !!id }
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Image
                src="/logo.svg"
                alt="Logo"
                className="h-8 w-8"
                width={32}
                height={32}
              />
              <span className="ml-8 text-2xl font-bold text-gray-800">
                {base?.name ?? "Loading..."}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {session?.user?.image && (
                  <Image
                    src={session.user.image}
                    alt="Profile"
                    className="h-8 w-8 rounded-full"
                    width={32}
                    height={32}
                  />
                )}
                <span className="text-sm text-gray-700">
                  {session?.user?.name || session?.user?.email}
                </span>
              </div>
              <button
                onClick={() => {
                  void signOut({ callbackUrl: "/" });
                }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-8">
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full border-separate rounded-lg">
            <thead>
              <tr>
                <th className="rounded-tl-lg border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  #
                </th>
                {table.getHeaderGroups()[0]?.headers?.map((header) => (
                  <th
                    key={header.id}
                    className="border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-700"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </th>
                ))}
                <th
                  className="cursor-pointer select-none rounded-tr-lg border-b border-gray-200 bg-gray-50 px-0 py-0 text-center align-middle"
                  style={{ width: 48, height: 48, minWidth: 48, minHeight: 48 }}
                  onClick={handleAddColumn}
                  title="Add column"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded text-lg font-semibold text-blue-600 hover:bg-blue-100">
                    +
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 2}
                    className="bg-gray-50 px-4 py-6 text-center text-gray-400"
                  >
                    No rows yet
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row, rowIdx) => (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-gray-50"
                  >
                    <td className="border-b border-gray-100 px-4 py-3 text-gray-500">
                      {rowIdx + 1}
                    </td>
                    {row.getVisibleCells().map((cell, colIdx) => (
                      <td
                        key={cell.id}
                        className={`cursor-pointer border-b border-gray-100 px-4 py-3 ${
                          selectedCell &&
                          selectedCell.row === rowIdx &&
                          selectedCell.col === colIdx
                            ? "bg-blue-100 ring-2 ring-blue-400"
                            : ""
                        }`}
                        onClick={() =>
                          setSelectedCell({ row: rowIdx, col: colIdx })
                        }
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                    <td />
                  </tr>
                ))
              )}
              {/* "+" Add Row Button Row */}
              <tr>
                <td colSpan={columns.length + 2} className="px-0 py-0">
                  <div
                    className="flex h-12 w-full cursor-pointer select-none items-center justify-center rounded-b-lg text-lg font-semibold text-blue-600 hover:bg-blue-100"
                    style={{ minHeight: 48 }}
                    onClick={handleAddRow}
                    title="Add row"
                  >
                    +
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
