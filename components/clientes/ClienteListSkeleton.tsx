"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ClienteListSkeleton() {
  return (
    <div className="space-y-3 animate-[fadeIn_0.3s_ease-out]">
      {[1, 2, 3].map((i) => (
        <Card key={i} animate={false}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}
