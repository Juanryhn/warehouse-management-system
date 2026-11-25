import { AutoForm, type FormField } from "@/components/ui/auto-form";
import { Forbidden } from "@/components/ui/forbidden";
import { Badge, PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { hasCapability } from "@/lib/auth/authorize";
import { createUserAction, resetPasswordAction, setUserStatusAction } from "@/lib/modules/settings/actions";
import { listUsers } from "@/lib/modules/settings/queries";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

const createFields: FormField[] = [
  { name: "name", label: "Full name", required: true, full: true },
  { name: "email", label: "Email", type: "text", required: true, placeholder: "name@wms.local" },
  { name: "role", label: "Role", type: "select", required: true, options: [
    { value: "admin", label: "Admin" },
    { value: "manager", label: "Manager" },
    { value: "operator", label: "Operator" },
    { value: "viewer", label: "Viewer" },
  ] },
  { name: "password", label: "Temporary password", type: "text", required: true, helper: "At least 8 characters. Share it securely; it is never shown again." },
  { name: "isActive", label: "Status", type: "select", defaultValue: "on", options: [{ value: "on", label: "Active" }, { value: "off", label: "Inactive" }] },
];

export default async function UsersPage() {
  if (!(await hasCapability("manageUsers"))) return <Forbidden capability="manageUsers" />;
  const rows = await listUsers();

  const resetFields = (id: string): FormField[] => [
    { name: "id", label: "User", type: "hidden", defaultValue: id },
    { name: "password", label: "New password", type: "text", required: true, helper: "Ends all active sessions." },
  ];
  const statusFields = (id: string, isActive: boolean): FormField[] => [
    { name: "id", label: "User", type: "hidden", defaultValue: id },
    { name: "status", label: "Status", type: "hidden", defaultValue: isActive ? "inactive" : "active" },
  ];

  return (
    <>
      <PageHeader title="Users & roles" description="Internal accounts only. Deactivating a user immediately ends their sessions." />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          empty="No users found."
          columns={[
            { key: "name", label: "Name", render: (row) => <span className="font-medium text-zinc-900 dark:text-zinc-50">{row.name}</span> },
            { key: "email", label: "Email", render: (row) => <span className="text-xs">{row.email}</span> },
            { key: "role", label: "Role", render: (row) => <Badge value={row.role} /> },
            { key: "status", label: "Status", render: (row) => <Badge value={row.isActive ? "active" : "inactive"} /> },
            { key: "created", label: "Created", render: (row) => <span className="text-xs text-zinc-500">{row.createdAt}</span> },
            { key: "reset", label: "Reset password", render: (row) => <AutoForm action={resetPasswordAction} fields={resetFields(row.id)} submitLabel="Reset" /> },
            { key: "toggle", label: "Status", render: (row) => (
              <AutoForm action={setUserStatusAction} fields={statusFields(row.id, row.isActive)} submitLabel={row.isActive ? "Deactivate" : "Activate"} />
            ) },
          ]}
        />
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">New user</h2>
          <AutoForm action={createUserAction} fields={createFields} submitLabel="Create user" />
        </div>
      </div>
    </>
  );
}
