import type { ProfileType } from "../types";
import { PROFILE_OPTIONS } from "../constants/profileOptions";

type ProfileSelectorProps = {
  selectedType: ProfileType | null;
  onSelect: (type: ProfileType) => void;
};

export function ProfileSelector({ selectedType, onSelect }: ProfileSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {PROFILE_OPTIONS.map((config) => {
        const Icon = config.icon;

        return (
          <button
            key={config.type}
            type="button"
            onClick={() => onSelect(config.type)}
            className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-2xl hover:scale-105 transition-all duration-300 group cursor-pointer"
          >
            <div
              className={`size-20 ${
                config.color === "green"
                  ? "bg-green-100 group-hover:bg-green-600"
                  : "bg-blue-100 group-hover:bg-blue-600"
              } rounded-full flex items-center justify-center mx-auto mb-6 transition`}
            >
              <Icon
                className={`size-10 ${
                  config.color === "green"
                    ? "text-green-600 group-hover:text-white"
                    : "text-blue-600 group-hover:text-white"
                } transition`}
              />
            </div>

            <h3 className="text-2xl font-semibold mb-3 text-gray-900">{config.title}</h3>
            <p className="text-gray-600 mb-6">{config.description}</p>
            <div
              className={`font-medium ${
                config.color === "green"
                  ? "text-green-600 group-hover:text-green-700"
                  : "text-blue-600 group-hover:text-blue-700"
              }`}
            >
              {selectedType === config.type ? "Selecionado" : "Criar →"}
            </div>
          </button>
        );
      })}
    </div>
  );
}