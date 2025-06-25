import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { faker } from "@faker-js/faker";
import { ColumnType, Prisma } from "@prisma/client";

const tableRowSchema = z.record(z.string());

const filterSchema = z.object({
  id: z.string(),
  columnId: z.string(),
  columnType: z.nativeEnum(ColumnType),
  condition: z.string(),
  value: z.any().optional(),
});

const sortSchema = z.object({
  columnId: z.string(),
  direction: z.enum(["asc", "desc"]),
});

// Add array schemas for multiple sorts/filters
const filterArraySchema = z.array(filterSchema);
const sortArraySchema = z.array(sortSchema);

export type Filter = z.infer<typeof filterSchema>;

// --- Types for row data ---
type RowWithData = {
  id: string;
  tableId: string;
  data: Record<string, unknown> | null;
};

// Helper to ensure data is a plain object
function ensureObject(val: unknown): Record<string, unknown> {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return {};
}

export const baseRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.base.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
    });
  }),
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.base.findUnique({
        where: { id: input.id },
        include: {
          tables: {
            orderBy: { createdAt: "asc" },
          },
        },
      });
    }),
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // 1. Create the base
      const base = await ctx.prisma.base.create({
        data: {
          name: input.name,
          userId: ctx.session.user.id,
        },
      });

      // 2. Create default table
      const table = await ctx.prisma.table.create({
        data: {
          name: "Table 1",
          baseId: base.id,
        },
      });

      // 2b. Create default grid view for the table
      await ctx.prisma.gridView.create({
        data: {
          tableId: table.id,
          name: "Grid view",
          filter: Prisma.JsonNull,
          sort: Prisma.JsonNull,
        },
      });

      // 3. Create columns
      const columns = await ctx.prisma.$transaction([
        ctx.prisma.column.create({
          data: { name: "Name", tableId: table.id, order: 0 },
        }),
        ctx.prisma.column.create({
          data: { name: "id", tableId: table.id, order: 1, type: "NUMBER" },
        }),
      ]);

      // 4. Create 5 rows with faker data
      const [nameCol, idCol] = columns;
      const rowsData = Array.from({ length: 5 }).map(() => ({
        [nameCol.id]: faker.person.fullName(),
        [idCol.id]: faker.number.int({ min: 0, max: 1000 }),
      }));

      await Promise.all(
        rowsData.map((row) =>
          ctx.prisma.row.create({
            data: {
              tableId: table.id,
              data: row,
            },
          })
        )
      );

      return base;
    }),
  addTable: protectedProcedure
    .input(
      z.object({
        baseId: z.string(),
        name: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Create the table
      const table = await ctx.prisma.table.create({
        data: {
          name: input.name,
          baseId: input.baseId,
        },
      });

      // 1b. Create default grid view for the table
      await ctx.prisma.gridView.create({
        data: {
          tableId: table.id,
          name: "Grid view",
          filter: Prisma.JsonNull,
          sort: Prisma.JsonNull,
        },
      });

      // 2. Create columns
      const columns = await ctx.prisma.$transaction([
        ctx.prisma.column.create({
          data: { name: "Name", tableId: table.id, order: 0 },
        }),
        ctx.prisma.column.create({
          data: { name: "id", tableId: table.id, order: 1, type: "NUMBER" },
        }),
      ]);

      // 3. Create 5 rows with faker data
      const [nameCol, idCol] = columns;
      const rowsData = Array.from({ length: 5 }).map(() => ({
        [nameCol.id]: faker.person.fullName(),
        [idCol.id]: faker.number.int({ min: 0, max: 1000 }),
      }));

      await Promise.all(
        rowsData.map((row) =>
          ctx.prisma.row.create({
            data: {
              tableId: table.id,
              data: row,
            },
          })
        )
      );

      return table;
    }),
  // Legacy method - keeping for backwards compatibility but now gets first table
  getTable: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const base = await ctx.prisma.base.findUnique({
        where: { id: input.baseId },
        include: {
          tables: {
            orderBy: { createdAt: "asc" },
            take: 1,
            include: {
              columns: {
                orderBy: { order: "asc" },
              },
            },
          },
        },
      });

      if (!base || !base.tables[0]) {
        return null;
      }

      const table = base.tables[0];
      return {
        id: base.id,
        name: base.name,
        columns: table.columns,
        rows: [],
      };
    }),

  getTableById: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      const table = await ctx.prisma.table.findUnique({
        where: { id: input.tableId },
        include: {
          base: {
            select: { id: true, name: true },
          },
        },
      });
      const columns = await ctx.prisma.column.findMany({
        where: { tableId: input.tableId },
        orderBy: { order: "asc" },
      });
      // Don't return rows here since we use pagination
      return { ...table, columns, rows: [] };
    }),

  addColumn: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        name: z.string(),
        order: z.number(),
        type: z.nativeEnum(ColumnType),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Create the column in the columns table
      const column = await ctx.prisma.column.create({
        data: {
          tableId: input.tableId,
          name: input.name,
          order: input.order,
          type: input.type,
        },
      });

      // 2. Dynamically add a SQL column to the Row table
      // Use TEXT for TEXT columns, DOUBLE PRECISION for NUMBER columns
      const sqlType = input.type === "NUMBER" ? "DOUBLE PRECISION" : "TEXT";
      const colName = `col_${column.id.replace(/-/g, "_")}`;
      await ctx.prisma.$executeRawUnsafe(
        `ALTER TABLE "Row" ADD COLUMN IF NOT EXISTS "${colName}" ${sqlType};`
      );

      return column;
    }),

  updateColumn: protectedProcedure
    .input(
      z.object({
        columnId: z.string(),
        name: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.column.update({
        where: { id: input.columnId },
        data: { name: input.name },
      });
    }),
  addRow: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        data: tableRowSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find all columns for this table
      // (No need to build sqlCols for create, only for update if you have dynamic columns in your schema)
      return ctx.prisma.row.create({
        data: {
          tableId: input.tableId,
          data: input.data,
        },
      });
    }),
  addManyRows: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        count: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tableId, count } = input;

      const columns = await ctx.prisma.column.findMany({
        where: { tableId },
        orderBy: { order: "asc" },
      });

      if (columns.length === 0) {
        return { rows: [] };
      }
      const rowsData = Array.from({ length: count }).map(() => {
        const row: Record<string, string | number> = {};
        columns.forEach((col) => {
          if (col.type === "TEXT") {
            row[col.id] = faker.person.fullName();
          } else if (col.type === "NUMBER") {
            row[col.id] = faker.number.int({ min: 100, max: 999 });
          } else {
            row[col.id] = "";
          }
        });
        return row;
      });

      const dataToCreate = rowsData.map((rowData) => ({
        tableId: input.tableId,
        data: rowData as Prisma.JsonObject,
      }));

      await ctx.prisma.row.createMany({
        data: dataToCreate,
      });

      // Fetch the newly created rows since createMany doesn't return them
      const newRows = await ctx.prisma.row.findMany({
        where: {
          tableId: input.tableId,
        },
        orderBy: {
          id: "desc",
        },
        take: count,
      });

      return { rows: newRows.reverse() };
    }),
  getRowsInfinite: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        limit: z.number(),
        cursor: z.string().nullish(), // cursor can be a string or null
        searchTerm: z.string().optional(),
        filters: z.array(filterSchema).optional(),
        sortConfig: z.array(sortSchema).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { tableId, limit, cursor, searchTerm, filters, sortConfig } = input;

      const where: Prisma.RowWhereInput = { tableId };
      const whereConditions: Prisma.RowWhereInput[] = [];
      const columns = await ctx.prisma.column.findMany({
        where: { tableId: input.tableId },
        select: { id: true, type: true },
      });

      // Handle search term
      if (searchTerm) {
        const searchConditions = columns
          .filter((col) => col.type === "TEXT") // Only search text columns
          .map((col) => ({
            data: {
              path: [col.id],
              string_contains: searchTerm,
            },
          }));

        if (searchConditions.length > 0) {
          whereConditions.push({ OR: searchConditions });
        }
      }

      // Handle filters
      if (filters && filters.length > 0) {
        const filterConditions = filters
          .map((filter) => {
            const columnId = filter.columnId;
            const columnType = filter.columnType;
            const condition = filter.condition;
            const value = filter.value as unknown;

            if (columnType === "TEXT") {
              const strValue = String(value ?? "");
              switch (condition) {
                case "contains":
                  return {
                    data: {
                      path: [columnId],
                      string_contains: strValue,
                    },
                  };
                case "notContains":
                  return {
                    NOT: {
                      data: {
                        path: [columnId],
                        string_contains: strValue,
                      },
                    },
                  };
                case "equals":
                  return { data: { path: [columnId], equals: strValue } };
                case "notEquals":
                  return {
                    NOT: { data: { path: [columnId], equals: strValue } },
                  };
                case "isEmpty":
                  return {
                    OR: [
                      { data: { path: [columnId], equals: null } },
                      { data: { path: [columnId], equals: "" } },
                    ],
                  };
                case "isNotEmpty":
                  return {
                    AND: [
                      { NOT: { data: { path: [columnId], equals: null } } },
                      { NOT: { data: { path: [columnId], equals: "" } } },
                    ],
                  };
                default:
                  return null;
              }
            } else if (columnType === "NUMBER") {
              const numValue = Number(value);

              switch (condition) {
                case "gt":
                  if (isNaN(numValue)) return null;
                  return { data: { path: [columnId], gt: numValue } };
                case "lt":
                  if (isNaN(numValue)) return null;
                  return { data: { path: [columnId], lt: numValue } };
                default:
                  return null;
              }
            }
            return null;
          })
          .filter((f) => f !== null) as Prisma.RowWhereInput[];

        if (filterConditions.length > 0) {
          whereConditions.push({ AND: filterConditions });
        }
      }
      if (whereConditions.length > 0) {
        where.AND = whereConditions;
      }

      // Fast path for simple queries (no search, no filters, no sorting)
      // This is the most common case and should be very fast
      const hasComplexQuery =
        searchTerm ||
        (filters && filters.length > 0) ||
        (sortConfig && sortConfig.length > 0);
      if (!hasComplexQuery) {
        // Simple case: just fetch by ID with cursor pagination
        // Only select necessary fields for better performance
        const rowsRaw = await ctx.prisma.row.findMany({
          where,
          select: {
            id: true,
            tableId: true,
            data: true,
            // Don't select createdAt/updatedAt for better performance
          },
          orderBy: [{ id: "asc" }],
          cursor: cursor ? { id: cursor } : undefined,
          take: limit + 1,
        });
        const rows: RowWithData[] = rowsRaw.map((row) => ({
          ...row,
          data: ensureObject(row.data),
        }));

        let nextCursor: string | undefined = undefined;
        if (rows.length > limit) {
          const nextItem = rows.pop();
          nextCursor = nextItem?.id;
        }

        return {
          rows,
          nextCursor,
        };
      }

      // Handle sorting
      let rows: RowWithData[] = [];
      if (sortConfig && sortConfig.length > 0) {
        // If sorting is requested, fetch all filtered rows (up to a safe max)
        const fetchLimit = 1000010; // You can adjust this limit as needed
        const rowsRaw = await ctx.prisma.row.findMany({
          where,
          select: {
            id: true,
            tableId: true,
            data: true,
          },
          orderBy: [{ id: "asc" }], // deterministic order for slicing
          // Do NOT use cursor/take here, we paginate after sorting
          take: fetchLimit,
        });
        rows = rowsRaw.map((row) => ({
          ...row,
          data: ensureObject(row.data),
        }));
        // Sort in JS
        rows = rows.sort((a, b) => {
          for (const sort of sortConfig) {
            const { columnId, direction } = sort;
            const aData = a.data ?? {};
            const bData = b.data ?? {};
            const aVal = aData[columnId];
            const bVal = bData[columnId];
            // Find column type for proper comparison
            const column = columns.find((c) => c.id === columnId);
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
        // Paginate in JS
        let startIdx = 0;
        if (cursor) {
          const idx = rows.findIndex((row) => row.id === cursor);
          startIdx = idx >= 0 ? idx + 1 : 0;
        }
        const pagedRows = rows.slice(startIdx, startIdx + limit);
        const nextCursor =
          rows.length > startIdx + limit
            ? pagedRows[pagedRows.length - 1]?.id
            : undefined;
        return {
          rows: pagedRows,
          nextCursor,
        };
      } else {
        // No sorting: use DB pagination for performance
        const rowsRaw = await ctx.prisma.row.findMany({
          where,
          select: {
            id: true,
            tableId: true,
            data: true,
          },
          orderBy: [{ id: "asc" }],
          cursor: cursor ? { id: cursor } : undefined,
          take: limit + 1,
        });
        rows = rowsRaw.map((row) => ({
          ...row,
          data: ensureObject(row.data),
        }));
        let nextCursor: string | undefined = undefined;
        if (rows.length > limit) {
          const nextItem = rows.pop();
          nextCursor = nextItem?.id;
        }
        return {
          rows,
          nextCursor,
        };
      }
    }),
  updateRow: protectedProcedure
    .input(z.object({ rowId: z.string(), data: z.record(z.string(), z.any()) }))
    .mutation(async ({ ctx, input }) => {
      // Find the row to get tableId
      const row = await ctx.prisma.row.findUnique({
        where: { id: input.rowId },
        select: { tableId: true },
      });
      if (!row) throw new Error("Row not found");

      // Find all columns for this table
      const columns = await ctx.prisma.column.findMany({
        where: { tableId: row.tableId },
      });

      // Build SQL column values
      const sqlCols: Record<string, unknown> = {};
      for (const col of columns) {
        const colName = `col_${col.id.replace(/-/g, "_")}`;
        const value = input.data[col.id];
        // Only allow string, number, or null for SQL columns
        sqlCols[colName] =
          typeof value === "string" || typeof value === "number" || value === null
            ? value
            : null;
      }

      // Update row with both JSON and SQL columns
      return ctx.prisma.row.update({
        where: { id: input.rowId },
        data: {
          data: input.data,
        },
      });
    }),
  // --- GRID VIEW CRUD ---
  getGridViews: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.gridView.findMany({
        where: { tableId: input.tableId },
        orderBy: { createdAt: "asc" },
      });
    }),

  createGridView: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        name: z.string().min(1),
        filter: filterArraySchema.optional().nullable(),
        sort: sortArraySchema.optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.gridView.create({
        data: {
          tableId: input.tableId,
          name: input.name,
          filter: input.filter ?? [],
          sort: input.sort ?? [],
        },
      });
    }),

  updateGridView: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        filter: filterArraySchema.optional().nullable(),
        sort: sortArraySchema.optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.gridView.update({
        where: { id: input.id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          filter: input.filter ?? [],
          sort: input.sort ?? [],
        },
      });
    }),

  deleteGridView: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.gridView.delete({
        where: { id: input.id },
      });
    }),
});
