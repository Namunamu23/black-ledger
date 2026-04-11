type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  text?: string;
};

export default function SectionHeader({
  eyebrow,
  title,
  text,
}: SectionHeaderProps) {
  return (
    <div className="max-w-3xl">
      <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
        {eyebrow}
      </div>
      <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
        {title}
      </h2>
      {text ? (
        <p className="mt-5 text-lg leading-8 text-zinc-300">{text}</p>
      ) : null}
    </div>
  );
}