import { motion } from "framer-motion";

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

export default function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col items-center"
      >
        {/* Logo mark */}
        <div className="mb-6">
          <svg width="64" height="64" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" fill="#141413" />
            <path d="M16 6 L16 26 M6 16 L26 16" stroke="#faf9f5" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M9 9 L23 23 M23 9 L9 23" stroke="#faf9f5" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>

        {/* Wordmark */}
        <h1
          className="font-display text-[42px] leading-tight tracking-tight text-ink mb-3"
          style={{ letterSpacing: "-0.5px" }}
        >
          CrewSpace
        </h1>

        {/* Tagline */}
        <p
          className="font-display text-xl text-body mb-2"
          style={{ letterSpacing: "-0.3px" }}
        >
          The control plane for autonomous AI companies
        </p>

        {/* Subline */}
        <p className="text-sm text-muted max-w-md leading-relaxed mb-10">
          Spin up an AI-native organization — org chart, goals, budgets, approvals, and plugins — all from one board.
        </p>

        {/* CTA */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onGetStarted}
          className="px-8 py-3 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-active transition-colors min-w-[200px]"
        >
          Get Started
        </motion.button>

        {/* Secondary link */}
        <button
          onClick={() => window.installerAPI.openExternal("https://crewspace.ing")}
          className="mt-4 text-sm text-muted hover:text-primary transition-colors"
        >
          Learn more
        </button>
      </motion.div>

      {/* Footer */}
      <div className="absolute bottom-5 left-0 right-0 text-center">
        <span className="text-[11px] text-muted-soft tracking-wide">
          On-premise · Private · Secure
        </span>
      </div>
    </div>
  );
}
