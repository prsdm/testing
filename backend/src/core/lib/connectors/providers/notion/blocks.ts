type NotionRichText = {
  type: "text";
  text: { content: string };
};

type NotionBlockPayload = {
  object: "block";
  type: string;
  [key: string]: unknown;
};

function richText(content: string): NotionRichText[] {
  return [{ text: { content }, type: "text" }];
}

function paragraphBlock(text: string): NotionBlockPayload {
  return {
    object: "block",
    paragraph: { rich_text: richText(text) },
    type: "paragraph",
  };
}

function headingBlock(level: 1 | 2 | 3, text: string): NotionBlockPayload {
  const type = `heading_${level}` as const;
  return {
    object: "block",
    type,
    [type]: { rich_text: richText(text) },
  };
}

function bulletedListItemBlock(text: string): NotionBlockPayload {
  return {
    bulleted_list_item: { rich_text: richText(text) },
    object: "block",
    type: "bulleted_list_item",
  };
}

function todoBlock(text: string, checked: boolean): NotionBlockPayload {
  return {
    object: "block",
    to_do: { checked, rich_text: richText(text) },
    type: "to_do",
  };
}

const TODO_PATTERN = /^[-*]\s+\[([ xX])\]\s+(.*)$/;
const BULLET_PATTERN = /^[-*]\s+(.*)$/;
const HEADING_PATTERN = /^(#{1,3})\s+(.*)$/;

export function parseContentToNotionBlocks(
  content: string
): NotionBlockPayload[] {
  const lines = content.split("\n");
  const blocks: NotionBlockPayload[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      continue;
    }

    const todoMatch = TODO_PATTERN.exec(line.trim());
    if (todoMatch) {
      blocks.push(todoBlock(todoMatch[2], todoMatch[1].toLowerCase() === "x"));
      continue;
    }

    const headingMatch = HEADING_PATTERN.exec(line.trim());
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      blocks.push(headingBlock(level, headingMatch[2]));
      continue;
    }

    const bulletMatch = BULLET_PATTERN.exec(line.trim());
    if (bulletMatch) {
      blocks.push(bulletedListItemBlock(bulletMatch[1]));
      continue;
    }

    blocks.push(paragraphBlock(line.trim()));
  }

  if (blocks.length === 0) {
    blocks.push(paragraphBlock(""));
  }

  return blocks;
}
