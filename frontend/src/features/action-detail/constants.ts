import type { ActionDetail } from "./types";

export const MOCK_ACTION_DETAILS: ActionDetail[] = [
  {
    id: "1",
    title: "Oficina de Programação",
    shortDescription:
      "Ensinar fundamentos de programação e desenvolvimento web para jovens de escolas.",
    fullDescription: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec tincidunt, ante ac rhoncus convallis, libero quam sodales lacus, nec semper enim tortor sit amet ligula. Pellentesque iaculis tempor diam. Curabitur blandit enim a nunc blandit accumsan. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. In a metus laoreet, sagittis lectus euismod, congue nibh. Aenean lacus elit, tincidunt vitae ante sit amet, bibendum placerat urna. Praesent dui ante, blandit a scelerisque venenatis, elementum eu metus. Sed volutpat tortor id diam eleifend molestie.

Quisque sed nunc id nunc eleifend volutpat. Morbi ipsum ex, volutpat vel felis ut, suscipit malesuada sapien. Vestibulum tempor euismod nibh non consectetur. Suspendisse potenti. Ut id pellentesque orci. Curabitur sagittis mauris magna, quis blandit felis iaculis et.

Nunc nec lacus eget tellus eleifend hendrerit quis a tellus. Mauris in velit sodales, semper sapien ut, lacinia odio. Pellentesque rhoncus mauris non erat ornare, sit amet semper magna ultricies. Nulla venenatis lorem eu enim pulvinar blandit. Integer eu est iaculis, gravida justo eget, interdum ex. Mauris non lacus ligula. Proin fermentum metus quis lectus gravida, a lacinia orci interdum. Nunc fermentum mollis ex ac gravida. Donec rutrum pretium dui at sagittis. Morbi blandit mauris mi, accumsan elementum justo consequat eu. Quisque urna felis, sollicitudin eget tincidunt non, suscipit in sem. Phasellus eget leo nisi. Curabitur luctus at tellus sit amet convallis. Interdum et malesuada fames ac ante ipsum primis in faucibus.`,
    bannerUrl:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200",
    category: "Oficina",
    institution: "UNIESQUINA",
    city: "Xique-Xique - BA",
    venue: "Auditório",
    startDate: "09/05/2026",
    endDate: "09/07/2026",
    schedule: "14h às 16h",
    workloadHours: 20,
    slots: 16,
    totalSlots: 30,
  },
  {
    id: "2",
    title: "Aulas de Reforço de Matemática",
    shortDescription:
      "Oferecer aulas de reforço para auxiliar alunos do ensino fundamental em matemática básica.",
    fullDescription: `Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.

At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.`,
    bannerUrl:
      "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=1200",
    category: "Oficina",
    institution: "UFAL",
    city: "Arapiraca - AL",
    venue: "Sala 204",
    startDate: "08/05/2026",
    endDate: "08/07/2026",
    schedule: "08h às 10h",
    workloadHours: 40,
    slots: 0,
    totalSlots: 15,
  },
  {
    id: "3",
    title: "Oficina de Programação",
    shortDescription:
      "Ensinar fundamentos de programação e desenvolvimento web para jovens de escolas.",
    fullDescription: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec tincidunt, ante ac rhoncus convallis, libero quam sodales lacus, nec semper enim tortor sit amet ligula.

Quisque sed nunc id nunc eleifend volutpat. Morbi ipsum ex, volutpat vel felis ut, suscipit malesuada sapien.`,
    bannerUrl:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200",
    category: "Oficina",
    institution: "UFAL",
    city: "Maceió - AL",
    venue: "Lab de Informática",
    startDate: "09/05/2026",
    endDate: "09/06/2026",
    schedule: "10h às 12h",
    workloadHours: 20,
    slots: 12,
    totalSlots: 30,
  },
  {
    id: "4",
    title: "Oficina de Programação em blocos",
    shortDescription:
      "Ensinar fundamentos de programação e desenvolvimento web para jovens de escolas.",
    fullDescription: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec tincidunt, ante ac rhoncus convallis, libero quam sodales lacus, nec semper enim tortor sit amet ligula.

Nunc nec lacus eget tellus eleifend hendrerit quis a tellus. Mauris in velit sodales, semper sapien ut, lacinia odio.`,
    bannerUrl:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200",
    category: "Oficina",
    institution: "UFAL",
    city: "Arapiraca - AL",
    venue: "Auditório",
    startDate: "09/05/2026",
    endDate: "09/08/2026",
    schedule: "14h às 18h",
    workloadHours: 30,
    slots: 8,
    totalSlots: 30,
  },
];
