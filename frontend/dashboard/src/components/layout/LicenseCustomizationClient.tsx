"use client"

import { type ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog"
import { LicenseCustomizationView } from "../license-admin/LicenseCustomizationView"

export function LicenseCustomizationClient({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-[90vw] lg:max-w-[75vw] xl:max-w-[60vw] h-auto max-h-[90vh] overflow-y-auto">
        <LicenseCustomizationView />
      </DialogContent>
    </Dialog>
  )
}
