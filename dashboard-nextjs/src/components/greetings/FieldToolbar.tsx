"use client";

import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Braces } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import EmojiPicker from "@/components/EmojiPicker";
import { cn } from "@/lib/utils";

export interface ToolbarVariable {
  name: string;
  display: string;
  value: string;
  description: string;
}

// Colourful set used for the Discord-like hover animation on the trigger.
const HOVER_EMOJIS = ["😀", "😎", "🥳", "🔥", "❤️", "✨", "🎉", "👍", "😍", "🤩", "🚀", "🌟", "😂", "💜", "⭐"];

function pickHoverEmoji(exclude?: string | null) {
  let choice = HOVER_EMOJIS[Math.floor(Math.random() * HOVER_EMOJIS.length)];
  if (exclude && HOVER_EMOJIS.length > 1) {
    while (choice === exclude) {
      choice = HOVER_EMOJIS[Math.floor(Math.random() * HOVER_EMOJIS.length)];
    }
  }
  return choice;
}

/**
 * Discord-style emoji trigger: a random greyscale emoji on start that changes
 * (but stays greyscale) on every hover. Persists after hover-out — never resets.
 * Forwards ref/props so it works as a Radix PopoverTrigger.
 */
export const EmojiTriggerButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function EmojiTriggerButton({ className, onMouseEnter, ...props }, ref) {
    const [emoji, setEmoji] = useState<string>(() => pickHoverEmoji());

    return (
      <button
        ref={ref}
        type="button"
        aria-label="Wstaw emoji"
        title="Wstaw emoji"
        onMouseEnter={(event) => {
          setEmoji((current) => pickHoverEmoji(current));
          onMouseEnter?.(event);
        }}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded text-[#b5bac1] transition-all duration-150",
          className
        )}
        {...props}
      >
        <span className="text-base leading-none" style={{ filter: "grayscale(1)" }}>{emoji}</span>
      </button>
    );
  }
);

export function EmojiToolbarButton({
  onInsert,
  hideTabs,
  triggerClassName,
}: {
  onInsert: (text: string) => void;
  hideTabs?: Array<"custom" | "bot">;
  triggerClassName?: string;
}) {
  return (
    <EmojiPicker
      onEmojiSelect={onInsert}
      hideTabs={hideTabs}
      align="end"
      side="top"
      trigger={<EmojiTriggerButton className={triggerClassName} />}
    />
  );
}

export function VariablesMenu({
  variables,
  onInsert,
}: {
  variables: ToolbarVariable[];
  onInsert: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Wstaw zmienną"
          title="Wstaw zmienną"
          className="flex h-7 w-7 items-center justify-center rounded text-[#b5bac1] transition-colors hover:bg-[#404249] hover:text-white"
        >
          <Braces className="h-[18px] w-[18px]" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" sideOffset={8} className="w-60 rounded-lg border border-[#1f2024] bg-[#2b2d31] p-1">
        <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#949ba4]">Zmienne</p>
        <div className="max-h-64 overflow-y-auto">
          {variables.map((variable) => (
            <button
              key={variable.value}
              type="button"
              onClick={() => {
                onInsert(variable.value);
                setOpen(false);
              }}
              className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-[#404249]"
            >
              <span className="mt-0.5 shrink-0 rounded bg-[#1e1f22] px-1.5 py-0.5 font-mono text-[11px] text-[#58a6ff]">
                {variable.value}
              </span>
              <span className="min-w-0 text-xs text-[#c4cad8]">{variable.description}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Inline single-line field (header / title / footer) with a toolbar that reveals
 * a variables menu and an emoji picker on focus/hover, inserting at the cursor.
 * Variables are rendered as atomic, non-editable chips (like the description
 * editor) so they cannot be partially broken by editing.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderInlineHtml(text: string, variables: ToolbarVariable[]): string {
  if (!text) return "";
  // Tokenize on variable values so surrounding text gets HTML-escaped while
  // variables become atomic chips.
  const tokens = variables.map((v) => v.value).filter(Boolean);
  if (tokens.length === 0) return escapeHtml(text);

  const pattern = new RegExp(`(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return text
    .split(pattern)
    .map((part) => {
      const variable = variables.find((v) => v.value === part);
      if (variable) {
        return `<span class="variable-tag" contenteditable="false" data-variable="${escapeHtml(variable.value)}">${escapeHtml(variable.display)}</span>`;
      }
      return escapeHtml(part).replace(/\n/g, " ");
    })
    .join("");
}

export function extractInlineText(root: HTMLElement): string {
  const temp = document.createElement("div");
  temp.innerHTML = root.innerHTML;

  temp.querySelectorAll("br").forEach((br) => {
    br.parentNode?.replaceChild(document.createTextNode(" "), br);
  });

  temp.querySelectorAll(".variable-tag").forEach((el) => {
    const varValue = el.getAttribute("data-variable") || "";
    el.parentNode?.replaceChild(document.createTextNode(varValue), el);
  });

  return (temp.textContent || "").replace(/\n/g, " ");
}

function getInlineCursorOffset(root: Node, node: Node, offset: number): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let total = 0;
  let current: Node | null;
  while ((current = walker.nextNode())) {
    if (current === node) return total + offset;
    total += current.textContent?.length || 0;
  }
  return total;
}

function setInlineCursorOffset(root: HTMLElement, offset: number): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let current = 0;
  let node: Node | null;
  const selection = window.getSelection();
  while ((node = walker.nextNode())) {
    const len = node.textContent?.length || 0;
    if (current + len >= offset) {
      const range = document.createRange();
      range.setStart(node, Math.min(offset - current, len));
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    current += len;
  }
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function InlineToolbarField({
  value,
  onChange,
  placeholder,
  variables,
  inputClassName,
  containerClassName,
  leading,
  hideEmojiTabs,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  variables: ToolbarVariable[];
  inputClassName?: string;
  containerClassName?: string;
  leading?: ReactNode;
  hideEmojiTabs?: Array<"custom" | "bot">;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternal = useRef(false);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (isInternal.current) {
      isInternal.current = false;
      return;
    }
    if (extractInlineText(editor) === value) return;

    const selection = window.getSelection();
    const hadFocus = document.activeElement === editor;
    let cursor = 0;
    if (hadFocus && selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      cursor = getInlineCursorOffset(editor, range.startContainer, range.startOffset);
    }

    editor.innerHTML = renderInlineHtml(value, variables);

    if (hadFocus) {
      editor.focus();
      setInlineCursorOffset(editor, cursor);
    }
  }, [value, variables]);

  const emit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    isInternal.current = true;
    onChange(extractInlineText(editor));
  };

  const insert = (text: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    const variable = variables.find((v) => v.value === text);
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }

    const range = selection?.getRangeAt(0);
    if (!range) {
      isInternal.current = true;
      onChange(value + text);
      return;
    }
    range.deleteContents();

    if (variable) {
      const span = document.createElement("span");
      span.className = "variable-tag";
      span.contentEditable = "false";
      span.setAttribute("data-variable", variable.value);
      span.textContent = variable.display;
      const space = document.createTextNode("\u00A0");
      range.insertNode(space);
      range.insertNode(span);
      range.setStartAfter(space);
      range.setEndAfter(space);
    } else {
      const node = document.createTextNode(text);
      range.insertNode(node);
      range.setStartAfter(node);
      range.setEndAfter(node);
    }
    selection?.removeAllRanges();
    selection?.addRange(range);
    emit();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") event.preventDefault();
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain").replace(/\n/g, " ");
    document.execCommand("insertText", false, text);
  };

  return (
    <div className={cn("group/field relative flex items-start gap-2", containerClassName)}>
      {leading}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        onInput={emit}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className={cn("inline-chip-field min-w-0 flex-1 whitespace-normal break-words outline-none", inputClassName)}
      />
      <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/field:opacity-100 group-focus-within/field:opacity-100">
        <VariablesMenu variables={variables} onInsert={insert} />
        <EmojiToolbarButton onInsert={insert} hideTabs={hideEmojiTabs} />
      </div>

      <style jsx global>{`
        .inline-chip-field[data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #8d94a8;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
