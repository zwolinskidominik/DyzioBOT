"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDirtyState } from "@/components/DirtyStateProvider";
import { cn } from "@/lib/utils";

export function FloatingSaveBar() {
  const { controller, attentionToken, attentionMessage } = useDirtyState();
  const [isShaking, setIsShaking] = useState(false);
  const isVisible = Boolean(controller?.isDirty);
  const isSaving = Boolean(controller?.isSaving);

  useEffect(() => {
    if (!attentionToken) return;

    setIsShaking(true);
    const timeoutId = window.setTimeout(() => setIsShaking(false), 520);

    return () => window.clearTimeout(timeoutId);
  }, [attentionToken]);

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-5 transition-all duration-200 ease-out",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      )}
      aria-hidden={!isVisible}
    >
      <div
        className={cn(
          "pointer-events-auto flex w-full max-w-xl flex-col gap-3 rounded-md border border-bot-primary/30 bg-dark-800 p-3 shadow-[0_18px_55px_rgba(3,5,12,0.55)] sm:flex-row sm:items-center sm:justify-between",
          isShaking && "dirty-save-bar-shake"
        )}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Masz niezapisane zmiany</p>
          <p className="truncate text-xs text-[#9aa2b8]">
            {isShaking ? attentionMessage : controller?.label ?? "Zapisz albo anuluj przed przejściem dalej."}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void controller?.onCancel()}
            disabled={isSaving}
            className="h-9 border-[#3a3f4e] bg-dark-900 px-3 text-xs text-white hover:bg-dark-700"
          >
            <RotateCcw className="h-4 w-4" />
            Anuluj
          </Button>
          <Button
            type="button"
            onClick={() => void controller?.onSave()}
            disabled={isSaving}
            className="h-9 bg-[#3b82f6] px-3 text-xs font-semibold text-white hover:bg-[#5b9bff]"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? "Zapisywanie" : controller?.saveLabel ?? "Zapisz"}
          </Button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes dirty-save-bar-shake-keyframes {
          0%, 100% { transform: translateX(0); }
          18% { transform: translateX(-9px); }
          36% { transform: translateX(8px); }
          54% { transform: translateX(-6px); }
          72% { transform: translateX(5px); }
        }

        .dirty-save-bar-shake {
          animation: dirty-save-bar-shake-keyframes 520ms ease-in-out;
        }
      `}</style>
    </div>
  );
}
