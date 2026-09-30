import type { LucideIcon } from "lucide-react";
import {
  BarChart3Icon,
  DatabaseIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  ImageIcon,
  PresentationIcon,
  TelescopeIcon,
} from "lucide-react";

export type GreetingSuggestionCategory = {
  id: string;
  label: string;
  icon: LucideIcon;
  queries: readonly string[];
};

export const GREETING_SUGGESTION_CATEGORIES: readonly GreetingSuggestionCategory[] =
  [
    {
      icon: DatabaseIcon,
      id: "company-sources",
      label: "Company sources",
      queries: [
        "Summarize our client onboarding process and identify the top 3 areas to improve handoff between teams",
        "Summarize the key decisions from our last all-hands meeting",
        "What is our official policy on remote work and flexible hours?",
        "Find everything we have on our current product pricing strategy",
      ],
    },
    {
      icon: FileTextIcon,
      id: "create-document",
      label: "Create document",
      queries: [
        "Draft a one-page launch brief for our next product",
        "Write a meeting recap with decisions, owners, and next steps",
        "Create an executive summary of our Q3 performance",
        "Draft a customer-facing FAQ for our new feature",
      ],
    },
    {
      icon: PresentationIcon,
      id: "create-presentation",
      label: "Create presentation",
      queries: [
        "Outline a 10-slide deck for our quarterly business review",
        "Create talking points for a product demo to enterprise buyers",
        "Draft a board update presentation with metrics and risks",
        "Build a slide outline for onboarding new hires",
      ],
    },
    {
      icon: FileSpreadsheetIcon,
      id: "create-spreadsheet",
      label: "Create spreadsheet",
      queries: [
        "Build a template to track weekly sales pipeline by stage",
        "Create a budget tracker with categories and monthly totals",
        "Draft a knowledge base plan spreadsheet with owners and due dates",
        "Set up a simple ROI model for a marketing campaign",
      ],
    },
    {
      icon: ImageIcon,
      id: "generate-image",
      label: "Generate image",
      queries: [
        "Generate a clean hero illustration for a SaaS landing page",
        "Create a simple diagram explaining our product workflow",
        "Design a social post graphic announcing a product update",
        "Generate an icon-style visual for an internal wiki page",
      ],
    },
    {
      icon: TelescopeIcon,
      id: "deep-research",
      label: "Deep research",
      queries: [
        "Research competitors in our space and compare positioning",
        "Summarize recent industry trends affecting our market",
        "Find best practices for improving customer retention in B2B SaaS",
        "Research security compliance requirements for enterprise sales",
      ],
    },
    {
      icon: BarChart3Icon,
      id: "visualize-data",
      label: "Visualize data",
      queries: [
        "Create a chart comparing monthly revenue vs. target",
        "Visualize support ticket volume by category over time",
        "Plot user growth and churn rate for the last 6 months",
        "Show a breakdown of marketing spend by channel",
      ],
    },
  ] as const;
