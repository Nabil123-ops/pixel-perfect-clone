export type BuilderFramework = "html" | "react" | "next" | "typescript";

export const BUILDER_FRAMEWORKS: { id: BuilderFramework; label: string }[] = [
  { id: "html", label: "HTML / CSS / JS" },
  { id: "react", label: "React" },
  { id: "next", label: "Next.js" },
  { id: "typescript", label: "TypeScript" },
];

export interface BuilderFile {
  path: string;
  content: string;
}

export interface BuilderPlan {
  explanation?: string;
  files: BuilderFile[];
}

export interface BuilderChatMessage {
  role: "user" | "assistant";
  content: string;
}
