"use client";

import Image from "next/image";
import { useMemo, useState, type ChangeEvent } from "react";
import { ArrowDown, CircleUserRound, Edit3, Eye, Image as ImageIcon, ImageOff, X } from "lucide-react";
import { toast } from "sonner";
import EmbedColorPicker from "@/components/EmbedColorPicker";
import VariableInserter from "@/components/VariableInserter";
import { InlineToolbarField } from "@/components/greetings/FieldToolbar";
import { cn } from "@/lib/utils";
import {
  GREETING_VARIABLES,
  GreetingMessagePreview,
  SAMPLE_MEMBER_AVATAR,
  type GreetingAuthorIconMode,
  type GreetingImageMode,
  type GreetingImageSlot,
  type GreetingMessageMode,
  type GreetingModuleKey,
  type GreetingThumbnailMode,
} from "@/components/greetings/GreetingMessagePreview";

export type GreetingMessageField =
  | "messageMode"
  | "message"
  | "titleText"
  | "embedColor"
  | "headerText"
  | "footerText"
  | "imageMode"
  | "thumbnailMode"
  | "authorIconMode";

export interface GreetingMessageEditorValue {
  messageMode: GreetingMessageMode;
  message: string;
  titleText: string;
  embedColor: string;
  headerText: string;
  footerText: string;
  imageMode: GreetingImageMode;
  thumbnailMode: GreetingThumbnailMode;
  authorIconMode: GreetingAuthorIconMode;
  thumbnailUrl: string | null;
  customThumbnailUrl: string | null;
  customImageUrl: string | null;
  headerIconUrl: string | null;
  footerIconUrl: string | null;
  previewGifUrl: string | null;
}

interface GreetingMessageEditorProps {
  moduleKey: GreetingModuleKey;
  title: string;
  value: GreetingMessageEditorValue;
  topFields?: React.ReactNode;
  hideGifs?: boolean;
  onValueChange: (field: GreetingMessageField, value: string) => void;
  onImageSelect: (slot: GreetingImageSlot, file: File) => void;
  onImageClear?: (slot: GreetingImageSlot) => void;
  activeGifCount?: number;
  onManageGifs?: () => void;
}

function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-md px-3 text-xs font-semibold transition-colors",
        active
          ? "bg-bot-primary text-white"
          : "bg-dark-900 text-[#9aa2b8] hover:bg-dark-700 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

export function GreetingMessageEditor({
  moduleKey,
  title,
  value,
  topFields,
  hideGifs,
  onValueChange,
  onImageSelect,
  onImageClear,
  activeGifCount,
  onManageGifs,
}: GreetingMessageEditorProps) {
  // If gifs are disabled and current mode is "gifs", silently switch to "none"
  if (hideGifs && value.imageMode === "gifs") {
    onValueChange("imageMode", "none");
  }
  const [editorMode, setEditorMode] = useState<"editor" | "preview">("editor");
  const [draftEmbedColor, setDraftEmbedColor] = useState<string | null>(null);
  const activeEmbedColor = draftEmbedColor || value.embedColor;
  const isEmbed = value.messageMode === "embed";
  const embedImageUrl = value.imageMode === "custom"
    ? value.customImageUrl
    : value.imageMode === "gifs"
      ? value.previewGifUrl
      : null;
  const showHeaderRow = editorMode === "editor" || value.headerText.trim().length > 0;
  const showFooterRow = editorMode === "editor" || value.footerText.trim().length > 0;
  const showImageSlot = editorMode === "editor" || Boolean(embedImageUrl);
  const moduleLabel = useMemo(() => {
    if (moduleKey === "dm") return "Prywatna wiadomość";
    if (moduleKey === "goodbye") return "Pożegnanie";
    return "Powitanie";
  }, [moduleKey]);

  const handleImageInput = (event: ChangeEvent<HTMLInputElement>, slot: GreetingImageSlot) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Plik musi być obrazem");
      return;
    }

    onImageSelect(slot, file);
  };

  const renderClearButton = (slot: GreetingImageSlot, label: string, size: "sm" | "md") => {
    if (editorMode !== "editor" || !onImageClear) return null;
    return (
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onImageClear(slot);
        }}
        className={cn(
          "absolute -right-1.5 -top-1.5 z-10 hidden items-center justify-center rounded-full bg-red-500 text-white shadow group-hover:flex focus-visible:flex",
          size === "md" ? "h-5 w-5" : "h-4 w-4"
        )}
        aria-label={`Usuń ${label}`}
        title={`Usuń ${label}`}
      >
        <X className={size === "md" ? "h-3 w-3" : "h-2.5 w-2.5"} />
      </button>
    );
  };

  const renderInlineImageUpload = (slot: Extract<GreetingImageSlot, "headerIcon" | "footerIcon">, imageUrl: string | null, label: string) => (
    <div className="group relative">
      <label
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[3px] text-[#8d94a8] transition-colors",
          editorMode === "editor" && "cursor-pointer",
          imageUrl
            ? "border border-transparent bg-transparent"
            : editorMode === "editor"
              ? "border border-dashed border-[#596276] bg-dark-800 hover:border-[#3b82f6] hover:text-white"
              : "border border-transparent bg-transparent"
        )}
        aria-label={label}
        title={label}
      >
        {imageUrl ? <img src={imageUrl} alt={label} className="h-full w-full rounded-[3px] object-cover" /> : <CircleUserRound className="h-4 w-4" />}
        {editorMode === "editor" ? (
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleImageInput(event, slot)}
          />
        ) : null}
      </label>
      {imageUrl ? renderClearButton(slot, label, "sm") : null}
    </div>
  );

  const renderAuthorIconToggle = () => {
    const isOn = value.authorIconMode === "avatar";
    return (
      <button
        type="button"
        onClick={() => onValueChange("authorIconMode", isOn ? "none" : "avatar")}
        title={isOn ? "Ukryj awatar przy nagłówku" : "Pokaż awatar użytkownika przy nagłówku"}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border text-[#8d94a8] transition-colors",
          isOn
            ? "border-[#2f3341] bg-dark-800 text-[#c4cad8]"
            : "border-dashed border-[#596276] bg-dark-800 hover:border-[#3b82f6] hover:text-white"
        )}
      >
        {isOn ? (
          <img src={SAMPLE_MEMBER_AVATAR} alt="Awatar autora" className="h-full w-full object-cover" />
        ) : (
          <CircleUserRound className="h-4 w-4" />
        )}
      </button>
    );
  };

  const renderThumbnailSlot = () => {
    if (value.thumbnailMode === "none") {
      return (
        <div className="hidden h-[76px] w-[76px] shrink-0 items-center justify-center rounded-md border border-dashed border-[#596276] bg-dark-800 text-[#8d94a8] sm:flex" title="Brak miniatury">
          <ImageOff className="h-7 w-7" />
        </div>
      );
    }

    if (value.thumbnailMode === "avatar") {
      return (
        <div className="hidden h-[76px] w-[76px] shrink-0 overflow-hidden rounded-md sm:block" title="Awatar użytkownika">
          {value.thumbnailUrl ? (
            <img src={value.thumbnailUrl} alt="Awatar użytkownika" className="h-full w-full rounded-[3px] object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-dark-800 text-[#8d94a8]"><CircleUserRound className="h-7 w-7" /></div>
          )}
        </div>
      );
    }

    return (
      <div className="group relative hidden shrink-0 sm:block">
        <label
          className={cn(
            "flex h-[76px] w-[76px] cursor-pointer items-center justify-center overflow-hidden rounded-md text-[#8d94a8] transition-colors",
            value.customThumbnailUrl
              ? "border border-transparent bg-transparent"
              : "border border-dashed border-[#596276] bg-dark-800 hover:border-[#3b82f6] hover:text-white"
          )}
        >
          {value.customThumbnailUrl ? (
            <img src={value.customThumbnailUrl} alt="Miniatura embeda" className="h-full w-full rounded-[3px] object-cover" />
          ) : (
            <CircleUserRound className="h-7 w-7" />
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleImageInput(event, "thumbnail")}
          />
        </label>
        {value.customThumbnailUrl ? renderClearButton("thumbnail", "miniaturę", "md") : null}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {topFields ? <div className="space-y-4 border-b border-[#2f3341] pb-5">{topFields}</div> : null}

      <div className="space-y-3">
        <p className="text-sm font-medium text-[#d8dbe6]">{title}</p>
        <div className="grid w-full max-w-[432px] grid-cols-2 gap-2 rounded-md bg-dark-900 p-1">
          <ModeButton active={value.messageMode === "embed"} onClick={() => onValueChange("messageMode", "embed")}>
            Embed
          </ModeButton>
          <ModeButton active={value.messageMode === "text"} onClick={() => onValueChange("messageMode", "text")}>
            Tekst
          </ModeButton>
        </div>
      </div>

      {value.messageMode === "text" ? (
        <div className="w-full max-w-[484px]">
          <div className="flex items-start gap-3">
            <div className="flex w-10 shrink-0 flex-col items-center gap-2">
              <Image src="/deezy.png" alt="Deezy" width={40} height={40} className="rounded-full" />
              <button
                type="button"
                onClick={() => setEditorMode((mode) => (mode === "editor" ? "preview" : "editor"))}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-bot-primary text-white transition-colors hover:bg-bot-blue"
                aria-label={editorMode === "editor" ? "Pokaż Discord preview message" : "Wróć do edytora"}
                title={editorMode === "editor" ? "DISCORD PREVIEW MESSAGE" : "EDYTOR"}
              >
                {editorMode === "editor" ? <Eye className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
              </button>
            </div>
            <div className="min-w-0 w-[432px] max-w-[calc(100%_-_52px)] flex-none">
              <div className="flex min-h-10 flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-white">Deezy</span>
                <span className="rounded bg-discord-blurple px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">BOT</span>
                <span className="text-xs text-[#8d94a8]">dziś o 21:37</span>
              </div>
              <div className="mt-2">
                {editorMode === "editor" ? (
                  <VariableInserter
                    value={value.message}
                    onChange={(nextValue) => onValueChange("message", nextValue)}
                    placeholder={`Napisz treść: ${moduleLabel.toLowerCase()}...`}
                    variables={GREETING_VARIABLES}
                    rows={6}
                    emojiPicker
                    unstyled
                    containerClassName="discord-embed-editor"
                    toolbarClassName="mt-2 gap-1.5"
                    variableLabel="Zmienne:"
                    variableButtonClassName="border-[#2f3341] bg-dark-900 px-2 py-1 text-[11px] text-[#58a6ff] hover:border-[#3b82f6]/60 hover:bg-dark-700 hover:text-[#8ec5ff]"
                    className="discord-preview-editor rounded-md border border-dashed border-[#2f3341] bg-dark-900 px-3 py-2 text-sm leading-5 text-[#d8dbe6] transition-colors hover:border-[#3b82f6]/60 focus:border-solid focus:border-bot-primary focus:outline-none focus:ring-1 focus:ring-bot-primary/60"
                  />
                ) : (
                  <GreetingMessagePreview
                    messageMode="text"
                    message={value.message}
                    titleText=""
                    embedColor={activeEmbedColor}
                    headerText=""
                    footerText=""
                    thumbnailUrl={null}
                    headerIconUrl={null}
                    footerIconUrl={null}
                    imageUrl={null}
                    onClick={() => setEditorMode("editor")}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-[484px]">
          <div className="flex items-start gap-3">
            <div className="flex w-10 shrink-0 flex-col items-center gap-2">
              <Image src="/deezy.png" alt="Deezy" width={40} height={40} className="rounded-full" />
              <EmbedColorPicker
                value={value.embedColor}
                onPreviewChange={setDraftEmbedColor}
                onChange={(color) => {
                  onValueChange("embedColor", color);
                  setDraftEmbedColor(null);
                }}
              />
              <button
                type="button"
                onClick={() => setEditorMode((mode) => (mode === "editor" ? "preview" : "editor"))}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-bot-primary text-white transition-colors hover:bg-bot-blue"
                aria-label={editorMode === "editor" ? "Pokaż Discord preview message" : "Wróć do edytora"}
                title={editorMode === "editor" ? "DISCORD PREVIEW MESSAGE" : "EDYTOR"}
              >
                {editorMode === "editor" ? <Eye className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
              </button>
            </div>

            <div className="min-w-0 w-[432px] max-w-[calc(100%_-_52px)] flex-none">
              <div className="flex min-h-10 flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-white">Deezy</span>
                <span className="rounded bg-discord-blurple px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">BOT</span>
                <span className="text-xs text-[#8d94a8]">dziś o 21:37</span>
              </div>

              <div className="relative mt-2 w-[432px] max-w-full">
                {editorMode === "preview" ? (
                  <GreetingMessagePreview
                    messageMode="embed"
                    titleText={value.titleText}
                    message={value.message}
                    embedColor={activeEmbedColor}
                    headerText={value.headerText}
                    footerText={value.footerText}
                    thumbnailUrl={value.thumbnailUrl}
                    headerIconUrl={value.headerIconUrl}
                    footerIconUrl={value.footerIconUrl}
                    imageUrl={embedImageUrl}
                    onClick={() => setEditorMode("editor")}
                  />
                ) : (
                  <div className="relative w-[432px] max-w-full overflow-hidden rounded-md bg-dark-900 shadow-[0_10px_30px_rgba(6,8,14,0.35)]">
                    <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: activeEmbedColor }} />
                    <div className="p-3 pl-5">
                      <div className="flex items-start gap-4">
                        <div className="min-w-0 flex-1">
                          {showHeaderRow ? (
                            <InlineToolbarField
                              value={value.headerText}
                              onChange={(next) => onValueChange("headerText", next)}
                              placeholder="Header"
                              variables={GREETING_VARIABLES}
                              leading={renderAuthorIconToggle()}
                              containerClassName="text-xs text-[#8d94a8]"
                              inputClassName="rounded-md border border-[#3f4455] bg-dark-800 pl-2.5 py-1.5 text-xs text-[#c4cad8] outline-none transition-colors placeholder:text-[#8d94a8] hover:border-[#3b82f6]/70 focus:border-bot-primary focus:ring-2 focus:ring-bot-primary/30 focus:ring-offset-0"
                            />
                          ) : null}

                          <InlineToolbarField
                            value={value.titleText}
                            onChange={(next) => onValueChange("titleText", next)}
                            placeholder="Tytuł embeda"
                            variables={GREETING_VARIABLES}
                            containerClassName={showHeaderRow ? "mt-2" : ""}
                            inputClassName="rounded-md border border-[#3f4455] bg-dark-800 pl-2.5 py-1.5 text-sm font-semibold text-white outline-none transition-colors placeholder:text-[#8d94a8] hover:border-[#3b82f6]/70 focus:border-bot-primary focus:ring-2 focus:ring-bot-primary/30 focus:ring-offset-0"
                          />

                          <div className="mt-2">
                            <VariableInserter
                              value={value.message}
                              onChange={(nextValue) => onValueChange("message", nextValue)}
                              placeholder={`Napisz treść: ${moduleLabel.toLowerCase()}...`}
                              variables={GREETING_VARIABLES}
                              rows={5}
                              emojiPicker
                              unstyled
                              containerClassName="discord-embed-editor"
                              toolbarClassName="mt-2 gap-1.5"
                              variableLabel="Zmienne:"
                              variableButtonClassName="border-[#2f3341] bg-dark-900 px-2 py-1 text-[11px] text-[#58a6ff] hover:border-[#3b82f6]/60 hover:bg-dark-700 hover:text-[#8ec5ff]"
                              className="discord-preview-editor rounded-md border border-[#3f4455] bg-dark-800 text-sm leading-5 text-[#d8dbe6] transition-colors hover:border-[#3b82f6]/70 focus:border-bot-primary focus:ring-2 focus:ring-bot-primary/30 focus:ring-offset-0"
                            />
                          </div>
                        </div>

                        {renderThumbnailSlot()}
                      </div>

                      <div className="mt-4">
                        <p className="mb-2 text-xs font-semibold text-[#9aa2b8]">Miniatura (thumbnail)</p>
                        <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                          {([
                            ["avatar", "Awatar"],
                            ["custom", "Własny"],
                            ["none", "Brak"],
                          ] as const).map(([mode, label]) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => onValueChange("thumbnailMode", mode)}
                              className={cn(
                                "rounded-md border px-2 py-1.5 transition-colors",
                                value.thumbnailMode === mode
                                  ? "border-bot-primary bg-bot-primary text-white"
                                  : "border-[#2f3341] bg-dark-800 text-[#9aa2b8] hover:border-bot-primary/60 hover:text-white"
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-semibold">
                        {([
                          ["gifs", "GIF-y"],
                          ["custom", "Własny obraz"],
                          ["none", "Wyłączone"],
                        ] as const).filter(([mode]) => !(hideGifs && mode === "gifs")).map(([mode, label]) => {
                          const isActive = value.imageMode === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => onValueChange("imageMode", mode)}
                              className={cn(
                                "flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors",
                                isActive
                                  ? "border-bot-primary bg-bot-primary text-white"
                                  : "border-[#2f3341] bg-dark-800 text-[#9aa2b8] hover:border-bot-primary/60 hover:text-white"
                              )}
                            >
                              {label}
                              {mode === "gifs" && typeof activeGifCount === "number" ? (
                                <span
                                  className={cn(
                                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                                    isActive ? "bg-white/20 text-white" : "bg-bot-primary/15 text-[#9cc2ff]"
                                  )}
                                  title={`Aktywne GIF-y: ${activeGifCount}`}
                                >
                                  {activeGifCount}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>

                      {value.imageMode === "gifs" && onManageGifs ? (
                        <button
                          type="button"
                          onClick={onManageGifs}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#58a6ff] transition-colors hover:text-[#8ec5ff]"
                        >
                          Zarządzaj GIF-ami
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      ) : null}

                      {showImageSlot ? (
                        <label
                          className={cn(
                            "mt-4 flex h-[136px] w-full items-center justify-center overflow-hidden rounded-md text-[#8d94a8] transition-colors",
                            embedImageUrl ? "border border-transparent bg-transparent" : "border border-dashed border-[#596276] bg-dark-800",
                            "cursor-pointer hover:border-[#3b82f6] hover:text-white"
                          )}
                        >
                          {embedImageUrl ? (
                            <img src={embedImageUrl} alt="Obraz embeda" className="h-full w-full rounded-[3px] object-cover" />
                          ) : value.imageMode === "none" ? (
                            <ImageOff className="h-7 w-7" />
                          ) : (
                            <ImageIcon className="h-7 w-7" />
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => handleImageInput(event, "image")}
                          />
                        </label>
                      ) : null}

                      {showFooterRow ? (
                        <InlineToolbarField
                          value={value.footerText}
                          onChange={(next) => onValueChange("footerText", next)}
                          placeholder="Footer"
                          variables={GREETING_VARIABLES}
                          leading={renderInlineImageUpload("footerIcon", value.footerIconUrl, "Ikona footera")}
                          containerClassName="mt-4 text-xs text-[#8d94a8]"
                          inputClassName="rounded-md border border-[#3f4455] bg-dark-800 pl-2.5 py-1.5 text-xs text-[#c4cad8] outline-none transition-colors placeholder:text-[#8d94a8] hover:border-[#3b82f6]/70 focus:border-bot-primary focus:ring-2 focus:ring-bot-primary/30 focus:ring-offset-0"
                        />
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
