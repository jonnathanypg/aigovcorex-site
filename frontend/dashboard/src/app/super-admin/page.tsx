import { Metadata } from "next";
import { SuperAdminWrapper } from "@/components/super-admin/super-admin-wrapper";

export const metadata: Metadata = {
    title: "Super Admin - KindiCore",
    description: "Gestión de licencias y centros",
};

export default function SuperAdminPage() {
    return <SuperAdminWrapper />;
}
