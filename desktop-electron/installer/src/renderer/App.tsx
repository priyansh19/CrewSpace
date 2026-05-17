import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import InstallerLayout from "./components/InstallerLayout";
import WelcomeScreen from "./components/WelcomeScreen";
import FeatureCarousel from "./components/FeatureCarousel";
import ProgressPanel from "./components/ProgressPanel";
import CompleteScreen from "./components/CompleteScreen";

export type InstallStep = "welcome" | "carousel" | "installing" | "complete";

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

const pageTransition = {
  duration: 0.35,
  ease: "easeInOut" as const,
};

export default function App() {
  const [step, setStep] = useState<InstallStep>("welcome");

  return (
    <InstallerLayout step={step}>
      <AnimatePresence mode="wait">
        {step === "welcome" && (
          <motion.div
            key="welcome"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className="w-full h-full"
          >
            <WelcomeScreen onGetStarted={() => setStep("carousel")} />
          </motion.div>
        )}

        {step === "carousel" && (
          <motion.div
            key="carousel"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className="w-full h-full"
          >
            <FeatureCarousel onInstall={() => setStep("installing")} />
          </motion.div>
        )}

        {step === "installing" && (
          <motion.div
            key="installing"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className="w-full h-full"
          >
            <ProgressPanel onComplete={() => setStep("complete")} />
          </motion.div>
        )}

        {step === "complete" && (
          <motion.div
            key="complete"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className="w-full h-full"
          >
            <CompleteScreen />
          </motion.div>
        )}
      </AnimatePresence>
    </InstallerLayout>
  );
}
