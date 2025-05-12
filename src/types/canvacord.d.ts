declare module 'canvacord' {
  export interface CanvasImage {
    toDataURL(): string;
  }

  export function loadImage(src: string): Promise<CanvasImage>;

  export class Font {
    static loadDefault(): Promise<void>;
  }

  export class Builder {
    constructor(width: number, height: number);

    protected options: Map<string, unknown>;

    protected bootstrap(defaults: Record<string, unknown>): void;
    protected getOptions<T extends Record<string, unknown>>(): T;

    render(): unknown;

    build(options?: { format?: 'png' | 'jpeg' | 'jpg' }): Promise<Buffer>;
  }

  export namespace JSX {
    export type Element = unknown;
    export type Props = Record<string, unknown>;
    export function createElement(
      tag: string,
      props: Props | null,
      ...children: (string | Element)[]
    ): Element;
  }
}
