export interface IMemeData {
  title: string | null;
  url: string;
  isVideo: boolean;
  source?: string;
}

export interface IMemeSourceConfig {
  url: string;
  parser: () => Promise<IMemeData>;
}
