import { Button } from "@mitame/ui/button";
import { Toaster, toast } from "@mitame/ui/toast";

export default function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="primary"
        onClick={() =>
          toast.success("Changes saved", {
            description: "Your profile is up to date.",
            action: { label: "Undo", onClick: () => toast("Undone") },
          })
        }
      >
        Save
      </Button>
      <Button onClick={() => toast.error("Couldn't connect", { description: "Check your network and try again." })}>
        Fail
      </Button>
      {/* Render <Toaster /> once near the root of your app. */}
      <Toaster />
    </div>
  );
}
