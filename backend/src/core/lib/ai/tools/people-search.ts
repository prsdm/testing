import { tool } from "ai";
import { z } from "zod";
import {
  type PeopleSearchHit,
  searchTenantMembers,
} from "@/core/lib/people/search-members";

export type PeopleSearchToolOutput = {
  query: string;
  people: PeopleSearchHit[];
};

function toPeopleSearchModelText(output: PeopleSearchToolOutput) {
  if (output.people.length === 0) {
    return `No signed-in teammates matched "${output.query}".`;
  }

  const lines = output.people.map((person, index) => {
    const details = [
      person.name,
      person.email,
      person.jobTitle,
      person.department,
    ]
      .filter(Boolean)
      .join(" · ");
    return `${index + 1}. ${details}`;
  });

  return `Teammates matching "${output.query}":\n${lines.join("\n")}`;
}

export const peopleSearch = (input: {
  tenantId: string;
  allowedOrgUnits?: string[];
}) =>
  tool({
    description:
      "Find signed-in teammates by name, email, role, or department. Use for who-is / who-works-in questions about people in this workspace.",
    execute: async ({ query }) => {
      const people = await searchTenantMembers({
        allowedOrgUnits: input.allowedOrgUnits,
        query,
        tenantId: input.tenantId,
      });
      const output: PeopleSearchToolOutput = {
        people,
        query: query.trim(),
      };
      return {
        ...output,
        contextForLlm: toPeopleSearchModelText(output),
      };
    },
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "Name, email, role, or department to search (e.g. 'Priya', 'marketing', 'PM')"
        ),
    }),
  });
