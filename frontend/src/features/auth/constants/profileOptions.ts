import { GraduationCap, User } from "lucide-react";
import type { ProfileOption } from "../types";

export const PROFILE_OPTIONS: ProfileOption[] = [
  {
    type: "teacher",
    color: "green",
    icon: User,
    title: "Docente",
    description: "Professor ou pesquisador criando e gerenciando ações de extensão.",
  },
  {
    type: "student",
    color: "blue",
    icon: GraduationCap,
    title: "Estudante",
    description: "Estudante universitário interessado em participar das ações.",
  },
];