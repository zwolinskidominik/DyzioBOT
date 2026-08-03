"use client";

import { useState } from "react";
import { Loader2, Mic, Pencil, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TempChannelType } from "./TempChannelLivePreview";

interface TempChannelListItemProps {
  channelId: string;
  channelName: string;
  type: TempChannelType;
  saving: boolean;
  onSave: (channelId: string, type: TempChannelType) => void | Promise<void>;
  onDelete: (channelId: string) => void;
}

export function TempChannelListItem({
  channelId,
  channelName,
  type,
  saving,
  onSave,
  onDelete,
}: TempChannelListItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftType, setDraftType] = useState<TempChannelType>(type);

  const startEdit = () => {
    setDraftType(type);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setDraftType(type);
    setIsEditing(false);
  };

  const confirmEdit = async () => {
    await onSave(channelId, draftType);
    setIsEditing(false);
  };

  return (
    <div className="overflow-hidden rounded-md border border-[#2f3341] bg-dark-900">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Mic className="h-4 w-4 shrink-0 text-[#8d94a8]" />
          <span className="truncate text-sm font-medium text-white/90">{channelName}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!isEditing ? (
            <span
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium",
                type === "panel" ? "bg-[#3b82f6]/15 text-[#7fb0ff]" : "bg-[#8d94a8]/15 text-[#c4cad8]",
              )}
            >
              {type === "panel" ? "Panel" : "Standardowy"}
            </span>
          ) : null}

          <button
            type="button"
            onClick={isEditing ? cancelEdit : startEdit}
            title={isEditing ? "Anuluj" : "Edytuj"}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#8d94a8] transition-colors hover:bg-dark-800 hover:text-white"
          >
            {isEditing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => onDelete(channelId)}
            title="Usuń"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#8d94a8] transition-colors hover:bg-dark-800 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-3 border-t border-[#2f3341] bg-dark-800 px-3 py-3">
          <div className="inline-flex rounded-md bg-dark-900 p-1">
            <button
              type="button"
              onClick={() => setDraftType("panel")}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                draftType === "panel" ? "bg-[#3b82f6] text-white" : "text-[#8d94a8] hover:text-white",
              )}
            >
              Panel zarządzania
            </button>
            <button
              type="button"
              onClick={() => setDraftType("standard")}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                draftType === "standard" ? "bg-[#3b82f6] text-white" : "text-[#8d94a8] hover:text-white",
              )}
            >
              Standardowy
            </button>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={cancelEdit}
              disabled={saving}
              className="border-[#3a3f4e] bg-transparent text-[#8d94a8] hover:bg-dark-900 hover:text-white"
            >
              Anuluj
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void confirmEdit()}
              disabled={saving}
              className="bg-[#3b82f6] text-white hover:bg-[#2563eb]"
            >
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Zapisz
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
