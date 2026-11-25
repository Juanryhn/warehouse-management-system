import { AutoForm, type FormField } from "@/components/ui/auto-form";
import { PageHeader } from "@/components/ui/page-header";
import { importProductsAction } from "@/lib/modules/catalog/actions";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

const fields: FormField[] = [
  {
    name: "csv",
    label: "CSV rows",
    type: "textarea",
    required: true,
    full: true,
    placeholder: "sku,name,barcode,category,uom,min_stock\nSKU-1007,Stretch wrap,,General,pcs,10",
    helper: "Headers: sku, name, barcode, category, uom, min_stock. First row must be the header.",
  },
  { name: "dryRun", label: "Mode", type: "select", defaultValue: "on", options: [{ value: "on", label: "Dry run (validate only)" }, { value: "off", label: "Commit import" }] },
];

export default function ImportProductsPage() {
  return (
    <>
      <PageHeader title="Import products" description="All 1,000 or fewer rows commit together or none do." />
      <div className="max-w-3xl rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <AutoForm action={importProductsAction} fields={fields} submitLabel="Run import" cancelHref="/products" />
      </div>
    </>
  );
}
