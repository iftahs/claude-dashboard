export interface ModelPrice {
  name: string;
  family: string;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  popular?: boolean;
}
