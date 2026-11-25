import { AutoForm, type FormField } from "@/components/ui/auto-form";
import { PageHeader } from "@/components/ui/page-header";
import { saveLocationAction } from "@/lib/modules/locations/actions";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

const fields: FormField[] = [
  { name: "code", label: "Bin code", required: true, placeholder: "A-01-04", helper: "Letters, numbers and dashes. Unique per warehouse." },
  { name: "zone", label: "Zone", required: true, placeholder: "A" },
  { name: "type", label: "Type", type: "select", required: true, options: [
    { value: "receiving", label: "Receiving" },
    { value: "storage", label: "Storage" },
    { value: "picking", label: "Picking" },
    { value: "quarantine", label: "Quarantine" },
  ] },
  { name: "isActive", label: "Status", type: "select", defaultValue: "on", options: [{ value: "on", label: "Active" }, { value: "off", label: "Inactive" }] },
];

export default function NewLocationPage() {
  return (
    <>
      <PageHeader title="New location" description="Bins are unique within the warehouse." />
      <div className="max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <AutoForm action={saveLocationAction} fields={fields} submitLabel="Create location" cancelHref="/locations" />
      </div>
    </>
  );
}
