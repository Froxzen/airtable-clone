import { type ColumnType } from "@prisma/client";

export interface Column {
  id: string;
  baseId: string;
  name: string;
  order: number;
  type: ColumnType;
}

export interface Base {
  id?: string;
  name: string;
  columns: Column[];
}
