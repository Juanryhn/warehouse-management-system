import { notFound } from "next/navigation";
import { AutoForm, type FormField } from "@/components/ui/auto-form";
import { PageHeader } from "@/components/ui/page-header";
import { saveLocationAction, setLocationStatusAction } from "@/lib/modules/locations/actions";
import { getLocation } from "@/lib/modules/locations/queries";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

export default async function EditLocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const location = await getLocation(id);
  if (!location) notFound();

  const fields: FormField[] = [
    { name: "id", label: "ID", type: "hidden", defaultValue: location.id },
    { name: "code", label: "Bin code", required: true, defaultValue: location.code },
    { name: "zone", label: "Zone", required: true, defaultValue: location.zone },
    { name: "type", label: "Type", type: "select", required: true, defaultValue: location.type, options: [
      { value: "receiving", label: "Receiving" },
      { value: "storage", label: "Storage" },
      { value: "picking", label: "Picking" },
      { value: "quarantine", label: "Quarantine" },
    ] },
    { name: "isActive", label: "Status", type: "select", defaultValue: location.isActive ? "on" : "off", options: [{ value: "on", label: "Active" }, { value: "off", label: "Inactive" }] },
  ];

  const statusFields: FormField[] = [
    { name: "id", label: "ID", type: "hidden", defaultValue: location.id },
    { name: "status", label: "Status", type: "hidden", defaultValue: location.isActive ? "inactive" : "active" },
  ];

  return (
    <>
      <PageHeader title={location.code} description={`${location.zone} zone · ${location.type}`} />
      <div className="max-w-2xl space-y-5">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <AutoForm action={saveLocationAction} fields={fields} submitLabel="Save changes" cancelHref="/locations" />
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Change status</h2>
          <AutoForm
            action={setLocationStatusAction}
            fields={statusFields}
            submitLabel={location.isActive ? "Deactivate bin" : "Activate bin"}
          />
        </div>
      </div>
    </>
  );
}
