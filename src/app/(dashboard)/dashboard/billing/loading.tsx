import { Loader2 } from "lucide-react";

export default function BillingLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-gray-400 animate-spin mx-auto mb-4" />
        <p className="text-gray-400 text-sm">Loading billing...</p>
      </div>
    </div>
  );
}
