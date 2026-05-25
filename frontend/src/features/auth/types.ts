import type { LucideIcon } from "lucide-react";

export type ProfileType = "student" | "teacher";

export type ProfileOption = {
  type: ProfileType;
  color: "blue" | "green";
  icon: LucideIcon;
  title: string;
  description: string;
};