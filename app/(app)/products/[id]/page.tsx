import { notFound } from "next/navigation";
import { AutoForm, type FormField } from "@/components/ui/auto-form";
import { PageHeader } from "@/components/ui/page-header";
import { saveProductAction } from "@/lib/modules/catalog/actions";
import { getProduct, listCategories } from "@/lib/modules/catalog/queries";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([getProduct(id), listCategories()]);
  if (!product) notFound();

  const fields: FormField[] = [
    { name: "id", label: "ID", type: "hidden", defaultValue: product.id },
    { name: "sku", label: "SKU", required: true, defaultValue: product.sku },
    { name: "name", label: "Product name", required: true, defaultValue: product.name, full: true },
    { name: "barcode", label: "Barcode", defaultValue: product.barcode },
    { name: "categoryId", label: "Category", type: "select", required: true, defaultValue: product.categoryId, options: categories.map((category) => ({ value: category.id, label: category.name })) },
    { name: "uom", label: "Unit of measure", defaultValue: product.uom, required: true },
    { name: "minStock", label: "Minimum stock", type: "number", defaultValue: String(product.minStock), min: 0 },
    { name: "isActive", label: "Status", type: "select", defaultValue: product.isActive ? "on" : "off", options: [{ value: "on", label: "Active" }, { value: "off", label: "Archived" }] },
    { name: "description", label: "Description", type: "textarea", defaultValue: product.description, full: true },
  ];

  return (
    <>
      <PageHeader title={product.name} description={`SKU ${product.sku}`} />
      <div className="max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <AutoForm action={saveProductAction} fields={fields} submitLabel="Save changes" cancelHref="/products" />
      </div>
    </>
  );
}
