#!/usr/bin/env python3
"""Check every pre-shaped vowel against the visible SVG geometry contract."""
import json
from pathlib import Path
import re
import unittest

from fontTools.pens.boundsPen import BoundsPen
from fontTools.svgLib.path import parse_path

ROOT = Path(__file__).resolve().parents[1]


class PhonicsGlyphs(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.table = json.loads((ROOT / 'release-assets/phonics-20261003/glyphs.json').read_text())
        cls.items = json.loads((ROOT / 'release-assets/phonics-20261003/audio-manifest.json').read_text())['items']

    def test_complete_fonts_and_single_vowel(self):
        fonts = ['noto-naskh', 'amiri', 'scheherazade', 'noto-sans', 'noto-kufi']
        self.assertEqual(self.table['font_ids'], fonts)
        self.assertEqual(len(self.table['glyphs']), 168)
        for item in self.items:
            with self.subTest(item=item['id']):
                self.assertEqual(list(self.table['glyphs'][item['id']]), fonts)
                for font, shape in self.table['glyphs'][item['id']].items():
                    colors = [path['color'] for path in shape['paths']]
                    self.assertEqual(len(colors), len(set(colors)))
                    expected_count = 0 if item['text'] == 'آ' else 1
                    self.assertEqual(shape['vowel_mark_count'], expected_count)
                    self.assertEqual(colors.count(item['vowel']), expected_count)
                    self.assertFalse(set(colors) - {'ink', item['vowel'], 'madd'})
                    self.assertEqual('madd' in colors, item['length'] == 'long')
                    self.assertGreaterEqual(shape['glyph_count'], len(shape['paths']))

    def test_every_outline_fits_shared_viewbox(self):
        for item_id, fonts in self.table['glyphs'].items():
            for font, shape in fonts.items():
                with self.subTest(item=item_id, font=font):
                    match = re.fullmatch(r'translate\(([-\d.e]+) 122\) scale\(([-\d.e]+) -([-\d.e]+)\)', shape['transform'])
                    self.assertIsNotNone(match)
                    x, scale, negative_scale = map(float, match.groups())
                    self.assertAlmostEqual(scale, negative_scale)
                    self.assertGreater(scale, 0)
                    pen = BoundsPen(None)
                    for path in shape['paths']:
                        self.assertTrue(path['d'])
                        parse_path(path['d'], pen)
                    xmin, ymin, xmax, ymax = pen.bounds
                    self.assertGreaterEqual(x + xmin * scale, 21.9999)
                    self.assertLessEqual(x + xmax * scale, 318.0001)
                    self.assertGreaterEqual(122 - ymax * scale, 7.9999)
                    self.assertLessEqual(122 - ymin * scale, 172.0001)

    def test_connected_lam_alif_is_retained(self):
        shapes = self.table['glyphs']['phonics.laam.fatha.long']
        merged = [font for font, shape in shapes.items() if shape.get('ligature_madd')]
        self.assertEqual(merged, ['noto-sans'])
        # One vowel plus one complete native ligature: no isolated lam/alif
        # substitutes and no doubled base letter or vowel overlays.
        self.assertEqual(shapes['noto-sans']['glyph_count'], 2)
        self.assertEqual([path['color'] for path in shapes['noto-sans']['paths']], ['fatha', 'madd'])


if __name__ == '__main__':
    unittest.main()
