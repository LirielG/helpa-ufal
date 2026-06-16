import type { ActionEditSchemaType } from "./validators";

export async function updateAction(id: string, data: ActionEditSchemaType): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  // Uncomment para simular falha durante o desenvolvimento:
  // throw new Error("Erro ao atualizar a ação. Tente novamente.");
  console.log("Atualizando ação", id, data);
}