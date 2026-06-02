import { Modal } from "@/components/ui/modal";

type ConfirmModalProps = {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmModal = ({
  isOpen,
  title = "Are you sure?",
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  isDangerous = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) => {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      <div className="flex flex-col gap-5">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold text-white transition " +
              (isDangerous
                ? "bg-rose-600 hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600"
                : "bg-tournament-primary hover:bg-tournament-primary")
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
