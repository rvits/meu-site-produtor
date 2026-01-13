type ProfessionalBoxProps = {
  children: React.ReactNode;
  className?: string;
  showTopLine?: boolean;
  showBottomLine?: boolean;
  showInternalLine?: boolean;
};

export default function ProfessionalBox({
  children,
  className = "",
  showTopLine = true,
  showBottomLine = true,
  showInternalLine = false,
}: ProfessionalBoxProps) {
  return (
    <div className={`relative w-full max-w-5xl mx-auto ${className}`}>
      {/* LINHA SUPERIOR COM FADE */}
      {showTopLine && (
        <div
          className="h-[1px]"
          style={{
            background:
              "linear-gradient(to right, transparent 0%, rgba(239, 68, 68, 0.3) 15%, rgba(239, 68, 68, 0.6) 50%, rgba(239, 68, 68, 0.3) 85%, transparent 100%)",
            boxShadow: "0 1px 10px rgba(239, 68, 68, 0.4)",
          }}
        />
      )}

      {/* CONTEÚDO COM FUNDO PRETO */}
      <div
        className="relative"
        style={{
          background:
            "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        {showInternalLine && (
          <div
            className="h-[1px] mx-auto mb-5"
            style={{
              width: "55%",
              background:
                "linear-gradient(to right, transparent 0%, rgba(239, 68, 68, 0.4) 25%, rgba(239, 68, 68, 0.7) 50%, rgba(239, 68, 68, 0.4) 75%, transparent 100%)",
              boxShadow: "0 1px 8px rgba(239, 68, 68, 0.3)",
            }}
          />
        )}

        <div className="px-6 md:px-8 py-6 text-center">{children}</div>
      </div>

      {/* LINHA INFERIOR COM FADE */}
      {showBottomLine && (
        <div
          className="h-[1px]"
          style={{
            background:
              "linear-gradient(to right, transparent 0%, rgba(239, 68, 68, 0.3) 15%, rgba(239, 68, 68, 0.6) 50%, rgba(239, 68, 68, 0.3) 85%, transparent 100%)",
            boxShadow: "0 1px 10px rgba(239, 68, 68, 0.4)",
          }}
        />
      )}
    </div>
  );
}
