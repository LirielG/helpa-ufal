import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Action } from "../types";

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=1200&h=500&fit=crop",
  "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&h=500&fit=crop",
  "https://images.unsplash.com/photo-1529390079861-591de354faf5?w=1200&h=500&fit=crop",
  "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=1200&h=500&fit=crop",
];

interface HeroBannerProps {
  actions: Action[];
}

export function HeroBanner({ actions }: HeroBannerProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const featuredActions = actions.slice(0, 4);

  useEffect(() => {
    if (featuredActions.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % featuredActions.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [featuredActions.length]);

  const goToSlide = (index: number) => setCurrentSlide(index);

  const goToPrevious = () => {
    setCurrentSlide((prev) => (prev - 1 + featuredActions.length) % featuredActions.length);
  };

  const goToNext = () => {
    setCurrentSlide((prev) => (prev + 1) % featuredActions.length);
  };

  if (featuredActions.length === 0) {
    return <div className="h-[400px] md:h-[500px] bg-gray-900 w-full animate-pulse" />;
  }

  return (
    <div className="relative bg-gray-900 overflow-hidden">
      <div className="relative h-[400px] md:h-[500px]">
        {featuredActions.map((action, index) => {
          const formattedDate = new Date(action.startDate).toLocaleDateString('pt-BR');
          const imageUrl = FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];

          return (
            <div
              key={action.id}
              aria-hidden={index !== currentSlide}
              className={`absolute inset-0 transition-opacity duration-700 ${
                index === currentSlide ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="absolute inset-0">
                <img
                  src={imageUrl}
                  alt={action.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent"></div>
              </div>

              <div className="relative h-full flex items-center">
                <div className="container mx-auto px-4">
                  <div className="max-w-2xl text-white space-y-4">
                    <h2 className="text-4xl md:text-5xl font-bold line-clamp-2">
                      {action.title}
                    </h2>
                    <p className="text-lg md:text-xl text-gray-200 line-clamp-3">
                      {action.details?.description || "Descrição não informada."}
                    </p>
                    <div className="flex items-center gap-4">
                      <span className="text-sm bg-green-500 text-white px-4 py-2 rounded-full font-semibold">
                        {formattedDate}
                      </span>
                      <button className="px-6 py-2 bg-[#1B75BB] hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors">
                        Saiba mais
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {featuredActions.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 size-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full flex items-center justify-center transition-colors z-10"
            aria-label="Slide anterior"
          >
            <ChevronLeft className="size-6" />
          </button>

          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 size-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full flex items-center justify-center transition-colors z-10"
            aria-label="Próximo slide"
          >
            <ChevronRight className="size-6" />
          </button>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {featuredActions.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                aria-current={index === currentSlide}
                className={`size-2.5 rounded-full transition-all ${
                  index === currentSlide
                    ? "bg-white w-8"
                    : "bg-white/50 hover:bg-white/75"
                }`}
                aria-label={`Ir para slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
