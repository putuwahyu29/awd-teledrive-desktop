export {};

declare global {
  interface Window {
    go: {
      main: {
        App: any;
      };
    };
    runtime: any;
  }
}
