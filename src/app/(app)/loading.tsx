// Mostrado instantaneamente ao trocar de tela, enquanto os dados carregam
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Carregando">
      <div className="mb-6 h-8 w-56 rounded-lg bg-wood-soft" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-28 rounded-xl bg-wood-soft/70" />)}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="h-72 rounded-xl bg-wood-soft/60 lg:col-span-2" />
        <div className="h-72 rounded-xl bg-wood-soft/60" />
      </div>
    </div>
  );
}
