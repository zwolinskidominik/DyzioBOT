"use client";

import { useRef, useEffect, useState } from "react";

interface Variable {
  name: string;        // User-friendly name for button
  display: string;     // User-friendly display in editor
  value: string;       // Backend format (e.g., {user})
  description: string;
}

interface VariableInserterProps {
  value: string;
  onChange: (value: string) => void;
  variables: Variable[];
  placeholder?: string;
  rows?: number;
  className?: string;
}

export default function VariableInserter({
  value,
  onChange,
  variables,
  placeholder,
  rows = 4,
  className = "",
}: VariableInserterProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isInternalChange, setIsInternalChange] = useState(false);

  useEffect(() => {
    if (!editorRef.current || isInternalChange) {
      setIsInternalChange(false);
      return;
    }
    
    const editor = editorRef.current;
    const currentText = extractTextFromHtml(editor.innerHTML);
    
    if (currentText !== value) {
      const selection = window.getSelection();
      const hadFocus = document.activeElement === editor;
      let cursorOffset = 0;
      
      if (hadFocus && selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        cursorOffset = getCursorOffset(editor, range.startContainer, range.startOffset);
      }
      
      editor.innerHTML = renderContent(value);
      
      if (hadFocus) {
        editor.focus();
        setCursorOffset(editor, cursorOffset);
      }
    }
  }, [value, isInternalChange]);
  
  const getCursorOffset = (root: Node, node: Node, offset: number): number => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let totalOffset = 0;
    let currentNode;
    
    while ((currentNode = walker.nextNode())) {
      if (currentNode === node) {
        return totalOffset + offset;
      }
      totalOffset += currentNode.textContent?.length || 0;
    }
    
    return totalOffset;
  };
  
  const setCursorOffset = (root: HTMLElement, offset: number) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let currentOffset = 0;
    let currentNode;
    
    while ((currentNode = walker.nextNode())) {
      const nodeLength = currentNode.textContent?.length || 0;
      if (currentOffset + nodeLength >= offset) {
        const range = document.createRange();
        const selection = window.getSelection();
        range.setStart(currentNode, Math.min(offset - currentOffset, nodeLength));
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
        return;
      }
      currentOffset += nodeLength;
    }
    
    // If offset is beyond content, place at end
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(root);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const renderContent = (text: string) => {
    if (!text) return "";
    
    let html = text;
    variables.forEach((variable) => {
      const escapedValue = variable.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedValue, 'g');
      html = html.replace(
        regex,
        `<span class="variable-tag" contenteditable="false" data-variable="${variable.value}">${variable.display}</span>`
      );
    });
    
    return html.replace(/\n/g, '<br>');
  };

  const extractTextFromHtml = (html: string): string => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Replace <br> tags with newline character before processing
    const brs = temp.querySelectorAll('br');
    brs.forEach((br) => {
      const textNode = document.createTextNode('\n');
      br.parentNode?.replaceChild(textNode, br);
    });
    
    const variables = temp.querySelectorAll('.variable-tag');
    variables.forEach((varEl) => {
      const varValue = varEl.getAttribute('data-variable');
      const textNode = document.createTextNode(varValue || '');
      varEl.parentNode?.replaceChild(textNode, varEl);
    });
    
    return temp.textContent || '';
  };

  const insertVariable = (variable: Variable) => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      const currentText = extractTextFromHtml(editor.innerHTML);
      setIsInternalChange(true);
      onChange(currentText + variable.value);
      return;
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const span = document.createElement('span');
    span.className = 'variable-tag';
    span.contentEditable = 'false';
    span.setAttribute('data-variable', variable.value);
    span.textContent = variable.display;

    const space = document.createTextNode('\u00A0');
    range.insertNode(space);
    range.insertNode(span);
    
    range.setStartAfter(space);
    range.setEndAfter(space);
    selection.removeAllRanges();
    selection.addRange(range);

    setIsInternalChange(true);
    const newText = extractTextFromHtml(editor.innerHTML);
    onChange(newText);
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    setIsInternalChange(true);
    const newText = extractTextFromHtml(editorRef.current.innerHTML);
    onChange(newText);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.execCommand('insertHTML', false, '<br>');
    }
  };

  const minHeight = `${rows * 1.5}rem`;

  return (
    <div className="space-y-2">
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        className={`w-full px-3 py-2 rounded-md border border-bot-blue/30 bg-background/50 focus:outline-none focus:ring-2 focus:ring-bot-primary/50 focus:border-bot-primary transition-all overflow-y-auto ${className}`}
        style={{ minHeight }}
      />
      
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground self-center">Wstaw zmienną:</span>
        {variables.map((variable) => (
          <button
            key={variable.value}
            type="button"
            onClick={() => insertVariable(variable)}
            className="group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bot-blue/10 hover:bg-bot-blue/20 border border-bot-blue/30 hover:border-bot-blue/50 transition-all text-xs font-medium text-bot-light hover:text-bot-primary"
            title={variable.description}
          >
            <span>{variable.name}</span>
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-card border border-bot-blue/30 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10">
              {variable.description}
            </div>
          </button>
        ))}
      </div>

      <style jsx global>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #6b7280;
          pointer-events: none;
          position: absolute;
        }
        
        .variable-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          margin: 0 2px;
          border-radius: 4px;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(147, 51, 234, 0.15));
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: rgb(147, 197, 253);
          font-family: ui-monospace, monospace;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: default;
          user-select: all;
          white-space: nowrap;
        }
        
        .variable-tag:hover {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(147, 51, 234, 0.25));
          border-color: rgba(59, 130, 246, 0.5);
        }
      `}</style>
    </div>
  );
}
