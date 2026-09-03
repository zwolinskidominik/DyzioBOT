"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Smile } from "lucide-react";

// Cały właściwy panel (dataset ~250KB + rendering siatki) jest w osobnym pliku
// i ładowany dopiero przy pierwszym otwarciu popovera — nie jako część
// initial JS bundle każdej z ~6 stron dashboardu, które używają EmojiPickera.
const EmojiPickerPanel = dynamic(() => import("./EmojiPickerPanel"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-[#6d7079]">
      Ładowanie emoji…
    </div>
  ),
});

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  buttonText?: string;
  hideTabs?: Array<"custom" | "bot">;
  /** Custom trigger element. When provided, replaces the default button. */
  trigger?: React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

export default function EmojiPicker({
  onEmojiSelect,
  buttonText = "Dodaj emoji",
  hideTabs = [],
  trigger,
  align = "start",
  side = "bottom",
}: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <Smile className="mr-2 h-4 w-4" />
            {buttonText}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-2rem)] max-w-[420px] overflow-hidden rounded-lg border border-[#1f2024] bg-[#2b2d31] p-0 sm:w-[420px]"
        align={align}
        side={side}
        sideOffset={8}
        collisionPadding={16}
      >
        {/* Capped to the viewport space Radix actually gave us — without this, a
            picker opened near the edge of the screen can get clipped by the
            viewport with no way to reach the rest via the inner scroll area. */}
        <div
          className="flex h-[400px] flex-col"
          style={{ maxHeight: "var(--radix-popover-content-available-height)" }}
        >
          {open ? (
            <EmojiPickerPanel
              hideTabs={hideTabs}
              onPick={(value) => {
                onEmojiSelect(value);
                setOpen(false);
              }}
            />
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
