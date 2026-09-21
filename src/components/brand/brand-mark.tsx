import Image from "next/image";

export function BrandMark({
  className = "",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/ghasilak-logo.png"
      alt="GHASILAK — غسيلك"
      width={1168}
      height={1021}
      priority={priority}
      className={className}
    />
  );
}
