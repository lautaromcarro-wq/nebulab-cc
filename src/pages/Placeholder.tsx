const Placeholder = ({ title }: { title: string }) => (
  <div>
    <h1 className="text-2xl font-bold tracking-tight mb-1">{title}</h1>
    <div className="mt-8 rounded-lg border border-dashed p-12 text-center text-muted-foreground text-sm">
      Próximamente.
    </div>
  </div>
);

export default Placeholder;
