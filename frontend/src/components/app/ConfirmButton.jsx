import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ConfirmButton({ title, description, confirmLabel = "Confirm", onConfirm, children, testid, ...btn }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={busy} data-testid={testid} {...btn}>{children}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-slate-800 bg-[#0B1220]">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid={`${testid}-cancel`}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={go} data-testid={`${testid}-confirm`}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
