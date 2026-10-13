// Type shims for build without node_modules
declare const process: { argv: string[]; exit(code?: number): void; env: Record<string, string>; };
declare module "@ugp/runtime-contracts" {
  export interface GameModule { id: string; version: string; }
  export interface GameContext { runtime: any; }
}
declare module "@ugp/*" { const x: any; export default x; }
