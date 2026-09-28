/** Module-level scan dedup — survives React StrictMode remounts in dev. */
const scanState = {
  folderKey: '',
  promise: null as Promise<void> | null,
};

export function runInitialScanOnce(folderKey: string, runner: () => Promise<void>): Promise<void> {
  if (scanState.folderKey === folderKey && scanState.promise) {
    return scanState.promise;
  }
  scanState.folderKey = folderKey;
  scanState.promise = runner().finally(() => {
    scanState.promise = null;
  });
  return scanState.promise;
}

export function resetScanSession() {
  scanState.folderKey = '';
  scanState.promise = null;
}
