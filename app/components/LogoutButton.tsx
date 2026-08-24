"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/backoffice/logout", { method: "POST" });
    router.replace("/backoffice/login");
    router.refresh();
  }

  return (
    <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-900 underline">
      Sair
    </button>
  );
}
