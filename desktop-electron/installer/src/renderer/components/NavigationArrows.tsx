interface NavigationArrowsProps {
  onPrev: () => void;
  onNext: () => void;
}

export default function NavigationArrows({ onPrev, onNext }: NavigationArrowsProps) {
  return (
    <>
      <button
        onClick={onPrev}
        className="w-9 h-9 rounded-full bg-canvas border border-hairline flex items-center justify-center hover:bg-surface-card transition-colors"
        aria-label="Previous slide"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button
        onClick={onNext}
        className="w-9 h-9 rounded-full bg-canvas border border-hairline flex items-center justify-center hover:bg-surface-card transition-colors"
        aria-label="Next slide"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </>
  );
}
