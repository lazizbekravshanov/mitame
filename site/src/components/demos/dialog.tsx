import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@mitame/ui/dialog";

export default function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger>Delete project</DialogTrigger>
      <DialogContent>
        <DialogTitle>Delete this project?</DialogTitle>
        <DialogDescription>12 pages will be gone for good. This can't be undone.</DialogDescription>
        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
          <DialogClose data-variant="danger">Delete</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
