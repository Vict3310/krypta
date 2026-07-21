import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[200px] p-8">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    </div>
  );
}
