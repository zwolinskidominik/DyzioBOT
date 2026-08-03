import { describe, expect, it } from "vitest";
import { extractInlineText, renderInlineHtml, type ToolbarVariable } from "@/components/greetings/FieldToolbar";

const VARIABLES: ToolbarVariable[] = [
  { name: "Serwer", display: "Serwer", value: "{server}", description: "Nazwa serwera" },
  { name: "Użytkownik", display: "Użytkownik", value: "{user}", description: "Wzmianka" },
];

describe("renderInlineHtml", () => {
  it("wraps variables in atomic chips and escapes text", () => {
    const html = renderInlineHtml("Witaj {user} na {server}", VARIABLES);
    expect(html).toContain('data-variable="{user}"');
    expect(html).toContain('data-variable="{server}"');
    expect(html).toContain("Witaj ");
    expect(html).toContain(" na ");
  });

  it("escapes HTML-sensitive characters in plain text", () => {
    const html = renderInlineHtml('a <b> & "c"', VARIABLES);
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;");
    expect(html).not.toContain("<b>");
  });

  it("returns empty string for empty input", () => {
    expect(renderInlineHtml("", VARIABLES)).toBe("");
  });
});

describe("extractInlineText", () => {
  function makeEditor(html: string): HTMLElement {
    const el = document.createElement("div");
    el.innerHTML = html;
    return el;
  }

  it("round-trips text containing variables", () => {
    const original = "Witaj {user} na {server}";
    const editor = makeEditor(renderInlineHtml(original, VARIABLES));
    expect(extractInlineText(editor)).toBe(original);
  });

  it("converts chips back to their variable tokens", () => {
    const editor = makeEditor(
      'Cześć <span class="variable-tag" contenteditable="false" data-variable="{user}">Użytkownik</span>!'
    );
    expect(extractInlineText(editor)).toBe("Cześć {user}!");
  });

  it("flattens <br> into spaces (single-line)", () => {
    const editor = makeEditor("a<br>b");
    expect(extractInlineText(editor)).toBe("a b");
  });
});
