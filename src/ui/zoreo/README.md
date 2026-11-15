# Zoreo (final)

`Zoreo.svg` is the canonical pose: head tipped down, eyes looking about 45 degrees down to the viewer's left. `Zoreo-blink.svg` is the same file with the lids closed. viewBox `0 -26 254 306`, light from the upper left.

## Ids

Every id and every `url(#…)`/`href="#…"` uses the placeholder prefix `zo-`. Replace `zo-` with a unique prefix per inline instance (a plain string replace is safe, because nothing else in the file contains `zo-`).

Named groups: `zo-ears`, `zo-neck` (contains `zo-neck-stripe`), `zo-mane`, `zo-head` (contains `zo-stripes`, `zo-nose`, `zo-mouth`, `zo-eyes`). Inside `zo-eyes` are `zo-pupils` (irises, pupils and catchlights) and `zo-lids` (one `g.zo-lid` per eye).

The nose (snout pad, nostrils, chin line) is the group `zo-nose`, inside the head.

## Animation hooks

- **Blink:** `.zo-lid { transform: none }` closes both eyes. The open state is a `transform` attribute (scale from the top of each eye), and CSS overrides it. To tween, animate `transform` between that matrix and `none`.
- **Gaze:** translate `#zo-pupils`; it is clipped to the eye whites. Keep the shift within about ±5 units.
- **Mouth:** `#zo-smile` is one stroked path. A soft highlight inside `zo-mouth` reuses it (`<use>`), so it follows any change to `d`. Every variant uses the same commands (M Q Q Q), so the paths can be morphed:
  - smile: `M38 170Q40 178 47 181Q86 199 125 176Q131 172 131 164`
  - straight: `M40 184Q42 186 47 186Q86 189 125 184Q129 183 131 181`
  - frown: `M41 192Q42 186 47 184Q86 172 125 182Q129 184 130 190`
- **Flip:** `transform: scaleX(-1)` on the svg (or a wrapper). The highlights flip with the art, so the light comes from the upper right. Accepted: it reads naturally, and correcting it would mean a second set of highlights.

## Strap (title scene)

Fit the strap to the slope of the neck bands (higher at the back):

- **Top edge:** about y 214 at the throat (x 100), rising to y 178 at the back (x 246). That is just under the blue band and below the jaw shadow.
- **Bottom edge:** about y 236 at the front, y 200 at the back.

That gives a strap about 22 units wide. Above y 205 at the front it starts to cover the blue band; below y 250 it runs into the shoulder flare. The preview shows this zone as a dashed guide.

## Corner head

Use viewBox `16 -26 240 270` for a box of about 240×270. It keeps the ears, mohawk, snout and blue band and cuts the neck straight at y 244. It reads at 60 and 100 px on #15171C, flipped and blinking.

## Cost

- Size: 11.7 KB (3.5 KB gzipped).
- 1 blur filter (stdDeviation 5), used on 7 static layers (speculars, head shadow, mane halo, base shadow).
- 14 gradients, no masks.
- Nothing animated is filtered.
