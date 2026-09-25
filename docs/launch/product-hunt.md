# Product Hunt

## Name

mitame

## Tagline (60 characters max)

`Copy-paste React components from 2001 Aqua to 2026 glass`  (56)

Alternatives:
- `React components that wear any era, 1997 to 2026` (48)
- `Old UI brought back to life, as React components` (48)

## Description (260 characters max)

mitame (見た目, "the way it looks") is a copy-paste React library with era themes. The same components render as Mac OS 8 gray, 2001 Aqua gel or 2026 liquid glass. Built on native dialog and popover, so there is nothing to install but React. MIT.

## Gallery order

1. `gallery-1-aqua.png` (Y2K aqua, the most recognizable)
2. `gallery-3-platinum.png` (Vintage platinum, the biggest contrast)
3. `gallery-2-liquid.png` (Now liquid glass, the trend)
4. `eras.gif` (the switch in motion), or an mp4 if you made one

## Topics

Design Tools, Developer Tools, User Experience, Open Source

## First comment (post as maker, right after launch)

Hi Product Hunt 👋

I kept noticing that every app I liked as a kid looked better than the apps I build now. Gel buttons you wanted to press. Windows with actual edges. Somewhere along the way UI got flat and every site started looking the same.

So I built mitame. It is a copy-paste React library where the same components can wear any era:

- **Vintage · platinum**: Mac OS 8 and 9 gray, bevels, hard shadows, square corners
- **Y2K · aqua**: gel buttons, pinstripes, the blue popup arrows, yellow help tags
- **Now · liquid**: frosted liquid glass with rim light and deep shadows

You switch with one attribute, `data-theme`, and your markup never changes.

Two things I care about in it:

**You own the code.** `npx mitame add dialog` copies the source into your project. No black box in node_modules, edit anything.

**Nothing to install but React.** Dialogs use the native `<dialog>`, menus and popovers use the browser's Popover API, inputs are real form inputs. No Radix, no Floating UI, no tailwind-merge. Keyboard support, focus handling and the top layer come from the browser, which also means less of my code to get wrong.

Tokens and icons are designed in Figma and generated into CSS, so the design file and the code cannot drift apart.

13 components today, with more eras coming (1-bit black and white is next). It is MIT, and I would love feedback on which era to build after that.

mitame.dev
