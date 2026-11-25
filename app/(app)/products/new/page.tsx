import { AutoForm, type FormField } from "@/components/ui/auto-form";
import { PageHeader } from "@/components/ui/page-header";
import { saveProductAction } from "@/lib/modules/catalog/actions";
import { listCategories } from "@/lib/modules/catalog/queries";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

export default async function NewProductPage() {
  const categories = await listCategories();

  const fields: FormField[] = [
    { name: "sku", label: "SKU", required: true, placeholder: "SKU-1007" },
    { name: "name", label: "Product name", required: true, full: true },
    { name: "barcode", label: "Barcode", placeholder: "Optional" },
    { name: "categoryId", label: "Category", type: "select", required: true, options: categories.map((category) => ({ value: category.id, label: category.name })) },
    { name: "uom", label: "Unit of measure", defaultValue: "pcs", required: true },
    { name: "minStock", label: "Minimum stock", type: "number", defaultValue: "0", min: 0 },
    { name: "isActive", label: "Status", type: "select", defaultValue: "on", options: [{ value: "on", label: "Active" }, { value: "off", label: "Archived" }] },
    { name: "description", label: "Description", type: "textarea", full: true },
  ];

  return (
    <>
      <PageHeader title="New product" description="SKU and name are required. Barcode must be unique when provided." />
      <div className="max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <AutoForm action={saveProductAction} fields={fields} submitLabel="Create product" cancelHref="/products" />
      </div>
    </>
  );
}
