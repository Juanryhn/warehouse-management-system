import { listLocations } from "@/lib/modules/locations/queries";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

export const metadata = { title: "Bin labels" };

export default async function LocationLabelsPage() {
  const locations = await listLocations();

  return (
    <div className="bg-white p-8 text-black">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-bold">Bin labels · Main warehouse</h1>
        <button
          type="button"
          onClick={undefined}
          className="hidden print:hidden"
          aria-hidden
        />
      </div>
      <div className="grid grid-cols-4 gap-4 print:grid-cols-4">
        {locations.map((location) => (
          <div key={location.id} className="flex h-24 flex-col justify-between border-2 border-black px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest">{location.zone} · {location.type}</span>
            <span className="font-mono text-2xl font-bold">{location.code}</span>
            <span className="text-[10px]">WMS · MAIN</span>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs print:hidden">Use your browser print dialog; labels are sized for 100 × 60 mm sheets.</p>
    </div>
  );
}
