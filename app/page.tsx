import Workbench from "@/components/Workbench";

export default function Page() {
  const hasKey = !!process.env.ANTHROPIC_API_KEY?.trim();
  return <Workbench hasKey={hasKey} />;
}
