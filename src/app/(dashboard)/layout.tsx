import { Sidebar } from "@/components/Sidebar";
import { Toaster } from "sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-sf-bg-primary">
      <Sidebar />
      <div className="flex-1 ml-0 md:ml-64 pt-16 md:pt-0 relative z-10 w-full h-full overflow-y-auto">
        {children}
      </div>
      <Toaster theme="light" position="bottom-right" className="!font-sans" />
    </div>
  );
}
