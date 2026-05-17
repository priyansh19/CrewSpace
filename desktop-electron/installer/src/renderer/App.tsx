import { useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import InstallerLayout from "./components/InstallerLayout";
import WelcomeScreen from "./components/WelcomeScreen";
import FeatureCarousel from "./components/FeatureCarousel";
import CompleteScreen from "./components/CompleteScreen";

export type InstallStep = "welcome" | "carousel" | "complete";

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
  const [installReady, setInstallReady] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const installStarted = useRef(false);

  function startInstall() {
    if (installStarted.current) return;
    installStarted.current = true;

    window.installerAPI.onProgress((data) => {
      if (data.percent >= 100 && data.stage === "done") {
        window.installerAPI.offProgress();
        if (data.detail?.startsWith("Error:")) {
          setInstallError(data.detail);
        } else {
          setInstallReady(true);
        }
      }
    });

    window.installerAPI.install().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      setInstallError(msg);
    });
  }

  function handleGetStarted() {
    startInstall();
    setStep("carousel");
  }

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
            <WelcomeScreen onGetStarted={handleGetStarted} />
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
            <FeatureCarousel
              installReady={installReady}
              installError={installError}
              onComplete={() => setStep("complete")}
            />
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
