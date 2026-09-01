export interface IParsedDateResult {
  isValid: boolean;
  date: Date | null;
  yearSpecified: boolean;
  errorMessage?: string;
}
