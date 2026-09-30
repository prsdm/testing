export function createArtifactNdjsonTransform<T>(): TransformStream<
  T,
  Uint8Array
> {
  const encoder = new TextEncoder();
  return new TransformStream<T, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`));
    },
  });
}
