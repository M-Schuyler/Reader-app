export const dynamic = "force-dynamic";

export default function SourcesPage() {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.25em] text-black/45">Sources</p>
        <h2 className="mt-2 font-serif text-3xl text-black/90">RSS management is intentionally deferred.</h2>
      </div>
      <div className="rounded-3xl border border-black/10 bg-white/70 p-6 text-sm text-black/60 shadow-sm">
        This placeholder exists so the main shell is stable before RSS APIs are implemented.
      </div>
    </section>
  );
}
