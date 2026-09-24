import { Select } from "@mitame/ui/select";

export default function SelectDemo() {
  return (
    <Select
      aria-label="Era"
      name="era"
      defaultValue="y2k"
      options={[
        { value: "vintage", label: "Vintage · 1984" },
        { value: "y2k", label: "Y2K · 2001" },
        { value: "now", label: "Now · 2026" },
        { value: "remix", label: "Remix", disabled: true },
      ]}
    />
  );
}
