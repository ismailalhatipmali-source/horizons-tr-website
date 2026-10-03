# Section 03 — Two-letter blending

This is prepared content, not a published lesson. Section02 remains the live
phonics module. The 81 open-card audio/glyph references reuse approved section02
assets; the 27 closed-word recordings are not available yet.

Run `python3 scripts/prepare_blending2_content.py` to regenerate `content.json`.
Its exact `closed_transcript` order is the recording/splitting contract. New
closed-word audio paths remain null until a recording is supplied, split,
mapped and approved. Do not publish a button pointing to an unavailable asset.

Implement section03 in the current supplementary-course coordinator, with a
03 navigation card between02 and06. Reuse glyph IDs for open cards. New closed
words require full-word shaping for all five fonts: vowel and sukun must be
classified independently, never draw duplicated text overlays or place
isolated character forms next to one another.

Teaching sequence: play the approved initial CV; show the complete joined CVC
word with its final consonant highlighted; play the approved complete CVC.
The final consonant has no isolated recording. Respect reduced motion. Keep
meanings outside the target recording and use no new pictures.

Track section03 independently using valid existing namespaces such as
`alphabet.blend2_open_baa_fatha`, `alphabet.blend2_closed_qul_normal`, and
`alpha-blend2-closed-qul`. Use the current learner owner/token protections and
do not write section03 activity into section02 completion counts. Flashcards
need swipe navigation plus ordinary previous/next controls; listen-and-choose
answers stay disabled until the complete question recording ends.
