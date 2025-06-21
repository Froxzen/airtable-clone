import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { faker } from "@faker-js/faker";
import { ColumnType, Prisma } from "@prisma/client";

const tableRowSchema = z.record(z.string());

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
          data: { name: "Address", baseId: base.id, order: 1 },
        }),
        ctx.prisma.column.create({
          data: { name: "Email", baseId: base.id, order: 3 },
        }),
      ]);

      // 3. Create 5 rows with faker data
      const [nameCol, addressCol, emailCol] = columns;
      const rowsData = Array.from({ length: 5 }).map(() => ({
        [nameCol.id]: faker.person.fullName(),
        [addressCol.id]: faker.location.streetAddress(),
        [emailCol.id]: faker.internet.email(),
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
      await ctx.prisma.row.createMany({
        data: input.rows.map((data) => ({
          baseId: input.baseId,
          data,
        })),
      });
      return { success: true };
    }),
  getRowsInfinite: protectedProcedure
    .input(
      z.object({
        baseId: z.string(),
        limit: z.number(),
        cursor: z.string().nullish(), // cursor can be a string or null
        searchTerm: z.string().optional(),
        filters: z
          .record(z.string(), z.object({ type: z.string(), value: z.string() }))
          .optional(),
        sortConfig: z
          .object({ columnId: z.string(), direction: z.enum(["asc", "desc"]) })
          .optional(),
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
      const columnMap = new Map(columns.map((c) => [c.id, c]));

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
      if (filters) {
        const filterConditions: Prisma.RowWhereInput[] = [];
        for (const [colId, filter] of Object.entries(filters)) {
          const column = columnMap.get(colId);
          if (!column) continue;

          const { type, value } = filter;
          const isNumeric = column.type === "NUMBER";
          const filterValue = isNumeric ? Number(value) : value;

          if (isNumeric && (value === "" || isNaN(filterValue as number)))
            continue;

          switch (type) {
            case "contains":
              filterConditions.push({
                data: { path: [colId], string_contains: value },
              });
              break;
            case "notContains":
              filterConditions.push({
                NOT: { data: { path: [colId], string_contains: value } },
              });
              break;
            case "equal":
              filterConditions.push({
                data: { path: [colId], equals: filterValue },
              });
              break;
            case "notEqual":
              filterConditions.push({
                NOT: { data: { path: [colId], equals: filterValue } },
              });
              break;
            case "gt":
              if (!isNumeric) continue;
              filterConditions.push({
                data: { path: [colId], gt: filterValue },
              });
              break;
            case "lt":
              if (!isNumeric) continue;
              filterConditions.push({
                data: { path: [colId], lt: filterValue },
              });
              break;
            case "empty":
              filterConditions.push({
                OR: [
                  { data: { path: [colId], equals: Prisma.JsonNull } },
                  { data: { path: [colId], equals: "" } },
                ],
              });
              break;
            case "notEmpty":
              filterConditions.push({
                AND: [
                  {
                    NOT: { data: { path: [colId], equals: Prisma.JsonNull } },
                  },
                  { NOT: { data: { path: [colId], equals: "" } } },
                ],
              });
              break;
          }
        }
        if (filterConditions.length > 0) {
          whereConditions.push({ AND: filterConditions });
        }
      }

      if (whereConditions.length > 0) {
        where.AND = whereConditions;
      }

      // Handle sorting
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let orderBy: any = { id: "asc" };
      if (sortConfig?.columnId && sortConfig?.direction) {
        orderBy = {
          data: {
            path: [sortConfig.columnId],
            sort: sortConfig.direction,
            nulls: "last",
          },
        };
      }

      const rows = await ctx.prisma.row.findMany({
        where,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        orderBy,
        cursor: cursor ? { id: cursor } : undefined,
        take: limit + 1, // get an extra item to see if there's a next page
      });

      let nextCursor: string | undefined = undefined;
      if (rows.length > limit) {
        const nextItem = rows.pop(); // return the correct number of items
        nextCursor = nextItem?.id;
      }

      return {
        rows,
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
