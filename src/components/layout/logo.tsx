import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = "default",
}: {
  className?: string;
  size?: "sm" | "default" | "lg";
}) {
  const sizes = {
    sm: { icon: "size-4", text: "text-lg" },
    default: { icon: "size-5", text: "text-xl" },
    lg: { icon: "size-7", text: "text-3xl" },
  };

  const s = sizes[size];

  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2 font-serif text-primary", className)}
    >
      <ShieldCheck className={s.icon} />
      <span className={s.text}>COIStack</span>
    </Link>
  );
}
