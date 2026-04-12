type ArchiveStatCardProps = {
  label: string;
  value: string | number;
  helper?: string;
};

export default function ArchiveStatCard({
  label,
  value,
  helper,
}: ArchiveStatCardProps) {
  return (
    <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
      <div className="text-sm text-zinc-400">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
      {helper ? (
        <p className="mt-3 text-sm leading-7 text-zinc-500">{helper}</p>
      ) : null}
    </div>
  );
}