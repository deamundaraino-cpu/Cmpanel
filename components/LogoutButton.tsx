"use client";

import { useRouter } from "next/navigation";
import Icon from "@/components/icons";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="flex items-center gap-2.5 text-[13px] text-zinc-500 transition-colors duration-200 hover:text-zinc-200"
    >
      <Icon name="logout" className="h-[17px] w-[17px]" />
      Cerrar sesión
    </button>
  );
}
