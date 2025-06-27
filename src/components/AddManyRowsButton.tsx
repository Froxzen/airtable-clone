import React from "react";
import { Plus } from "lucide-react";
import { trpc } from "../utils/api";

interface AddManyRowsButtonProps {
  tableId: string | null;
  disabled?: boolean;
  onBatchComplete?: () => void; // Callback to trigger fetching new pages
  onCreationStateChange?: (isCreating: boolean) => void; // Callback to track creation state
}

const AddManyRowsButton: React.FC<AddManyRowsButtonProps> = ({
  tableId,
  disabled,
  onBatchComplete,
  onCreationStateChange,
}) => {
  const utils = trpc.useUtils();
  const { mutate: addManyRows, isLoading } = trpc.base.addManyRows.useMutation({
    onSuccess: async () => {
      // Optionally refetch or update cache here if needed
      await utils.base.getRowsInfinite.invalidate();
      // Call the callback to trigger fetching new pages
      onBatchComplete?.();
    },
    onError: (error) => {
      console.error("Failed to add rows:", error);
    },
  });

  const [progress, setProgress] = React.useState(0);

  const handleAddManyRows = async () => {
    if (!tableId || isLoading) return;

    // Notify parent that we're starting to create many rows
    onCreationStateChange?.(true);

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
      setProgress(0);
    } finally {
      onCreationStateChange?.(false);
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
