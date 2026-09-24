import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@mitame/ui/tabs";

export default function TabsDemo() {
  return (
    <Tabs defaultValue="account" className="w-full max-w-sm">
      <TabsList aria-label="Settings">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="privacy">Privacy</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
      </TabsList>
      <TabsPanel value="account" className="text-sm">Name, email and avatar.</TabsPanel>
      <TabsPanel value="privacy" className="text-sm">Who can see your profile.</TabsPanel>
      <TabsPanel value="billing" className="text-sm">Plan and invoices.</TabsPanel>
    </Tabs>
  );
}
