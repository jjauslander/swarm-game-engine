# Flat presentation and audio provenance

No Blender models, Babylon runtime, generated images, large recordings or third-party audio were copied.

The hex coordinate arrangement/directions are adapted from original geometry.ts at 6c57ddac2b2deaf4fc62df2b6a7a0ce1705d712a; the new generator independently produces package data with stable IDs.

Historical reference inspected: git show dae246f:src/presentation/sound-effects.ts (early finite synthesized cues) and the retained flat Pixi board implementation. Commits 27022d0 and 80df373 identify the inlaid-puck and renderer-contract lineage; 2fa094b identifies the later 3D integration boundary.

The new client uses original procedural hex drawing, simple system-font Queen/bee/resource symbols, coloured puck borders and gold/green board fills inspired by the earlier flat board. It does not copy bitmap assets, original music or recordings. Audio is newly implemented short finite oscillator/envelope cues inspired by the early synthesized approach.

Engine code retains repository Apache 2.0 licensing. No licensing conclusion about the original project's artwork, branding or recordings is inferred from that license. No such external asset files are included. New procedural presentation code follows this repository's license; system glyph appearance depends on the device font.

Designer appearance/listening review remains separate. This delivers the requested flatter baseline, not exact pixel reproduction of a historical screenshot.
