import React from "react";
import { Plus } from "lucide-react";
import { trpc } from "../utils/api";

interface AddManyRowsButtonProps {
  tableId: string | null;
  disabled?: boolean;
}

const AddManyRowsButton: React.FC<AddManyRowsButtonProps> = ({
  tableId,
  disabled,
}) => {
  const utils = trpc.useUtils();
  const { mutate: addManyRows, isLoading } = trpc.base.addManyRows.useMutation({
    onSuccess: async () => {
      // Optionally refetch or update cache here if needed
      await utils.base.getRowsInfinite.invalidate();
    },
    onError: (error) => {
      console.error("Failed to add rows:", error);
    },
  });

  const [progress, setProgress] = React.useState(0);

  const handleAddManyRows = async () => {
    if (!tableId || isLoading) return;
    try {
      for (let i = 0; i < 20; i++) {
        await new Promise<void>((resolve, reject) => {
          addManyRows(
            { tableId, count: 5000 },
            {
              onSuccess: () => resolve(),
              onError: (error) => reject(error),
            }
          );
        });
        setProgress(Math.round(((i + 1) / 20) * 100));
      }
      setTimeout(() => setProgress(0), 1000); // Reset after short delay
    } catch (error) {
      // Error already logged in onError
      setProgress(0);
    }
  };

  return (
    <button
      onClick={() => {
        void handleAddManyRows();
      }}
      disabled={disabled || isLoading || !tableId}
      className="flex items-center gap-1 rounded bg-white px-3 py-1 text-sm font-medium text-gray-600 shadow hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
      type="button"
    >
      {isLoading ? (
        <>
          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-gray-900" />
          Add 100k rows ({progress}%)
        </>
      ) : (
        <>
          <Plus className="h-4 w-4" />
          Add 100k rows
        </>
      )}
    </button>
  );
};

export default AddManyRowsButton;
