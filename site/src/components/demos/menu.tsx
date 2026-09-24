import { MoreIcon } from "@mitame/icons/more";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@mitame/ui/menu";

export default function MenuDemo() {
  return (
    <Menu>
      <MenuTrigger aria-label="Project actions">
        <MoreIcon /> Actions
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>Project</MenuLabel>
        <MenuItem onSelect={() => console.log("rename")}>Rename</MenuItem>
        <MenuItem onSelect={() => console.log("duplicate")}>Duplicate</MenuItem>
        <MenuItem disabled>Share…</MenuItem>
        <MenuSeparator />
        <MenuItem variant="danger" onSelect={() => console.log("delete")}>
          Delete
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
