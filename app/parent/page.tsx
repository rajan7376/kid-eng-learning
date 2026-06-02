import { redirect } from "next/navigation";
import { getSession } from "@/lib/authServer";
import ParentUpload from "@/components/ParentUpload";

export const dynamic = "force-dynamic";

export default async function ParentPage() {
  const session = await getSession();
  if (!session || (session.role !== "parent" && session.role !== "admin"))
    redirect("/login");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-brand">家長上傳</h1>
      <ParentUpload />
    </div>
  );
}
