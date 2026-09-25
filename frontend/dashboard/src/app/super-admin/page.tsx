import { Metadata } from "next";
import { SuperAdminWrapper } from "@/components/super-admin/super-admin-wrapper";

export const metadata: Metadata = {
    title: "Super Admin - AI GovCoreX OS",
    description: "Gestión de licencias, organizaciones y módulos",
};

export default function SuperAdminPage() {
    return <SuperAdminWrapper />;
}
