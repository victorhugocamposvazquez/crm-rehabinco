"use client";

import { type BreadcrumbItem, Breadcrumb } from "./Breadcrumb";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  breadcrumb?: BreadcrumbItem[];
  title: string;
  description?: string;
  descriptionClassName?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  breadcrumb,
  title,
  description,
  descriptionClassName,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("animate-[fadeIn_0.3s_ease-out]", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <Breadcrumb items={breadcrumb} className="mb-4" />
      )}
      <div className="flex flex-col gap-3 min-[820px]:flex-row min-[820px]:flex-wrap min-[820px]:items-end min-[820px]:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground min-[820px]:text-[28px]">
            {title}
          </h1>
          {description && (
            <p className={cn("mt-1.5 max-w-2xl text-[13px] text-[var(--text-2)]", descriptionClassName)}>
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex w-full min-w-0 flex-wrap min-[820px]:w-auto">{actions}</div>}
      </div>
    </div>
  );
}
