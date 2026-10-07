"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  page,
  pages,
  total,
  pageSize,
  onPageChange,
  className,
}: PaginationProps) {
  const safePages = Math.max(pages, 1);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // 最多展示 5 个页码，围绕当前页滚动
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(safePages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pageNumbers = Array.from(
    { length: Math.max(end - start + 1, 0) },
    (_, i) => start + i,
  );

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-3 border-t border-border/60 px-4 py-3 sm:flex-row",
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">
        共 <span className="font-medium text-foreground">{total}</span> 条 · 当前{" "}
        {from}-{to} 条 · 第 {page}/{safePages} 页
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="上一页"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pageNumbers.map((num) => (
          <Button
            key={num}
            variant={num === page ? "default" : "ghost"}
            size="icon-sm"
            onClick={() => onPageChange(num)}
            className={cn("text-xs", num === page && "pointer-events-none")}
          >
            {num}
          </Button>
        ))}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= safePages}
          aria-label="下一页"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
