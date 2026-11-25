import { AutoForm, type FormField } from "@/components/ui/auto-form";
import { Forbidden } from "@/components/ui/forbidden";
import { Badge, PageHeader } from "@/components/ui/page-header";
import { hasCapability } from "@/lib/auth/authorize";
import { saveReferenceAction, toggleReferenceAction } from "@/lib/modules/settings/actions";
import { listReferenceData, type ReferenceKind } from "@/lib/modules/settings/queries";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

const GROUPS: { kind: ReferenceKind; title: string; helper: string }[] = [
  { kind: "categories", title: "Categories", helper: "Flat categories used by the product catalog." },
  { kind: "suppliers", title: "Suppliers", helper: "Used when creating inbound receipts." },
  { kind: "customers", title: "Customers", helper: "Used when creating outbound orders." },
  { kind: "reasons", title: "Reason codes", helper: "Used for adjustments and cycle-count variances." },
];

export default async function ReferencePage() {
  if (!(await hasCapability("manageCatalog"))) return <Forbidden capability="manageCatalog" />;
  const data = await listReferenceData();

  return (
    <>
      <PageHeader title="Reference data" description="Values offered in operational forms. Units of measure are derived from products." />
      <div className="grid gap-5 lg:grid-cols-2">
        {GROUPS.map((group) => {
          const items = data[group.kind];
          const addFields: FormField[] = [
            { name: "kind", label: "Kind", type: "hidden", defaultValue: group.kind },
            { name: "name", label: "Name", required: true, full: true },
          ];
          return (
            <section key={group.kind} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{group.title}</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{group.helper}</p>
              <ul className="mt-4 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex items-center gap-2">
                      {item.name}
                      <Badge value={item.isActive ? "active" : "inactive"} />
                    </span>
                    <AutoForm
                      action={toggleReferenceAction}
                      fields={[
                        { name: "kind", label: "Kind", type: "hidden", defaultValue: group.kind },
                        { name: "id", label: "Id", type: "hidden", defaultValue: item.id },
                      ]}
                      submitLabel={item.isActive ? "Deactivate" : "Activate"}
                    />
                  </li>
                ))}
                {items.length === 0 ? <li className="py-2 text-zinc-500">No values yet.</li> : null}
              </ul>
              <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <AutoForm action={saveReferenceAction} fields={addFields} submitLabel={`Add ${group.kind.slice(0, -1)}`} />
              </div>
            </section>
          );
        })}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Units of measure</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Collected from products. Add a product with a new unit to extend this list.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.units.map((unit) => (
              <span key={unit.id} className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                {unit.name}
              </span>
            ))}
            {data.units.length === 0 ? <span className="text-sm text-zinc-500">No units yet.</span> : null}
          </div>
        </section>
      </div>
    </>
  );
}
