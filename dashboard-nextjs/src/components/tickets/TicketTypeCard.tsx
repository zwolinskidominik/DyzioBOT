"use client";

import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { EmojiDisplay } from "@/components/EmojiDisplay";
import { cn } from "@/lib/utils";
import type { TicketTypeDraft } from "./TicketLivePreview";

interface Role {
  id: string;
  name: string;
  color: number;
}

function getRoleColor(color: number): string {
  if (color === 0) return "#99AAB5";
  return `#${color.toString(16).padStart(6, "0")}`;
}

interface TicketTypeCardProps {
  type: TicketTypeDraft;
  roles: Role[];
  highlighted?: boolean;
  isDragging?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

export function TicketTypeCard({
  type,
  roles,
  highlighted,
  isDragging,
  onEdit,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: TicketTypeCardProps) {
  const assignedRoles = type.roleIds
    .map((id) => roles.find((r) => r.id === id))
    .filter((r): r is Role => Boolean(r));

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "space-y-2 rounded-md border p-3 transition-colors duration-700",
        highlighted ? "border-emerald-500/50 bg-emerald-500/10" : "border-[#2f3341] bg-dark-900",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="flex h-6 w-6 shrink-0 cursor-grab items-center justify-center text-[#6f7690] active:cursor-grabbing"
            title="Przeciągnij, by zmienić kolejność w Discordzie"
          >
            <GripVertical className="h-4 w-4" />
          </span>
          {type.emoji ? (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              <EmojiDisplay emoji={type.emoji} size={16} />
            </span>
          ) : null}
          <span className="truncate text-sm font-semibold text-white/90">{type.name || "Bez nazwy"}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            title="Edytuj"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#8d94a8] transition-colors hover:bg-dark-800 hover:text-white"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Usuń"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#8d94a8] transition-colors hover:bg-dark-800 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {type.description ? (
        <p className="truncate pl-[34px] text-xs text-[#8d94a8]">
          {type.description.replace(/\{user\}/g, "@Użytkownik")}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 pl-[34px]">
        {assignedRoles.length > 0 ? (
          assignedRoles.map((role) => (
            <span
              key={role.id}
              className="flex items-center gap-1 rounded bg-dark-800 px-1.5 py-0.5 text-[11px] font-medium text-[#c4cad8]"
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: getRoleColor(role.color) }} />
              {role.name}
            </span>
          ))
        ) : (
          <span className="text-[11px] text-[#6f7690]">Brak roli obsługi</span>
        )}

        <span className="flex items-center gap-1.5 rounded bg-dark-800 px-1.5 py-0.5 text-[11px] font-medium text-[#c4cad8]">
          Baner
          <span
            className="h-3 w-3 shrink-0 rounded-sm"
            style={{ backgroundColor: type.color || "#5865F2" }}
          />
        </span>
      </div>
    </div>
  );
}
