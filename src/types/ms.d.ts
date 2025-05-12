declare module 'ms' {
  function ms(value: string): number;
  function ms(value: number, options?: { long: boolean }): string;
  export default ms;
}
