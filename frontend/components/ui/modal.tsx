import { useEffect, useRef } from "react";

type ModalProps = {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  isLarge?: boolean;
  isNoPadding?: boolean;
  isSticky?: boolean;
};

export const Modal = ({ children, isOpen, onClose, title, isLarge = false, isNoPadding = false, isSticky = false }: ModalProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        dialog.showModal();
        document.body.style.overflow = "hidden";
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
    } else {
      if (dialog.open) {
        dialog.close();
        document.body.style.overflow = "";
        document.body.style.paddingRight = "";
      }
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={"backdrop:bg-tournament-primary/50 backdrop:backdrop-blur-sm open:animate-in open:fade-in-0 open:zoom-in-95 rounded-lg p-0 shadow-xl m-auto bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700" + (isLarge ? " " : " max-w-2xl ") + "w-full"}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 md:px-5 md:py-4 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{title}</h2>
          <button
            type="button"
            className="rounded-md p-1 cursor-pointer text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className={(isSticky ? "" : "overflow-y-auto") + (isNoPadding ? "" : " p-3 md:p-5")}>
          {children}
        </div>
      </div>
    </dialog>
  );
};
