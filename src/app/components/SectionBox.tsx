type SectionBoxProps = {
  children: React.ReactNode;
  className?: string;
};

export default function SectionBox({ children, className = "" }: SectionBoxProps) {
  return (
    <section
      className={`
        rounded-2xl
        bg-zinc-900/90
        border border-zinc-800
        shadow-[0_20px_60px_rgba(0,0,0,0.45)]
        p-6 md:p-10
        ${className}
      `}
    >
      {children}
    </section>
  );
}
