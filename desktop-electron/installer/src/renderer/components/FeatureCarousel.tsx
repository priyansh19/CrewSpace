import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { featureSlides } from "../lib/features";
import { useCarousel } from "../hooks/useCarousel";
import FeatureSlide from "./FeatureSlide";
import NavigationArrows from "./NavigationArrows";

interface FeatureCarouselProps {
  onInstall: () => void;
}

export default function FeatureCarousel({ onInstall }: FeatureCarouselProps) {
  const { index, progress, goTo, next, prev, setPaused } = useCarousel(featureSlides.length);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    },
    [prev, next]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Progress bar */}
      <div className="shrink-0 w-full h-0.5 bg-hairline rounded-full overflow-hidden mb-4">
        <motion.div
          className="h-full bg-primary rounded-full"
          style={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>

      {/* Slide content */}
      <div
        className="flex-1 min-h-0 relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={featureSlides[index].id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute inset-0"
          >
            <FeatureSlide data={featureSlides[index]} isActive />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="shrink-0 flex items-center justify-between pt-4">
        {/* Navigation arrows */}
        <NavigationArrows onPrev={prev} onNext={next} />

        {/* Dot indicators */}
        <div className="flex items-center gap-2">
          {featureSlides.map((slide, i) => (
            <button
              key={slide.id}
              onClick={() => goTo(i)}
              className={[
                "w-2 h-2 rounded-full transition-colors duration-300",
                i === index ? "bg-primary scale-125" : "bg-hairline hover:bg-muted-soft",
              ].join(" ")}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Install button */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onInstall}
          className="px-6 py-2.5 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-active transition-colors"
        >
          Install CrewSpace
        </motion.button>
      </div>
    </div>
  );
}
