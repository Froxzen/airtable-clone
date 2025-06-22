import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { faker } from "@faker-js/faker";
import { ColumnType, type Prisma } from "@prisma/client";

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

export type Filter = z.infer<typeof filterSchema>;

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
        select: { id: true, name: true },
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

      // 2. Create columns
      const columns = await ctx.prisma.$transaction([
        ctx.prisma.column.create({
          data: { name: "Name", baseId: base.id, order: 0 },
        }),
        ctx.prisma.column.create({
          data: { name: "id", baseId: base.id, order: 1, type: "NUMBER" },
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
              baseId: base.id,
              data: row,
            },
          })
        )
      );

      return base;
    }),
  getTable: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const base = await ctx.prisma.base.findUnique({
        where: { id: input.baseId },
        select: {
          id: true,
          name: true,
        },
      });
      const columns = await ctx.prisma.column.findMany({
        where: { baseId: input.baseId },
        orderBy: { order: "asc" },
      });
      // Don't return rows here since we use pagination
      return { ...base, columns, rows: [] };
    }),

  addColumn: protectedProcedure
    .input(
      z.object({
        baseId: z.string(),
        name: z.string(),
        order: z.number(),
        type: z.nativeEnum(ColumnType),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.column.create({
        data: {
          baseId: input.baseId,
          name: input.name,
          order: input.order,
          type: input.type,
        },
      });
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
        baseId: z.string(),
        data: tableRowSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.row.create({
        data: {
          baseId: input.baseId,
          data: input.data,
        },
      });
    }),
  addManyRows: protectedProcedure
    .input(
      z.object({
        baseId: z.string(),
        rows: z.array(z.record(z.string(), z.any())),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const createdRows = await ctx.prisma.$transaction(
        input.rows.map((rowData) =>
          ctx.prisma.row.create({
            data: {
              baseId: input.baseId,
              data: rowData,
            },
          })
        )
      );
      return { rows: createdRows };
    }),
  getRowsInfinite: protectedProcedure
    .input(
      z.object({
        baseId: z.string(),
        limit: z.number(),
        cursor: z.string().nullish(), // cursor can be a string or null
        searchTerm: z.string().optional(),
        filters: z.array(filterSchema).optional(),
        sortConfig: z.array(sortSchema).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { baseId, limit, cursor, searchTerm, filters, sortConfig } = input;

      const where: Prisma.RowWhereInput = { baseId };
      const whereConditions: Prisma.RowWhereInput[] = [];
      const columns = await ctx.prisma.column.findMany({
        where: { baseId: input.baseId },
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
        const rows = await ctx.prisma.row.findMany({
          where,
          select: {
            id: true,
            baseId: true,
            data: true,
            // Don't select createdAt/updatedAt for better performance
          },
          orderBy: [{ id: "asc" }],
          cursor: cursor ? { id: cursor } : undefined,
          take: limit + 1,
        });

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
      const orderBy: Prisma.RowOrderByWithRelationInput[] = [{ id: "asc" }];
      const fetchLimit = Math.min(limit * 10, 5000); // Fetch at most 5000 rows for sorting

      const rows = await ctx.prisma.row.findMany({
        where,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        orderBy,
        cursor: cursor ? { id: cursor } : undefined,
        take: fetchLimit + 1, // get extra items for sorting and pagination
      });

      // Apply sorting in JavaScript since Prisma JSON field sorting is limited
      let sortedRows = rows;
      if (sortConfig && sortConfig.length > 0) {
        sortedRows = [...rows].sort((a, b) => {
          for (const sort of sortConfig) {
            const { columnId, direction } = sort;

            // Extract values from JSON data
            const aData = a.data as Record<string, unknown>;
            const bData = b.data as Record<string, unknown>;
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
              // Text comparison
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
      let nextCursor: string | undefined = undefined;
      if (sortedRows.length > limit) {
        // Take only the requested number of rows
        const returnRows = sortedRows.slice(0, limit);
        const nextItem = sortedRows[limit];
        nextCursor = nextItem?.id;
        sortedRows = returnRows;
      }

      return {
        rows: sortedRows,
        nextCursor,
      };
    }),
  updateRow: protectedProcedure
    .input(z.object({ rowId: z.string(), data: z.record(z.string(), z.any()) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.row.update({
        where: { id: input.rowId },
        data: { data: input.data },
      });
    }),
});
