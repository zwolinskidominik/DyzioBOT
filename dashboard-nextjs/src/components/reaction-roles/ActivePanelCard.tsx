"use client";

import { useState } from "react";
import { ChevronDown, Hash, Loader2, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { EmojiDisplay } from "@/components/EmojiDisplay";
import { cn } from "@/lib/utils";

interface Role {
  id: string;
  name: string;
  color: number;
}

interface ReactionMapping {
  emoji: string;
  roleId: string;
  description?: string | undefined;
}

interface ReactionRole {
  _id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  title?: string | undefined;
  reactions: ReactionMapping[];
}

interface ActivePanelCardProps {
  reactionRole: ReactionRole;
  channelName: string;
  roles: Role[];
  isEditing: boolean;
  isResending: boolean;
  defaultOpen?: boolean | undefined;
  onResend: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function formatRoleCount(count: number): string {
  if (count === 1) return "1 rola";
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return `${count} role`;
  }
  return `${count} ról`;
}

export function ActivePanelCard({
  reactionRole,
  channelName,
  roles,
  isEditing,
  isResending,
  defaultOpen = false,
  onResend,
  onEdit,
  onDelete,
}: ActivePanelCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const getRoleName = (roleId: string) => roles.find((r) => r.id === roleId)?.name ?? roleId;
  const getRoleColor = (roleId: string) => roles.find((r) => r.id === roleId)?.color ?? 0;
  const roleColorStyle = (roleId: string): string => {
    const color = getRoleColor(roleId);
    return color ? `#${color.toString(16).padStart(6, "0")}` : "transparent";
  };

  return (
    <div className="overflow-hidden rounded-md bg-dark-800 shadow-[0_8px_18px_rgba(8,10,16,0.16)]">
      <div className="flex items-center justify-between px-5 py-3">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
        >
          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-sm font-semibold text-white/90">
              {reactionRole.title ?? "Wybierz swoją rolę"}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-[#8d94a8]">
              <Hash className="h-3 w-3" />
              <span>{channelName}</span>
              <span>·</span>
              <span>{formatRoleCount(reactionRole.reactions.length)}</span>
            </div>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1 pl-4">
          <button
            type="button"
            onClick={onResend}
            disabled={isResending || isEditing}
            title="Wyślij ponownie"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#8d94a8] transition-colors hover:bg-dark-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isResending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={isEditing}
            title="Edytuj"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#8d94a8] transition-colors hover:bg-dark-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Usuń"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#8d94a8] transition-colors hover:bg-dark-900 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label={isOpen ? "Zwiń panel" : "Rozwiń panel"}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#9aa2b8] transition-colors hover:bg-dark-900 hover:text-white"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="space-y-2 border-t border-[#2f3341] px-5 py-3">
          {reactionRole.reactions.map((reaction, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                <EmojiDisplay emoji={reaction.emoji} size={20} />
              </span>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20"
                style={{ backgroundColor: roleColorStyle(reaction.roleId) }}
              />
              <span className="text-sm font-medium text-white/90">{getRoleName(reaction.roleId)}</span>
              {reaction.description ? (
                <span className="text-xs text-[#8d94a8]">• {reaction.description}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
