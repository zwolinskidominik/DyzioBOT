"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, Eye, EyeOff, Hash, Image as ImageIcon, Mail, MessageSquare, Trash2, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { fetchGuildData } from "@/lib/cache";
import { SlideIn } from "@/components/ui/animated";
import { cn } from "@/lib/utils";
import { useDirtyState } from "@/components/DirtyStateProvider";
import {
  GreetingMessageEditor,
  type GreetingMessageEditorValue,
  type GreetingMessageField,
} from "@/components/greetings/GreetingMessageEditor";
import {
  SAMPLE_MEMBER_AVATAR,
  type GreetingImageMode,
  type GreetingImageSlot,
  type GreetingMessageMode,
  type GreetingModuleKey,
  type GreetingThumbnailMode,
} from "@/components/greetings/GreetingMessagePreview";
import {
  CHANNEL_VARIABLE_FIELD,
  CHANNEL_VARIABLE_LABEL,
  getMissingChannelVariables,
  getUsedChannelVariables,
  type ChannelVariableKey,
} from "@/lib/greetingChannelVars";

const DEFAULT_WELCOME_MESSAGE = `### Witaj {user} na {server}

**Witamy na pokładzie!**
Gratulacje, właśnie wbiłeś/aś do miejsca, w którym gry są poważniejsze niż życie… prawie.

➔ Przeczytaj {rulesChannel}
➔ Wybierz role {rolesChannel}
➔ Przywitaj się z nami {chatChannel}

**Rozgość się i znajdź ekipę do grania.**`;

const DEFAULT_DM_MESSAGE = `Cześć {username}, witaj na {server}!

Zajrzyj na {rulesChannel}, dobierz role na {rolesChannel} i śmiało wskakuj na {chatChannel}.`;
const DEFAULT_GOODBYE_MESSAGE = "Dziękujemy za wspólnie spędzony czas. Do zobaczenia!";
const MAX_GREETING_GIFS = 5;
const DEFAULT_EMBED_COLOR = "#3b82f6";
const DEFAULT_IMAGE_MODE: GreetingImageMode = "gifs";

const messageModeSchema = z.enum(["embed", "text"]);
const imageModeSchema = z.enum(["gifs", "custom", "none"]);
const thumbnailModeSchema = z.enum(["avatar", "custom", "none"]);

const greetingsSchema = z.object({
  enabled: z.boolean().default(true),
  greetingsChannelId: z.string().min(1, "Wybierz kanał powitalny"),
  goodbyeChannelId: z.string().optional(),
  rulesChannelId: z.string().optional(),
  rolesChannelId: z.string().optional(),
  chatChannelId: z.string().optional(),
  welcomeEnabled: z.boolean().default(true),
  goodbyeEnabled: z.boolean().default(true),
  dmEnabled: z.boolean().default(false),
  welcomeMessageMode: messageModeSchema.default("embed"),
  welcomeMessage: z.string().optional(),
  welcomeTitleText: z.string().optional(),
  welcomeEmbedColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default(DEFAULT_EMBED_COLOR),
  welcomeHeaderText: z.string().optional(),
  welcomeFooterText: z.string().optional(),
  welcomeImageMode: imageModeSchema.default(DEFAULT_IMAGE_MODE),
  welcomeThumbnailMode: thumbnailModeSchema.default("avatar"),
  welcomeThumbnailFile: z.string().optional(),
  welcomeCustomImageFile: z.string().optional(),
  welcomeHeaderIconFile: z.string().optional(),
  welcomeFooterIconFile: z.string().optional(),
  dmMessageMode: messageModeSchema.default("embed"),
  dmMessage: z.string().optional(),
  dmTitleText: z.string().optional(),
  dmEmbedColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default(DEFAULT_EMBED_COLOR),
  dmHeaderText: z.string().optional(),
  dmFooterText: z.string().optional(),
  dmImageMode: imageModeSchema.default(DEFAULT_IMAGE_MODE),
  dmThumbnailMode: thumbnailModeSchema.default("avatar"),
  dmThumbnailFile: z.string().optional(),
  dmCustomImageFile: z.string().optional(),
  dmHeaderIconFile: z.string().optional(),
  dmFooterIconFile: z.string().optional(),
  goodbyeMessageMode: messageModeSchema.default("embed"),
  goodbyeMessage: z.string().optional(),
  goodbyeTitleText: z.string().optional(),
  goodbyeEmbedColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ef4444"),
  goodbyeHeaderText: z.string().optional(),
  goodbyeFooterText: z.string().optional(),
  goodbyeImageMode: imageModeSchema.default("none"),
  goodbyeThumbnailMode: thumbnailModeSchema.default("avatar"),
  goodbyeThumbnailFile: z.string().optional(),
  goodbyeCustomImageFile: z.string().optional(),
  goodbyeHeaderIconFile: z.string().optional(),
  goodbyeFooterIconFile: z.string().optional(),
}).superRefine((data, ctx) => {
  const usedChannelVars = new Set<ChannelVariableKey>();
  const collect = (
    enabled: boolean,
    defaultMessage: string,
    message?: string,
    title?: string,
    header?: string,
    footer?: string
  ) => {
    if (!enabled) return;
    getUsedChannelVariables([message || defaultMessage, title, header, footer]).forEach((key) =>
      usedChannelVars.add(key)
    );
  };

  collect(data.welcomeEnabled, DEFAULT_WELCOME_MESSAGE, data.welcomeMessage, data.welcomeTitleText, data.welcomeHeaderText, data.welcomeFooterText);
  collect(data.dmEnabled, DEFAULT_DM_MESSAGE, data.dmMessage, data.dmTitleText, data.dmHeaderText, data.dmFooterText);
  collect(data.goodbyeEnabled, DEFAULT_GOODBYE_MESSAGE, data.goodbyeMessage, data.goodbyeTitleText, data.goodbyeHeaderText, data.goodbyeFooterText);

  usedChannelVars.forEach((key) => {
    const fieldId = CHANNEL_VARIABLE_FIELD[key];
    if (!data[fieldId]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [fieldId],
        message: `Ustaw ${CHANNEL_VARIABLE_LABEL[key].toLowerCase()} — używasz tej zmiennej w wiadomości.`,
      });
    }
  });

  const fallbackAvailable = Boolean(data.greetingsChannelId) && data.welcomeEnabled;
  if (data.goodbyeEnabled && !data.goodbyeChannelId && !fallbackAvailable) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["goodbyeChannelId"],
      message: "Wybierz kanał pożegnań — kanał powitalny nie jest dostępny jako zapasowy.",
    });
  }
});

type GreetingsFormData = z.infer<typeof greetingsSchema>;
type SettingsSection = "welcome" | "gifs" | "dm" | "goodbye";
type PendingImageKey = `${GreetingModuleKey}.${GreetingImageSlot}`;

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface GifFile {
  name: string;
  source: "default" | "upload";
  disabled?: boolean;
  url: string;
  pending?: boolean;
  pendingFile?: File;
}

interface PendingImage {
  moduleKey: GreetingModuleKey;
  slot: GreetingImageSlot;
  file: File;
  url: string;
}

interface SettingRowProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  isOpen?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}

interface ChannelSelectFieldProps {
  id: keyof Pick<GreetingsFormData, "greetingsChannelId" | "goodbyeChannelId" | "rulesChannelId" | "rolesChannelId" | "chatChannelId">;
  label: string;
  required?: boolean;
  helperText?: string;
  channels: Channel[];
  value?: string;
  onValueChange: (value: string) => void;
  error?: string;
}

const DEFAULT_FORM_VALUES: GreetingsFormData = {
  enabled: false,
  greetingsChannelId: "",
  goodbyeChannelId: "",
  rulesChannelId: "",
  rolesChannelId: "",
  chatChannelId: "",
  welcomeEnabled: true,
  goodbyeEnabled: true,
  dmEnabled: false,
  welcomeMessageMode: "embed",
  welcomeMessage: DEFAULT_WELCOME_MESSAGE,
  welcomeTitleText: "Witaj na {server}",
  welcomeEmbedColor: DEFAULT_EMBED_COLOR,
  welcomeHeaderText: "",
  welcomeFooterText: "",
  welcomeImageMode: DEFAULT_IMAGE_MODE,
  welcomeThumbnailMode: "avatar",
  welcomeThumbnailFile: "",
  welcomeCustomImageFile: "",
  welcomeHeaderIconFile: "",
  welcomeFooterIconFile: "",
  dmMessageMode: "embed",
  dmMessage: DEFAULT_DM_MESSAGE,
  dmTitleText: "Witaj na {server}",
  dmEmbedColor: DEFAULT_EMBED_COLOR,
  dmHeaderText: "",
  dmFooterText: "",
  dmImageMode: DEFAULT_IMAGE_MODE,
  dmThumbnailMode: "avatar",
  dmThumbnailFile: "",
  dmCustomImageFile: "",
  dmHeaderIconFile: "",
  dmFooterIconFile: "",
  goodbyeMessageMode: "embed",
  goodbyeMessage: DEFAULT_GOODBYE_MESSAGE,
  goodbyeTitleText: "Do zobaczenia, {username}",
  goodbyeEmbedColor: "#ef4444",
  goodbyeHeaderText: "",
  goodbyeFooterText: "",
  goodbyeImageMode: "none",
  goodbyeThumbnailMode: "avatar",
  goodbyeThumbnailFile: "",
  goodbyeCustomImageFile: "",
  goodbyeHeaderIconFile: "",
  goodbyeFooterIconFile: "",
};

function DeezySwitch({ className, ...props }: React.ComponentProps<typeof Switch>) {
  return (
    <Switch
      className={cn(
        "deezy-switch h-6 w-11 border-0 bg-[#636a80] shadow-none data-[state=checked]:bg-[#3b82f6] data-[state=unchecked]:bg-[#636a80] [&>span]:h-4 [&>span]:w-4 [&>span]:translate-x-1 [&>span]:bg-white [&>span]:shadow-none [&>span]:data-[state=checked]:translate-x-6 [&>span]:data-[state=unchecked]:translate-x-1",
        className
      )}
      {...props}
    />
  );
}

function ModuleDisabledNotice({ enabled, target }: { enabled: boolean; target: string }) {
  if (enabled) return null;
  return (
    <div className="mb-4 flex items-start gap-2 rounded-md border border-[#3a3f4e] bg-dark-900 px-3 py-2 text-xs text-[#9aa2b8]">
      <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        Ten typ wiadomości jest <span className="font-semibold text-white/80">wyłączony</span>. Możesz edytować i zapisać ustawienia, ale bot nie wyśle {target}, dopóki nie włączysz przełącznika powyżej.
      </span>
    </div>
  );
}

function SettingRow({ title, description, icon, checked, onCheckedChange, isOpen = false, onToggle, children }: SettingRowProps) {
  const isExpandable = Boolean(children && onToggle);

  return (
    <section className="overflow-hidden rounded-md bg-dark-800 shadow-[0_8px_18px_rgba(8,10,16,0.16)]">
      <div className={cn("flex min-h-[68px] items-center gap-4 border border-transparent px-5 py-3 transition-colors", isOpen && "border-[#2f3341] bg-dark-800")}>
        <button
          type="button"
          onClick={isExpandable ? onToggle : undefined}
          className={cn("flex min-w-0 flex-1 items-center gap-3 text-left", isExpandable ? "cursor-pointer" : "cursor-default")}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-dark-900 text-[#aab2c8]">{icon}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white/90">{title}</span>
            {description ? <span className="mt-1 block truncate text-xs text-[#8d94a8]">{description}</span> : null}
          </span>
        </button>

        {typeof checked === "boolean" && onCheckedChange ? <DeezySwitch checked={checked} onCheckedChange={onCheckedChange} /> : null}

        {isExpandable ? (
          <button type="button" onClick={onToggle} aria-label={isOpen ? "Zwiń sekcję" : "Rozwiń sekcję"} className="flex h-8 w-8 items-center justify-center rounded-md text-[#9aa2b8] transition-colors hover:bg-dark-900 hover:text-white">
            <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
          </button>
        ) : null}
      </div>

      {isOpen && children ? <div className="border-x border-b border-[#2f3341] bg-dark-800 p-5">{children}</div> : null}
    </section>
  );
}

function ChannelSelectField({ id, label, required = false, helperText, channels, value, onValueChange, error }: ChannelSelectFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-semibold text-[#c4cad8]">
        {label} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      <Select value={value || ""} onValueChange={onValueChange}>
        <SelectTrigger className="h-11 border-transparent bg-dark-900 text-white/90 focus:ring-[#3b82f6]/50 focus:ring-offset-0">
          {/* Radix ignoruje children SelectValue, gdy value="" — placeholder MUSI iść przez
              prop placeholder, inaczej trigger renderuje się pusty (bez ikony i tekstu).
              Radix sprawdza WYŁĄCZNIE surowy string value — jeśli kanał o tym ID zniknął
              (usunięty na Discordzie / dane testowe), value dalej jest "prawdziwe" i placeholder
              się nie włączy, więc obsługujemy ten przypadek ręcznie w children. */}
          <SelectValue
            placeholder={
              <div className="flex items-center gap-2 text-[#8d94a8]">
                <Hash className="h-4 w-4" />
                <span>Wybierz kanał...</span>
              </div>
            }
          >
            {value ? (
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-[#8d94a8]" />
                {channels.find((channel) => channel.id === value)?.name ?? "Wybierz kanał..."}
              </div>
            ) : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="border-[#2f3341] bg-dark-900">
          {channels.map((channel) => (
            <SelectItem key={channel.id} value={channel.id}>
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-[#8d94a8]" />
                {channel.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {helperText ? <p className="text-xs text-[#8d94a8]">{helperText}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function sortGifFiles(gifFiles: GifFile[]): GifFile[] {
  return [...gifFiles].sort((firstGif, secondGif) => Number(Boolean(firstGif.disabled)) - Number(Boolean(secondGif.disabled)));
}

function getGreetingImageUrl(guildId: string, fileName?: string): string | null {
  return fileName ? `/api/guild/${guildId}/greetings/images/${encodeURIComponent(fileName)}` : null;
}

function createPendingImageKey(moduleKey: GreetingModuleKey, slot: GreetingImageSlot): PendingImageKey {
  return `${moduleKey}.${slot}` as PendingImageKey;
}

const IMAGE_FILE_FIELD_SUFFIX: Record<GreetingImageSlot, string> = {
  thumbnail: "ThumbnailFile",
  image: "CustomImageFile",
  headerIcon: "HeaderIconFile",
  footerIcon: "FooterIconFile",
};

function getImageFileField(moduleKey: GreetingModuleKey, slot: GreetingImageSlot): keyof GreetingsFormData {
  return `${moduleKey}${IMAGE_FILE_FIELD_SUFFIX[slot]}` as keyof GreetingsFormData;
}

function createPendingGifName(fileName: string): string {
  return `pending-${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
}

function normalizeConfig(config?: Partial<GreetingsFormData>): GreetingsFormData {
  return {
    ...DEFAULT_FORM_VALUES,
    ...config,
    enabled: config?.enabled ?? DEFAULT_FORM_VALUES.enabled,
    greetingsChannelId: config?.greetingsChannelId ?? "",
    goodbyeChannelId: config?.goodbyeChannelId ?? "",
    welcomeMessage: config?.welcomeMessage || DEFAULT_WELCOME_MESSAGE,
    dmMessage: config?.dmMessage || DEFAULT_DM_MESSAGE,
    goodbyeMessage: config?.goodbyeMessage || DEFAULT_GOODBYE_MESSAGE,
    welcomeTitleText: config?.welcomeTitleText ?? DEFAULT_FORM_VALUES.welcomeTitleText,
    dmTitleText: config?.dmTitleText ?? DEFAULT_FORM_VALUES.dmTitleText,
    goodbyeTitleText: config?.goodbyeTitleText ?? DEFAULT_FORM_VALUES.goodbyeTitleText,
    welcomeMessageMode: config?.welcomeMessageMode ?? "embed",
    dmMessageMode: config?.dmMessageMode ?? "embed",
    goodbyeMessageMode: config?.goodbyeMessageMode ?? "embed",
    welcomeImageMode: config?.welcomeImageMode ?? DEFAULT_IMAGE_MODE,
    dmImageMode: config?.dmImageMode ?? DEFAULT_IMAGE_MODE,
    goodbyeImageMode: config?.goodbyeImageMode ?? "none",
    welcomeThumbnailMode: config?.welcomeThumbnailMode ?? "avatar",
    dmThumbnailMode: config?.dmThumbnailMode ?? "avatar",
    goodbyeThumbnailMode: config?.goodbyeThumbnailMode ?? "avatar",
  };
}

function getDisabledDefaultGifNames(gifFiles: GifFile[]): string[] {
  return gifFiles
    .filter((gif) => gif.source === "default" && gif.disabled)
    .map((gif) => gif.name)
    .sort();
}

function sameStringList(firstList: string[], secondList: string[]): boolean {
  return firstList.length === secondList.length && firstList.every((item, index) => item === secondList[index]);
}

export default function GreetingsPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { registerDirtyController } = useDirtyState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [gifs, setGifs] = useState<GifFile[]>([]);
  const [savedGifs, setSavedGifs] = useState<GifFile[]>([]);
  const [deletedUploadGifNames, setDeletedUploadGifNames] = useState<string[]>([]);
  const [previewGif, setPreviewGif] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<SettingsSection, boolean>>({ welcome: true, gifs: false, dm: false, goodbye: false });
  const [pendingImages, setPendingImages] = useState<Partial<Record<PendingImageKey, PendingImage>>>({});
  const pendingImagesRef = useRef(pendingImages);
  const gifsRef = useRef(gifs);
  const savedValuesRef = useRef(DEFAULT_FORM_VALUES);

  const form = useForm<GreetingsFormData>({ resolver: zodResolver(greetingsSchema), defaultValues: DEFAULT_FORM_VALUES });
  const { handleSubmit, reset, setValue, watch, formState: { errors, isDirty } } = form;
  const values = watch();

  const uploadedGifCount = gifs.filter((gif) => gif.source === "upload").length;
  const gifLimitReached = uploadedGifCount >= MAX_GREETING_GIFS;
  const pendingGifUploads = gifs.filter((gif) => gif.pending && gif.pendingFile);
  const hasGifChanges = useMemo(() => (
    !sameStringList(getDisabledDefaultGifNames(savedGifs), getDisabledDefaultGifNames(gifs))
    || deletedUploadGifNames.length > 0
    || pendingGifUploads.length > 0
  ), [deletedUploadGifNames.length, gifs, pendingGifUploads.length, savedGifs]);
  const hasPendingImages = Object.keys(pendingImages).length > 0;
  const hasDirtyChanges = isDirty || hasPendingImages || hasGifChanges;
  const previewGifUrl = gifs.find((gif) => !gif.disabled)?.url ?? null;
  const activeGifCount = gifs.filter((gif) => !gif.disabled).length;

  const gifSectionRef = useRef<HTMLDivElement>(null);
  const [gifHighlight, setGifHighlight] = useState(false);
  const gifHighlightTimer = useRef<number | null>(null);

  const handleManageGifs = useCallback(() => {
    setOpenSections((sections) => ({ ...sections, gifs: true }));
    requestAnimationFrame(() => {
      gifSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    setGifHighlight(true);
    if (gifHighlightTimer.current) window.clearTimeout(gifHighlightTimer.current);
    gifHighlightTimer.current = window.setTimeout(() => setGifHighlight(false), 1800);
  }, []);

  useEffect(() => () => {
    if (gifHighlightTimer.current) window.clearTimeout(gifHighlightTimer.current);
  }, []);

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  useEffect(() => {
    gifsRef.current = gifs;
  }, [gifs]);

  useEffect(() => () => {
    Object.values(pendingImagesRef.current).forEach((pendingImage) => {
      if (pendingImage) URL.revokeObjectURL(pendingImage.url);
    });
    gifsRef.current.forEach((gif) => {
      if (gif.pending) URL.revokeObjectURL(gif.url);
    });
  }, []);

  const toggleSection = (section: SettingsSection) => {
    setOpenSections((currentSections) => ({ ...currentSections, [section]: !currentSections[section] }));
  };

  const setBooleanField = (field: keyof Pick<GreetingsFormData, "enabled" | "welcomeEnabled" | "dmEnabled" | "goodbyeEnabled">, value: boolean) => {
    setValue(field, value, { shouldDirty: true, shouldTouch: true });
  };

  const setStringField = (field: keyof GreetingsFormData, value: string) => {
    setValue(field, value, { shouldDirty: true, shouldTouch: true });
  };

  const setMessageField = (moduleKey: GreetingModuleKey, field: GreetingMessageField, value: string) => {
    const modeValue: GreetingMessageMode = value === "text" ? "text" : "embed";
    const imageModeValue: GreetingImageMode = value === "custom" || value === "none" ? value : "gifs";
    const thumbnailModeValue: GreetingThumbnailMode = value === "custom" || value === "none" ? value : "avatar";

    if (field === "imageMode" && imageModeValue === "gifs") {
      setOpenSections((sections) => ({ ...sections, gifs: true }));
    }
    if (field === "imageMode" && imageModeValue !== "gifs") {
      setOpenSections((sections) => ({ ...sections, gifs: false }));
    }

    if (moduleKey === "welcome") {
      if (field === "messageMode") setValue("welcomeMessageMode", modeValue, { shouldDirty: true, shouldTouch: true });
      if (field === "message") setStringField("welcomeMessage", value);
      if (field === "titleText") setStringField("welcomeTitleText", value);
      if (field === "embedColor") setStringField("welcomeEmbedColor", value);
      if (field === "headerText") setStringField("welcomeHeaderText", value);
      if (field === "footerText") setStringField("welcomeFooterText", value);
      if (field === "imageMode") setValue("welcomeImageMode", imageModeValue, { shouldDirty: true, shouldTouch: true });
      if (field === "thumbnailMode") setValue("welcomeThumbnailMode", thumbnailModeValue, { shouldDirty: true, shouldTouch: true });
      return;
    }

    if (moduleKey === "dm") {
      if (field === "messageMode") setValue("dmMessageMode", modeValue, { shouldDirty: true, shouldTouch: true });
      if (field === "message") setStringField("dmMessage", value);
      if (field === "titleText") setStringField("dmTitleText", value);
      if (field === "embedColor") setStringField("dmEmbedColor", value);
      if (field === "headerText") setStringField("dmHeaderText", value);
      if (field === "footerText") setStringField("dmFooterText", value);
      if (field === "imageMode") setValue("dmImageMode", imageModeValue, { shouldDirty: true, shouldTouch: true });
      if (field === "thumbnailMode") setValue("dmThumbnailMode", thumbnailModeValue, { shouldDirty: true, shouldTouch: true });
      return;
    }

    if (field === "messageMode") setValue("goodbyeMessageMode", modeValue, { shouldDirty: true, shouldTouch: true });
    if (field === "message") setStringField("goodbyeMessage", value);
    if (field === "titleText") setStringField("goodbyeTitleText", value);
    if (field === "embedColor") setStringField("goodbyeEmbedColor", value);
    if (field === "headerText") setStringField("goodbyeHeaderText", value);
    if (field === "footerText") setStringField("goodbyeFooterText", value);
    if (field === "imageMode") setValue("goodbyeImageMode", imageModeValue, { shouldDirty: true, shouldTouch: true });
    if (field === "thumbnailMode") setValue("goodbyeThumbnailMode", thumbnailModeValue, { shouldDirty: true, shouldTouch: true });
  };

  const getImageUrl = (moduleKey: GreetingModuleKey, slot: GreetingImageSlot, fileName?: string) => {
    const pendingImage = pendingImages[createPendingImageKey(moduleKey, slot)];
    return pendingImage?.url ?? getGreetingImageUrl(guildId, fileName);
  };

  const resolveThumbnailUrl = (mode: GreetingThumbnailMode, customUrl: string | null): string | null => {
    if (mode === "none") return null;
    if (mode === "avatar") return SAMPLE_MEMBER_AVATAR;
    return customUrl;
  };

  const getEditorValue = (moduleKey: GreetingModuleKey): GreetingMessageEditorValue => {
    if (moduleKey === "welcome") {
      const customThumbnailUrl = getImageUrl("welcome", "thumbnail", values.welcomeThumbnailFile);
      const thumbnailMode = values.welcomeThumbnailMode ?? "avatar";
      return {
        messageMode: values.welcomeMessageMode ?? "embed",
        message: values.welcomeMessage || DEFAULT_WELCOME_MESSAGE,
        titleText: values.welcomeTitleText ?? "",
        embedColor: values.welcomeEmbedColor || DEFAULT_EMBED_COLOR,
        headerText: values.welcomeHeaderText || "",
        footerText: values.welcomeFooterText || "",
        imageMode: values.welcomeImageMode || DEFAULT_IMAGE_MODE,
        thumbnailMode,
        thumbnailUrl: resolveThumbnailUrl(thumbnailMode, customThumbnailUrl),
        customThumbnailUrl,
        customImageUrl: getImageUrl("welcome", "image", values.welcomeCustomImageFile),
        headerIconUrl: getImageUrl("welcome", "headerIcon", values.welcomeHeaderIconFile),
        footerIconUrl: getImageUrl("welcome", "footerIcon", values.welcomeFooterIconFile),
        previewGifUrl,
      };
    }

    if (moduleKey === "dm") {
      const customThumbnailUrl = getImageUrl("dm", "thumbnail", values.dmThumbnailFile);
      const thumbnailMode = values.dmThumbnailMode ?? "avatar";
      return {
        messageMode: values.dmMessageMode ?? "embed",
        message: values.dmMessage || DEFAULT_DM_MESSAGE,
        titleText: values.dmTitleText ?? "",
        embedColor: values.dmEmbedColor || DEFAULT_EMBED_COLOR,
        headerText: values.dmHeaderText || "",
        footerText: values.dmFooterText || "",
        imageMode: values.dmImageMode || DEFAULT_IMAGE_MODE,
        thumbnailMode,
        thumbnailUrl: resolveThumbnailUrl(thumbnailMode, customThumbnailUrl),
        customThumbnailUrl,
        customImageUrl: getImageUrl("dm", "image", values.dmCustomImageFile),
        headerIconUrl: getImageUrl("dm", "headerIcon", values.dmHeaderIconFile),
        footerIconUrl: getImageUrl("dm", "footerIcon", values.dmFooterIconFile),
        previewGifUrl,
      };
    }

    const customThumbnailUrl = getImageUrl("goodbye", "thumbnail", values.goodbyeThumbnailFile);
    const thumbnailMode = values.goodbyeThumbnailMode ?? "avatar";
    return {
      messageMode: values.goodbyeMessageMode ?? "embed",
      message: values.goodbyeMessage || DEFAULT_GOODBYE_MESSAGE,
      titleText: values.goodbyeTitleText ?? "",
      embedColor: values.goodbyeEmbedColor || "#ef4444",
      headerText: values.goodbyeHeaderText || "",
      footerText: values.goodbyeFooterText || "",
      imageMode: values.goodbyeImageMode || "none",
      thumbnailMode,
      thumbnailUrl: resolveThumbnailUrl(thumbnailMode, customThumbnailUrl),
      customThumbnailUrl,
      customImageUrl: getImageUrl("goodbye", "image", values.goodbyeCustomImageFile),
      headerIconUrl: getImageUrl("goodbye", "headerIcon", values.goodbyeHeaderIconFile),
      footerIconUrl: getImageUrl("goodbye", "footerIcon", values.goodbyeFooterIconFile),
      previewGifUrl,
    };
  };

  const handleImageSelect = (moduleKey: GreetingModuleKey, slot: GreetingImageSlot, file: File) => {
    const key = createPendingImageKey(moduleKey, slot);
    const previousPendingImage = pendingImagesRef.current[key];
    if (previousPendingImage) URL.revokeObjectURL(previousPendingImage.url);

    setPendingImages((currentImages) => ({
      ...currentImages,
      [key]: { moduleKey, slot, file, url: URL.createObjectURL(file) },
    }));

    if (slot === "image") setMessageField(moduleKey, "imageMode", "custom");
    if (slot === "thumbnail") setMessageField(moduleKey, "thumbnailMode", "custom");
  };

  const handleImageClear = (moduleKey: GreetingModuleKey, slot: GreetingImageSlot) => {
    const key = createPendingImageKey(moduleKey, slot);
    const previousPendingImage = pendingImagesRef.current[key];
    if (previousPendingImage) URL.revokeObjectURL(previousPendingImage.url);

    setPendingImages((currentImages) => {
      const nextImages = { ...currentImages };
      delete nextImages[key];
      return nextImages;
    });

    setStringField(getImageFileField(moduleKey, slot), "");
  };

  const clearPendingAssets = useCallback(() => {
    Object.values(pendingImagesRef.current).forEach((pendingImage) => {
      if (pendingImage) URL.revokeObjectURL(pendingImage.url);
    });
    gifsRef.current.forEach((gif) => {
      if (gif.pending) URL.revokeObjectURL(gif.url);
    });
    setPendingImages({});
    setDeletedUploadGifNames([]);
  }, []);

  const handleCancel = useCallback(() => {
    clearPendingAssets();
    reset(savedValuesRef.current, { keepDirty: false });
    setGifs(savedGifs);
  }, [clearPendingAssets, reset, savedGifs]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [channelsData, gifsRes, configRes] = await Promise.all([
          fetchGuildData<Channel[]>(guildId, "channels", `/api/guild/${guildId}/channels`),
          fetch(`/api/guild/${guildId}/greetings/gifs`),
          fetch(`/api/guild/${guildId}/greetings`),
        ]);

        setChannels(channelsData.filter((channel) => channel.type === 0 || channel.type === 5));

        if (gifsRes.ok) {
          const gifsData: GifFile[] = await gifsRes.json();
          const nextGifs = sortGifFiles(gifsData);
          setGifs(nextGifs);
          setSavedGifs(nextGifs);
        }

        if (configRes.ok) {
          const nextValues = normalizeConfig(await configRes.json());
          savedValuesRef.current = nextValues;
          reset(nextValues, { keepDirty: false });
        } else {
          savedValuesRef.current = DEFAULT_FORM_VALUES;
          reset(DEFAULT_FORM_VALUES, { keepDirty: false });
        }
      } catch (fetchError) {
        setError("Nie udało się załadować danych greetings. Sprawdź połączenie z internetem i spróbuj ponownie.");
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [guildId, reset]);

  const onSubmit = useCallback(async (data: GreetingsFormData) => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("config", JSON.stringify(data));
      formData.append("gifState", JSON.stringify({ disabledDefaultNames: getDisabledDefaultGifNames(gifsRef.current), deletedUploadNames: deletedUploadGifNames }));

      Object.values(pendingImagesRef.current).forEach((pendingImage) => {
        if (pendingImage) formData.append(`${pendingImage.moduleKey}.${pendingImage.slot}`, pendingImage.file, pendingImage.file.name);
      });

      gifsRef.current.forEach((gif) => {
        if (gif.pendingFile) formData.append("gifUploads", gif.pendingFile, gif.pendingFile.name);
      });

      const response = await fetch(`/api/guild/${guildId}/greetings`, { method: "POST", body: formData });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Nie udało się zapisać konfiguracji");
      }

      const result = await response.json();
      const nextValues = normalizeConfig(result.config ?? result);
      const nextGifs = Array.isArray(result.gifs) ? sortGifFiles(result.gifs) : gifsRef.current.filter((gif) => !gif.pending);

      clearPendingAssets();
      savedValuesRef.current = nextValues;
      reset(nextValues, { keepDirty: false });
      setGifs(nextGifs);
      setSavedGifs(nextGifs);
      toast.success("Konfiguracja została zapisana!");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  }, [clearPendingAssets, deletedUploadGifNames, guildId, reset]);

  const submitFromDirtyBar = useCallback(() => {
    void handleSubmit(onSubmit, () => setOpenSections((sections) => ({ ...sections, welcome: true })))();
  }, [handleSubmit, onSubmit]);

  useEffect(() => registerDirtyController({
    id: `greetings-${guildId}`,
    isDirty: hasDirtyChanges,
    isSaving: saving,
    label: "Powitania, prywatne wiadomości i pożegnania",
    onSave: submitFromDirtyBar,
    onCancel: handleCancel,
  }), [guildId, handleCancel, hasDirtyChanges, registerDirtyController, saving, submitFromDirtyBar]);

  const handleUploadGif = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";

    if (!file) return;
    if (gifLimitReached) {
      toast.error(`Możesz dodać maksymalnie ${MAX_GREETING_GIFS} GIF-ów`);
      return;
    }
    if (!file.type.includes("gif")) {
      toast.error("Plik musi być w formacie GIF");
      return;
    }

    setGifs((currentGifs) => sortGifFiles([...currentGifs, {
      name: createPendingGifName(file.name),
      source: "upload",
      disabled: false,
      url: URL.createObjectURL(file),
      pending: true,
      pendingFile: file,
    }]));
  };

  const handleToggleDefaultGif = (gif: GifFile) => {
    setGifs((currentGifs) => sortGifFiles(currentGifs.map((currentGif) => (
      currentGif.source === "default" && currentGif.name === gif.name
        ? { ...currentGif, disabled: !currentGif.disabled }
        : currentGif
    ))));
  };

  const handleDeleteGif = (gif: GifFile) => {
    if (gif.source === "default") {
      handleToggleDefaultGif(gif);
      return;
    }

    if (!gif.pending && !confirm("Oznaczyć ten GIF do usunięcia po zapisaniu zmian?")) return;
    if (gif.pending) URL.revokeObjectURL(gif.url);
    if (!gif.pending) setDeletedUploadGifNames((currentNames) => [...new Set([...currentNames, gif.name])]);
    setGifs((currentGifs) => currentGifs.filter((currentGif) => currentGif.name !== gif.name || currentGif.source !== gif.source));
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    window.location.reload();
  };

  const welcomeTopFields = (
    <>
      <ChannelSelectField id="greetingsChannelId" label="Kanał powitalny" required channels={channels} value={values.greetingsChannelId} onValueChange={(value) => setStringField("greetingsChannelId", value)} error={errors.greetingsChannelId?.message} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ChannelSelectField id="rulesChannelId" label="Kanał regulaminu" channels={channels} value={values.rulesChannelId} onValueChange={(value) => setStringField("rulesChannelId", value)} error={errors.rulesChannelId?.message} />
        <ChannelSelectField id="rolesChannelId" label="Kanał ról" channels={channels} value={values.rolesChannelId} onValueChange={(value) => setStringField("rolesChannelId", value)} error={errors.rolesChannelId?.message} />
        <ChannelSelectField id="chatChannelId" label="Kanał czatu" channels={channels} value={values.chatChannelId} onValueChange={(value) => setStringField("chatChannelId", value)} error={errors.chatChannelId?.message} />
      </div>
    </>
  );

  const goodbyeFallbackAvailable = Boolean(values.greetingsChannelId) && Boolean(values.welcomeEnabled);
  const goodbyeTopFields = (
    <ChannelSelectField
      id="goodbyeChannelId"
      label="Kanał pożegnań"
      helperText={
        goodbyeFallbackAvailable
          ? "Jeśli zostawisz puste, bot użyje kanału powitalnego."
          : "Kanał powitalny nie jest dostępny jako zapasowy — wybierz kanał pożegnań."
      }
      channels={channels}
      value={values.goodbyeChannelId}
      onValueChange={(value) => setStringField("goodbyeChannelId", value)}
      error={errors.goodbyeChannelId?.message}
    />
  );

  const getModuleEffectiveTexts = (moduleKey: GreetingModuleKey): string[] => {
    if (moduleKey === "welcome") {
      return [values.welcomeMessage || DEFAULT_WELCOME_MESSAGE, values.welcomeTitleText, values.welcomeHeaderText, values.welcomeFooterText].filter(Boolean) as string[];
    }
    if (moduleKey === "dm") {
      return [values.dmMessage || DEFAULT_DM_MESSAGE, values.dmTitleText, values.dmHeaderText, values.dmFooterText].filter(Boolean) as string[];
    }
    return [values.goodbyeMessage || DEFAULT_GOODBYE_MESSAGE, values.goodbyeTitleText, values.goodbyeHeaderText, values.goodbyeFooterText].filter(Boolean) as string[];
  };

  const renderChannelNotice = (moduleKey: GreetingModuleKey) => {
    const missing = getMissingChannelVariables(getModuleEffectiveTexts(moduleKey), {
      rulesChannelId: values.rulesChannelId,
      rolesChannelId: values.rolesChannelId,
      chatChannelId: values.chatChannelId,
    });
    if (missing.length === 0) return null;

    return (
      <div className="space-y-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="flex items-start gap-2 text-xs text-amber-200/90">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Ta wiadomość używa zmiennych kanałów, które nie są jeszcze ustawione. Skonfiguruj je, aby linki do kanałów działały.</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {missing.map((key) => {
            const fieldId = CHANNEL_VARIABLE_FIELD[key];
            return (
              <ChannelSelectField
                key={fieldId}
                id={fieldId}
                label={CHANNEL_VARIABLE_LABEL[key]}
                channels={channels}
                value={values[fieldId]}
                onValueChange={(value) => setStringField(fieldId, value)}
                error={errors[fieldId]?.message}
              />
            );
          })}
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className="min-h-screen">
        <div className="w-full">
          <ErrorState title="Nie udało się załadować greetings" message={error} onRetry={handleRetry} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="w-full space-y-5">
          <div className="flex items-start justify-between gap-6 pb-2">
            <div className="space-y-3"><Skeleton className="h-7 w-56" /><Skeleton className="h-4 w-[520px] max-w-full" /></div>
            <div className="flex items-center gap-3"><Skeleton className="h-4 w-12" /><Skeleton className="h-5 w-9 rounded-full" /></div>
          </div>
          <div className="space-y-3">{[1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-[68px] w-full rounded-md bg-dark-800" />)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      <div className="w-full space-y-5">
        <form onSubmit={handleSubmit(onSubmit, () => setOpenSections((sections) => ({ ...sections, welcome: true })))} className="space-y-3">
          <SlideIn direction="up" delay={100}>
            <header className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-2">
                <h1 className="text-2xl font-semibold text-white">Powitania i Pożegnania</h1>
                <p className="max-w-2xl text-sm leading-6 text-[#969db0]">Automatycznie wysyłaj wiadomości, nadawaj kontekst nowym osobom i pożegnaj członków, którzy opuszczają serwer.</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
                <span>Aktywne</span>
                <DeezySwitch checked={values.enabled || false} onCheckedChange={(checked) => setBooleanField("enabled", checked)} aria-label="Włącz lub wyłącz greetings" />
              </div>
            </header>
          </SlideIn>

          {!values.enabled ? (
            <SlideIn direction="up" delay={130}>
              <div className="flex items-start gap-2 rounded-md border border-[#3a3f4e] bg-dark-900 px-4 py-3 text-xs text-[#9aa2b8]">
                <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Cały moduł powitań jest <span className="font-semibold text-white/80">globalnie wyłączony</span>. Ustawienia poniżej możesz edytować i zapisać, ale bot nie wyśle żadnych wiadomości, dopóki nie włączysz przełącznika <span className="font-semibold text-white/80">Aktywne</span> u góry.
                </span>
              </div>
            </SlideIn>
          ) : null}

          <SlideIn direction="up" delay={150}>
            <div className="space-y-3">
              <SettingRow title="Wyślij wiadomość, gdy użytkownik dołącza do serwera" description="Kanał, zmienne i edytor wiadomości powitalnej" icon={<MessageSquare className="h-4 w-4" />} checked={values.welcomeEnabled || false} onCheckedChange={(checked) => setBooleanField("welcomeEnabled", checked)} isOpen={openSections.welcome} onToggle={() => toggleSection("welcome")}>
                <ModuleDisabledNotice enabled={values.welcomeEnabled || false} target="powitania" />
                {renderChannelNotice("welcome")}
                <GreetingMessageEditor moduleKey="welcome" title="Wiadomość powitalna" value={getEditorValue("welcome")} topFields={welcomeTopFields} activeGifCount={activeGifCount} onManageGifs={handleManageGifs} onValueChange={(field, value) => setMessageField("welcome", field, value)} onImageSelect={(slot, file) => handleImageSelect("welcome", slot, file)} onImageClear={(slot) => handleImageClear("welcome", slot)} />
              </SettingRow>

              <div ref={gifSectionRef} className={cn("rounded-md transition-shadow", gifHighlight && "ring-2 ring-bot-primary ring-offset-2 ring-offset-dark-950")}>
              <SettingRow title="GIF-y powitalne" description="Domyślne GIF-y i grafiki dodane tylko dla tego serwera" icon={<ImageIcon className="h-4 w-4" />} isOpen={openSections.gifs} onToggle={() => toggleSection("gifs")}>
                <div className="space-y-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-[#8d94a8]">Ukrywanie, przywracanie i usuwanie GIF-ów zapisze się dopiero przez floating Zapisz.</p>
                    <span className={cn("w-fit rounded-full border px-2.5 py-1 text-xs font-semibold", gifLimitReached ? "border-bot-primary/60 bg-bot-primary/10 text-[#9cc2ff]" : "border-[#2f3341] bg-dark-900 text-[#c4cad8]")}>{uploadedGifCount}/{MAX_GREETING_GIFS}</span>
                  </div>

                  <Label htmlFor="gif-upload" className={cn("block", gifLimitReached ? "cursor-not-allowed" : "cursor-pointer")}>
                    <div className={cn("rounded-md border border-dashed border-[#3a3f4e] bg-dark-900 p-6 text-center transition-colors", gifLimitReached ? "opacity-60" : "hover:border-bot-primary/70 hover:bg-dark-700")}>
                      <Upload className="mx-auto mb-3 h-8 w-8 text-[#9aa2b8]" />
                      <p className="text-sm font-semibold text-white/85">{gifLimitReached ? `Limit ${MAX_GREETING_GIFS} własnych GIF-ów osiągnięty` : "Kliknij aby dodać GIF"}</p>
                      <p className="mt-1 text-xs text-[#8d94a8]">{gifLimitReached ? "Usuń jedną grafikę serwera, aby dodać kolejną" : "Plik trafi na serwer dopiero po kliknięciu Zapisz"}</p>
                    </div>
                    <input id="gif-upload" type="file" accept=".gif" className="hidden" onChange={handleUploadGif} disabled={gifLimitReached} />
                  </Label>

                  {gifs.length === 0 ? (
                    <div className="rounded-md border border-[#2f3341] bg-dark-900 py-8 text-center"><p className="text-sm text-[#8d94a8]">Brak aktywnych GIF-ów</p></div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
                      {gifs.map((gif) => (
                        <div key={`${gif.source}-${gif.name}`} className={cn("group relative overflow-hidden rounded-md border border-[#2f3341] bg-dark-900", gif.disabled && "opacity-70")}>
                          <img src={gif.url} alt={gif.name} className={cn("h-32 w-full object-cover", gif.disabled && "blur-sm grayscale")} />
                          <span className="absolute left-2 top-2 rounded bg-black/65 px-2 py-0.5 text-[10px] font-semibold uppercase text-white/90">{gif.pending ? "Draft" : gif.disabled ? "Ukryty" : gif.source === "default" ? "Default" : "Serwer"}</span>
                          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/65 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button type="button" size="sm" variant="secondary" onClick={() => setPreviewGif(gif.url)} className="bg-dark-800 text-white hover:bg-dark-700"><ImageIcon className="h-4 w-4" /></Button>
                            <Button type="button" size="sm" variant={gif.source === "upload" ? "destructive" : "secondary"} onClick={() => handleDeleteGif(gif)} title={gif.source === "upload" ? "Usuń z tego serwera po zapisaniu" : gif.disabled ? "Przywróć do rotacji po zapisaniu" : "Ukryj z rotacji po zapisaniu"} className={gif.source === "upload" ? undefined : "bg-dark-800 text-white hover:bg-dark-700"}>
                              {gif.source === "upload" ? <Trash2 className="h-4 w-4" /> : gif.disabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SettingRow>
              </div>

              <SettingRow title="Wyślij prywatną wiadomość do nowych użytkowników" description="Ten sam edytor, ale wiadomość idzie do DM użytkownika" icon={<Mail className="h-4 w-4" />} checked={values.dmEnabled || false} onCheckedChange={(checked) => setBooleanField("dmEnabled", checked)} isOpen={openSections.dm} onToggle={() => toggleSection("dm")}>
                <ModuleDisabledNotice enabled={values.dmEnabled || false} target="prywatnej wiadomości" />
                {renderChannelNotice("dm")}
                <GreetingMessageEditor moduleKey="dm" title="Prywatna wiadomość powitalna" value={getEditorValue("dm")} activeGifCount={activeGifCount} onManageGifs={handleManageGifs} onValueChange={(field, value) => setMessageField("dm", field, value)} onImageSelect={(slot, file) => handleImageSelect("dm", slot, file)} onImageClear={(slot) => handleImageClear("dm", slot)} />
              </SettingRow>

              <SettingRow title="Wyślij wiadomość, gdy użytkownik opuszcza serwer" description="Ten sam edytor dla wiadomości pożegnalnej" icon={<MessageSquare className="h-4 w-4" />} checked={values.goodbyeEnabled || false} onCheckedChange={(checked) => setBooleanField("goodbyeEnabled", checked)} isOpen={openSections.goodbye} onToggle={() => toggleSection("goodbye")}>
                <ModuleDisabledNotice enabled={values.goodbyeEnabled || false} target="pożegnania" />
                {renderChannelNotice("goodbye")}
                <GreetingMessageEditor moduleKey="goodbye" title="Wiadomość pożegnalna" value={getEditorValue("goodbye")} topFields={goodbyeTopFields} hideGifs activeGifCount={activeGifCount} onManageGifs={handleManageGifs} onValueChange={(field, value) => setMessageField("goodbye", field, value)} onImageSelect={(slot, file) => handleImageSelect("goodbye", slot, file)} onImageClear={(slot) => handleImageClear("goodbye", slot)} />
              </SettingRow>
            </div>
          </SlideIn>
        </form>

        {previewGif ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewGif(null)}><div className="max-h-[80vh] max-w-3xl"><img src={previewGif} alt="Preview" className="max-h-full max-w-full rounded-lg" /></div></div>
        ) : null}

        <style jsx global>{`
          .deezy-switch span { position: relative; }
          .deezy-switch span[data-state="checked"]::after { content: ""; position: absolute; inset: 5px; border-radius: 9999px; background: #3b82f6; }
        `}</style>
      </div>
    </div>
  );
}
