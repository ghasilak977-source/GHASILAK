import { EmptyState } from "@/components/ui/empty-state";

export function PermissionDenied({
  locale,
  title,
  body,
}: {
  locale: "ar" | "en";
  title?: string;
  body?: string;
}) {
  return (
    <EmptyState
      title={
        title ||
        (locale === "ar" ? "غير مصرح" : "Permission denied")
      }
      description={
        body ||
        (locale === "ar"
          ? "ليس لديك صلاحية لعرض هذه الصفحة."
          : "You do not have access to this page.")
      }
    />
  );
}
