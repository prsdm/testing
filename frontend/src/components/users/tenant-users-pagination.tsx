"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/shared/utils";

const USERS_PAGE_SIZE = 8;
const AGENT_FORM_TABLE_PAGE_SIZE = 5;

function getPaginationItems(
  currentPage: number,
  totalPages: number
): Array<number | "ellipsis"> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, "ellipsis", totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 2, totalPages - 1, totalPages];
  }

  return [
    1,
    "ellipsis",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis",
    totalPages,
  ];
}

export function TenantUsersPagination({
  currentPage,
  totalPages,
  onPageChange,
  align = "start",
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  align?: "start" | "center" | "end";
}) {
  if (totalPages <= 1) {
    return null;
  }

  const items = getPaginationItems(currentPage, totalPages);
  let ellipsisCounter = 0;

  const goToPage = (page: number) => {
    onPageChange(page);
  };

  return (
    <Pagination
      className={cn(
        align === "center" ? "w-full justify-center" : "mx-0 w-auto",
        align === "end" ? "ml-auto justify-end" : undefined,
        align === "start" ? "justify-start" : undefined
      )}
    >
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            className={cn(currentPage <= 1 && "pointer-events-none opacity-50")}
            href="#"
            onClick={(event) => {
              event.preventDefault();
              if (currentPage > 1) {
                goToPage(currentPage - 1);
              }
            }}
          />
        </PaginationItem>
        {items.map((item) => {
          if (item === "ellipsis") {
            ellipsisCounter += 1;
            const ellipsisKey =
              ellipsisCounter === 1 ? "ellipsis-start" : "ellipsis-end";

            return (
              <PaginationItem key={ellipsisKey}>
                <PaginationEllipsis />
              </PaginationItem>
            );
          }

          return (
            <PaginationItem key={item}>
              <PaginationLink
                href="#"
                isActive={currentPage === item}
                onClick={(event) => {
                  event.preventDefault();
                  goToPage(item);
                }}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          );
        })}
        <PaginationItem>
          <PaginationNext
            className={cn(
              currentPage >= totalPages && "pointer-events-none opacity-50"
            )}
            href="#"
            onClick={(event) => {
              event.preventDefault();
              if (currentPage < totalPages) {
                goToPage(currentPage + 1);
              }
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export { AGENT_FORM_TABLE_PAGE_SIZE, USERS_PAGE_SIZE };
