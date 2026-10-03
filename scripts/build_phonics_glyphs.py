#!/usr/bin/env python3
"""Shape each syllable once and freeze its coloured glyph outlines.

HarfBuzz positions every original glyph, including connecting forms and
combining marks. SVG paths retain those positions without asking browsers to
shape isolated marks across colour boundaries. No font is modified or bundled
by this generator; it uses the five licensed fonts already in the workbook.
"""
from __future__ import annotations

import argparse
from collections import Counter
import ctypes as C
import ctypes.util
import hashlib
import json
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
FONT_FILES = {
    'noto-naskh': 'NotoNaskhArabic-Regular.ttf',
    'amiri': 'Amiri-Regular.ttf',
    'scheherazade': 'Scheherazade-Regular.ttf',
    'noto-sans': 'NotoSansArabic-Regular.ttf',
    'noto-kufi': 'NotoKufiArabic-Regular.ttf',
}
VOWELS = {'fatha': '\u064e', 'damma': '\u064f', 'kasra': '\u0650'}


class GlyphInfo(C.Structure):
    _fields_ = [('codepoint', C.c_uint32), ('mask', C.c_uint32),
                ('cluster', C.c_uint32), ('var1', C.c_uint32), ('var2', C.c_uint32)]


class GlyphPosition(C.Structure):
    _fields_ = [('x_advance', C.c_int32), ('y_advance', C.c_int32),
                ('x_offset', C.c_int32), ('y_offset', C.c_int32), ('var', C.c_uint32)]


class HarfBuzz:
    def __init__(self):
        self.lib = C.CDLL(ctypes.util.find_library('harfbuzz') or 'libharfbuzz.so.0')
        api = {
            'hb_blob_create': (C.c_void_p, [C.c_void_p, C.c_uint, C.c_int, C.c_void_p, C.c_void_p]),
            'hb_blob_destroy': (None, [C.c_void_p]),
            'hb_face_create': (C.c_void_p, [C.c_void_p, C.c_uint]),
            'hb_face_destroy': (None, [C.c_void_p]),
            'hb_font_create': (C.c_void_p, [C.c_void_p]),
            'hb_font_destroy': (None, [C.c_void_p]),
            'hb_font_set_scale': (None, [C.c_void_p, C.c_int, C.c_int]),
            'hb_ot_font_set_funcs': (None, [C.c_void_p]),
            'hb_buffer_create': (C.c_void_p, []),
            'hb_buffer_destroy': (None, [C.c_void_p]),
            'hb_buffer_add_utf8': (None, [C.c_void_p, C.c_char_p, C.c_int, C.c_uint, C.c_int]),
            'hb_buffer_set_cluster_level': (None, [C.c_void_p, C.c_int]),
            'hb_buffer_set_direction': (None, [C.c_void_p, C.c_int]),
            'hb_buffer_guess_segment_properties': (None, [C.c_void_p]),
            'hb_shape': (None, [C.c_void_p, C.c_void_p, C.c_void_p, C.c_uint]),
            'hb_buffer_get_glyph_infos': (C.POINTER(GlyphInfo), [C.c_void_p, C.POINTER(C.c_uint)]),
            'hb_buffer_get_glyph_positions': (C.POINTER(GlyphPosition), [C.c_void_p, C.POINTER(C.c_uint)]),
        }
        for name, (result, args) in api.items():
            function = getattr(self.lib, name)
            function.restype, function.argtypes = result, args

    def font(self, path: Path, units: int):
        raw = path.read_bytes()
        # DUPLICATE makes the HarfBuzz blob own a copy of the Python bytes.
        blob = self.lib.hb_blob_create(raw, len(raw), 0, None, None)
        face = self.lib.hb_face_create(blob, 0)
        font = self.lib.hb_font_create(face)
        self.lib.hb_ot_font_set_funcs(font)
        self.lib.hb_font_set_scale(font, units, units)
        self.lib.hb_face_destroy(face)
        self.lib.hb_blob_destroy(blob)
        return font

    def shape(self, font, text: str):
        buffer = self.lib.hb_buffer_create()
        raw = text.encode('utf-8')
        try:
            self.lib.hb_buffer_add_utf8(buffer, raw, len(raw), 0, len(raw))
            self.lib.hb_buffer_set_cluster_level(buffer, 1)  # MONOTONE_CHARACTERS
            self.lib.hb_buffer_set_direction(buffer, 5)  # HB_DIRECTION_RTL
            self.lib.hb_buffer_guess_segment_properties(buffer)
            self.lib.hb_shape(font, buffer, None, 0)
            count = C.c_uint()
            infos = self.lib.hb_buffer_get_glyph_infos(buffer, C.byref(count))
            positions = self.lib.hb_buffer_get_glyph_positions(buffer, C.byref(count))
            return [dict(gid=infos[i].codepoint, cluster=infos[i].cluster,
                         x_advance=positions[i].x_advance, y_advance=positions[i].y_advance,
                         x_offset=positions[i].x_offset, y_offset=positions[i].y_offset)
                    for i in range(count.value)]
        finally:
            self.lib.hb_buffer_destroy(buffer)


def number(value):
    return format(value, '.8g')


def outlines(hb, font, tt, item):
    text, vowel = item['text'], VOWELS[item['vowel']]
    shaped = hb.shape(font, text)
    assert shaped and all(g['gid'] for g in shaped), (item['id'], 'missing glyph')
    stripped = ''.join(c for c in text if c not in VOWELS.values())
    base = hb.shape(font, stripped)
    explicit_count = text.count(vowel)
    assert explicit_count in (0, 1), (item['id'], 'unexpected vowel count')
    # Compare exact glyph identities rather than treating all GDEF mark glyphs
    # as vowels. Arabic dots and decomposed hamza/madda can also be GDEF marks.
    order, glyphs = tt.getGlyphOrder(), tt.getGlyphSet()
    classes = tt['GDEF'].table.GlyphClassDef.classDefs
    # Some fonts select a different BASE outline for more clearance when a
    # vowel is present (Amiri ba + fatha). Compare only the mark glyphs; retain
    # all base outlines and positions from the fully vocalized original.
    original_marks = Counter(g['gid'] for g in shaped if classes.get(order[g['gid']]) == 3)
    bare_marks = Counter(g['gid'] for g in base if classes.get(order[g['gid']]) == 3)
    delta, reverse_delta = original_marks - bare_marks, bare_marks - original_marks
    assert sum(delta.values()) == explicit_count and not reverse_delta, (item['id'], delta, reverse_delta)
    vowel_gids = set(delta)
    assert all(classes.get(order[gid]) == 3 for gid in vowel_gids), item['id']
    byte_offsets, cursor = [], 0
    for c in text:
        byte_offsets.append(cursor)
        cursor += len(c.encode('utf-8'))
    last_base = max(i for i, c in enumerate(text) if c not in VOWELS.values())
    last_cluster = byte_offsets[last_base]
    grouped, bounds = {}, None
    x, y, marks, ligature_madd = 0, 0, 0, False
    for g in shaped:
        name = order[g['gid']]
        color = 'ink'
        if g['gid'] in vowel_gids:
            color = item['vowel']
            marks += 1
        elif item['length'] == 'long':
            if text == '\u0622' or g['cluster'] == last_cluster:
                color = 'madd'
            elif classes.get(name) == 2 and len(stripped) > 1:
                # This is the original indivisible lam-alif outline in Noto
                # Sans Arabic. Highlight the complete ligature as a single
                # long-vowel shape. Arbitrary clipping colours wrong strokes.
                ligature_madd = True
                color = 'madd'
        matrix = (1, 0, 0, 1, x + g['x_offset'], y + g['y_offset'])
        path_pen = SVGPathPen(glyphs)
        glyphs[name].draw(TransformPen(path_pen, matrix))
        path = path_pen.getCommands()
        assert path, (item['id'], name, 'empty outline')
        grouped.setdefault(color, []).append(path)
        bound_pen = BoundsPen(glyphs)
        glyphs[name].draw(TransformPen(bound_pen, matrix))
        b = bound_pen.bounds
        if b:
            bounds = b if bounds is None else (min(bounds[0], b[0]), min(bounds[1], b[1]),
                                             max(bounds[2], b[2]), max(bounds[3], b[3]))
        x += g['x_advance']
        y += g['y_advance']
    assert marks == explicit_count and bounds is not None, item['id']
    xmin, ymin, xmax, ymax = bounds
    units = tt['head'].unitsPerEm
    scale = min(114 / units, 296 / max(1, xmax - xmin),
                114 / max(1, ymax), 50 / max(1, -ymin))
    center_x = 170 - (xmin + xmax) * scale / 2
    result = {
        'transform': f'translate({number(center_x)} 122) scale({number(scale)} -{number(scale)})',
        'paths': [dict(color=color, d=''.join(paths)) for color, paths in grouped.items()],
        'glyph_count': len(shaped),
        'vowel_mark_count': marks,
    }
    if ligature_madd:
        result['ligature_madd'] = True
    return result


def build(font_dir, manifest):
    items = json.loads(manifest.read_text())['items']
    assert len(items) == 168 and len({item['id'] for item in items}) == 168
    hb = HarfBuzz()
    data = {'schema_version': 1, 'view_box': '0 0 340 180',
            'font_ids': list(FONT_FILES), 'source_fonts': {},
            'glyphs': {item['id']: {} for item in items}}
    for font_id, filename in FONT_FILES.items():
        path = font_dir / filename
        tt = TTFont(path)
        font = hb.font(path, tt['head'].unitsPerEm)
        try:
            data['source_fonts'][font_id] = {'filename': filename,
                                            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
            for item in items:
                try:
                    data['glyphs'][item['id']][font_id] = outlines(hb, font, tt, item)
                except AssertionError as error:
                    raise AssertionError((font_id, *error.args)) from error
        finally:
            hb.lib.hb_font_destroy(font)
            tt.close()
    assert sum(len(fonts) for fonts in data['glyphs'].values()) == 840
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--font-dir', type=Path, required=True)
    parser.add_argument('--manifest', type=Path, default=ROOT / 'release-assets/phonics-20261003/audio-manifest.json')
    parser.add_argument('--output', type=Path, default=ROOT / 'release-assets/phonics-20261003/glyphs.json')
    args = parser.parse_args()
    data = build(args.font_dir, args.manifest)
    args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f"Generated {len(data['glyphs'])} syllables in {len(data['font_ids'])} fonts; 840 shaped outline sets.")


if __name__ == '__main__':
    main()
