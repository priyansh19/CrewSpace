import { useState } from "react";
import { motion } from "framer-motion";

export default function CompleteScreen() {
  const [createShortcut, setCreateShortcut] = useState(true);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center px-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center"
      >
        {/* Success checkmark */}
        <div className="mb-6">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <motion.circle
              cx="32"
              cy="32"
              r="30"
              stroke="#5db872"
              strokeWidth="2"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            />
            <motion.path
              d="M20 34 L28 42 L44 24"
              stroke="#5db872"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 0.4, ease: "easeOut" }}
            />
          </svg>
        </div>

        {/* Title */}
        <h2
          className="font-display text-[36px] text-ink mb-2"
          style={{ letterSpacing: "-0.5px" }}
        >
          CrewSpace is ready
        </h2>

        {/* Body */}
        <p className="text-sm text-muted max-w-sm leading-relaxed mb-8">
          Your AI company control plane is installed and ready to run.
        </p>

        {/* Shortcut checkbox */}
        <label className="flex items-center gap-2 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={createShortcut}
            onChange={(e) => setCreateShortcut(e.target.checked)}
            className="w-4 h-4 rounded border-hairline text-primary focus:ring-primary"
          />
          <span className="text-sm text-body">Create desktop shortcut</span>
        </label>

        {/* Launch button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            window.installerAPI.launchApp();
            setTimeout(() => window.installerAPI.closeWindow(), 500);
          }}
          className="px-8 py-3 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-active transition-colors min-w-[200px]"
        >
          Launch CrewSpace
        </motion.button>

        {/* Open folder link */}
        <button
          onClick={() => window.installerAPI.openInstallFolder()}
          className="mt-4 text-sm text-muted hover:text-primary transition-colors"
        >
          Open installation folder
        </button>
      </motion.div>
    </div>
  );
}
