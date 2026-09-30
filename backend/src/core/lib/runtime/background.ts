export function runInBackground(callback: () => void | Promise<void>) {
  void Promise.resolve()
    .then(callback)
    .catch((error) => {
      console.error("[background] callback failed", error);
    });
}
