declare function acquireVsCodeApi(): { postMessage(msg: unknown): void }
export const vscodeApi = acquireVsCodeApi()
