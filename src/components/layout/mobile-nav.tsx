"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/layout/app-sidebar";

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0 w-64" showCloseButton={false} aria-label="Navigation menu">
        <AppSidebar onMobileClose={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
