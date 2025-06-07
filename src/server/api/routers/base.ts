// import { z } from "zod";
// import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// export const baseRouter = createTRPCRouter({
//   getAll: protectedProcedure.query(async ({ ctx }) => {
//     return ctx.prisma.base.findMany({
//       where: { userId: ctx.session.user.id },
//       orderBy: { createdAt: "desc" },
//     });
//   }),
//   create: protectedProcedure
//     .input(z.object({ name: z.string().min(1) }))
//     .mutation(async ({ ctx, input }) => {
//       return ctx.prisma.base.create({
//         data: {
//           name: input.name,
//           userId: ctx.session.user.id,
//         },
//       });
//     }),
// });
