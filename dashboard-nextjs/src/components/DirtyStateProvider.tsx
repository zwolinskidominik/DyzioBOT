"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMessages } from "@/i18n/LanguageProvider";
import { commonMessages } from "@/i18n/messages/common";

export interface DirtyStateController {
  id: string;
  isDirty: boolean;
  isSaving?: boolean;
  label?: string;
  /** Overrides the save button's text (defaults to "Zapisz") — e.g. "Deploy na Discord". */
  saveLabel?: string;
  onSave: () => Promise<void> | void;
  onCancel: () => Promise<void> | void;
}

interface DirtyStateContextValue {
  controller: DirtyStateController | null;
  attentionToken: number;
  registerDirtyController: (controller: DirtyStateController) => () => void;
  clearDirtyController: (id: string) => void;
  triggerDirtyAttention: (message?: string) => void;
  guardedNavigate: (navigate: () => void, message?: string) => boolean;
  attentionMessage: string;
}


const DirtyStateContext = createContext<DirtyStateContextValue | null>(null);

export function DirtyStateProvider({ children }: { children: React.ReactNode }) {
  const [controller, setController] = useState<DirtyStateController | null>(null);
  const [attentionToken, setAttentionToken] = useState(0);
  const defaultAttentionMessage = useMessages(commonMessages).saveBar.attention;
  const [attentionMessage, setAttentionMessage] = useState(defaultAttentionMessage);
  const controllerRef = useRef<DirtyStateController | null>(null);

  useEffect(() => {
    controllerRef.current = controller;
  }, [controller]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!controllerRef.current?.isDirty) return;

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const triggerDirtyAttention = useCallback((message?: string) => {
    setAttentionMessage(message ?? defaultAttentionMessage);
    setAttentionToken((token) => token + 1);
  }, [defaultAttentionMessage]);

  const registerDirtyController = useCallback((nextController: DirtyStateController) => {
    setController(nextController);

    return () => {
      setController((currentController) => (
        currentController?.id === nextController.id ? null : currentController
      ));
    };
  }, []);

  const clearDirtyController = useCallback((id: string) => {
    setController((currentController) => (currentController?.id === id ? null : currentController));
  }, []);

  const guardedNavigate = useCallback((navigate: () => void, message?: string) => {
    if (controllerRef.current?.isDirty) {
      triggerDirtyAttention(message);
      return false;
    }

    navigate();
    return true;
  }, [triggerDirtyAttention]);

  const value = useMemo<DirtyStateContextValue>(() => ({
    controller,
    attentionToken,
    registerDirtyController,
    clearDirtyController,
    triggerDirtyAttention,
    guardedNavigate,
    attentionMessage,
  }), [
    attentionMessage,
    attentionToken,
    clearDirtyController,
    controller,
    guardedNavigate,
    registerDirtyController,
    triggerDirtyAttention,
  ]);

  return <DirtyStateContext.Provider value={value}>{children}</DirtyStateContext.Provider>;
}

export function useDirtyState() {
  const context = useContext(DirtyStateContext);

  if (!context) {
    throw new Error("useDirtyState must be used within DirtyStateProvider");
  }

  return context;
}
