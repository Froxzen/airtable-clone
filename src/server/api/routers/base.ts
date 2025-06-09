import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

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
      return ctx.prisma.base.create({
        data: {
          name: input.name,
          userId: ctx.session.user.id,
        },
      });
    }),
  getTable: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const columns = await ctx.prisma.column.findMany({
        where: { baseId: input.baseId },
        orderBy: { order: "asc" },
      });
      const rows = await ctx.prisma.row.findMany({
        where: { baseId: input.baseId },
      });
      return { columns, rows };
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
    .input(z.object({ baseId: z.string(), data: z.any() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.row.create({
        data: {
          baseId: input.baseId,
          data: input.data,
        },
      });
    }),
});
