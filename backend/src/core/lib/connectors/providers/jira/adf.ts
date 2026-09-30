export function plainTextAdf(text: string) {
  return {
    content: [
      {
        content: [{ text, type: "text" }],
        type: "paragraph",
      },
    ],
    type: "doc",
    version: 1,
  };
}
