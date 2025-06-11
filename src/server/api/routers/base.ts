import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { faker } from "@faker-js/faker";

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
          data: { name: "Phone Number", baseId: base.id, order: 2 },
        }),
        ctx.prisma.column.create({
          data: { name: "Email", baseId: base.id, order: 3 },
        }),
      ]);

      // 3. Create 5 rows with faker data
      const [nameCol, addressCol, phoneCol, emailCol] = columns;
      const rowsData = Array.from({ length: 5 }).map(() => ({
        [nameCol.id]: faker.person.fullName(),
        [addressCol.id]: faker.location.streetAddress(),
        [phoneCol.id]: faker.phone.number(),
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
      const rows = await ctx.prisma.row.findMany({
        where: { baseId: input.baseId },
      });
      return { ...base, columns, rows };
    }),

  addColumn: protectedProcedure
    .input(
      z.object({ baseId: z.string(), name: z.string(), order: z.number() })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.column.create({
        data: {
          baseId: input.baseId,
          name: input.name,
          order: input.order,
        },
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
  updateRow: protectedProcedure
    .input(z.object({ rowId: z.string(), data: z.record(z.string(), z.any()) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.row.update({
        where: { id: input.rowId },
        data: { data: input.data },
      });
    }),
});
