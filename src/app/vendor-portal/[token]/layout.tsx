import { Logo } from "@/components/layout/logo";

export default function VendorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div>
            <Logo size="sm" />
            <p className="mt-0.5 text-xs text-muted-foreground">Vendor Self-Service Portal</p>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer className="border-t py-6">
        <p className="text-center text-xs text-muted-foreground">
          Powered by COIStack &middot; Secure document upload
        </p>
      </footer>
    </div>
  );
}
