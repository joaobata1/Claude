import BackofficeTabs from "@/app/components/BackofficeTabs";

export default function BackofficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <BackofficeTabs />
      {children}
    </div>
  );
}
