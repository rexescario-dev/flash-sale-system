type Props = {
  description: string;
  eyebrow: string;
  title: string;
};

export function PageHeader({ description, eyebrow, title }: Props) {
  return (
    <>
      <p className="mb-2 text-sm font-bold uppercase tracking-wider text-emerald-700">{eyebrow}</p>
      <h1 className="mb-2 text-3xl font-semibold text-emerald-950 sm:text-4xl">{title}</h1>
      <p className="mb-8 max-w-2xl text-emerald-900/70">{description}</p>
    </>
  );
}
