# X / Twitter

## Launch thread

**1/ (attach eras.gif, or the three gallery images if you prefer stills)**

same React code. three eras.

1997 Mac OS gray → 2001 Aqua gel → 2026 liquid glass

I built mitame, a copy-paste component library where you change one attribute and the whole UI time travels 🧵

**2/**

mitame (見た目) is Japanese for "the way it looks".

that is the whole idea: your markup stays the same, only the 見た目 changes.

```
<html data-theme="aqua">
<html data-theme="platinum">
<html data-theme="liquid">
```

**3/ (attach eras.gif)**

it is copy-paste, like shadcn:

npx mitame add dialog

the source lands in your project. edit anything. no black box in node_modules.

**4/**

the part I am most happy about: zero runtime dependencies besides React.

dialogs are the native `<dialog>`
menus and popovers use the Popover API
inputs are real form inputs

no Radix, no Floating UI, no tailwind-merge. the browser does the hard parts now.

**5/**

that also means the accessibility basics are not my invention: focus trapping, Escape, the top layer, keyboard nav all come from the platform.

and phones get 44px touch targets, no iOS zoom on focus, no hover stuck after a tap.

**6/**

tokens and icons live in Figma, and a script generates the CSS variables and icon components. CI fails if they drift.

so the design file and the code cannot disagree, which was my main frustration building design systems before.

**7/**

13 components, 6 looks, MIT, React 19.

eras: platinum (1997), aqua (2001), liquid (2026)
styles: brutalist, minimal, urban

next: 1-bit black and white, then page templates.

which look should I build after that?

mitame.dev

## Spare single posts

**Visual hook**
the same Preferences screen, three decades apart. one React codebase, one attribute.
mitame.dev

**Technical hook**
built a React component library with zero runtime dependencies besides React.
native `<dialog>`, the Popover API, real form inputs.
turns out the browser does most of it now.
mitame.dev

**Nostalgia hook**
2001 Aqua buttons looked so good Steve Jobs said you wanted to lick them.
I rebuilt them in CSS, as real React components.
mitame.dev
