interface ActionDescriptionProps {
  description: string;
}

export function ActionDescription({ description }: ActionDescriptionProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-5">Descrição</h2>
      <div className="text-gray-700 leading-relaxed whitespace-pre-line">
        {description}
      </div>
    </div>
  );
}
