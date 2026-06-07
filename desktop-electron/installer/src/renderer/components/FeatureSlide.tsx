import { motion } from "framer-motion";
import type { FeatureSlideData } from "../lib/features";
import SlideIllustration from "./SlideIllustration";

interface FeatureSlideProps {
  data: FeatureSlideData;
  isActive: boolean;
}

export default function FeatureSlide({ data, isActive }: FeatureSlideProps) {
  return (
    <div className="w-full h-full flex items-center gap-8 px-4">
      {/* Illustration */}
      <div className="w-[55%] h-[260px]">
        <SlideIllustration slideId={data.id} />
      </div>

      {/* Content */}
      <div className="w-[45%] flex flex-col justify-center">
        <motion.h2
          key={`${data.id}-title`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 12 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="font-display text-[32px] leading-tight text-ink mb-3"
          style={{ letterSpacing: "-0.5px" }}
        >
          {data.title}
        </motion.h2>

        <motion.p
          key={`${data.id}-body`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 12 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-sm text-body leading-relaxed mb-4"
        >
          {data.body}
        </motion.p>

        <motion.ul
          key={`${data.id}-bullets`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 12 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="space-y-1.5"
        >
          {data.bullets.map((bullet) => (
            <li key={bullet} className="flex items-center gap-2 text-xs text-muted">
              <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
              {bullet}
            </li>
          ))}
        </motion.ul>
      </div>
    </div>
  );
}
