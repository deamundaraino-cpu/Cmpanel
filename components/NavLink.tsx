"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { IconName } from "@/components/icons";

export default function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: IconName;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors duration-200 ${
        active
          ? "bg-indigo-500/10 font-medium text-indigo-200"
          : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-indigo-400" />
      )}
      <Icon
        name={icon}
        className={`h-[17px] w-[17px] shrink-0 transition-colors duration-200 ${
          active ? "text-indigo-300" : "text-zinc-500 group-hover:text-zinc-300"
        }`}
      />
      {children}
    </Link>
  );
}
