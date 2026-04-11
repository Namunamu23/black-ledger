import clsx from "clsx";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  text?: string;
  align?: "left" | "center";
  children?: React.ReactNode;
};

export default function PageHero({
  eyebrow,
  title,
  text,
  align = "left",
  children,
}: PageHeroProps) {
  return (
    <div
      className={clsx(
        "max-w-3xl",
        align === "center" && "mx-auto text-center"
      )}
    >
      <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
        {eyebrow}
      </div>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        {title}
      </h1>
      {text ? (
        <p className="mt-5 text-lg leading-8 text-zinc-300">{text}</p>
      ) : null}
      {children ? <div className="mt-8">{children}</div> : null}
    </div>
  );
}