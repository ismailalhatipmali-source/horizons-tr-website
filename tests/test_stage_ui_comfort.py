import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
spec=importlib.util.spec_from_file_location('stage',Path(__file__).resolve().parents[1]/'scripts/stage_ui_comfort.py')
stage=importlib.util.module_from_spec(spec);spec.loader.exec_module(stage)

class StagingTests(unittest.TestCase):
    def setUp(self):
        self.original=b'(function(){/*WORKBOOK_FOCUS_BEGIN*/var original=1;/*WORKBOOK_FOCUS_END*/})();'
        self.expected=hashlib.sha256(self.original).hexdigest()
    def test_original_preserved(self):
        result=stage.build_player(self.original,'body.hzn-focus {color:#193447}',self.expected)
        self.assertTrue(result.startswith(self.original))
        self.assertEqual(result.count(stage.MARKER.encode()),1)
    def test_hash_mismatch_refused(self):
        with self.assertRaises(ValueError):stage.build_player(self.original,'a{}','0'*64)
    def test_missing_shell_refused(self):
        data=b'console.log("unrelated")'
        with self.assertRaises(ValueError):stage.build_player(data,'a{}',hashlib.sha256(data).hexdigest())
    def test_repeat_refused(self):
        first=stage.build_player(self.original,'a{}',self.expected)
        with self.assertRaises(ValueError):stage.build_player(first,'a{}',hashlib.sha256(first).hexdigest())
    def test_style_breakout_refused(self):
        with self.assertRaises(ValueError):stage.build_player(self.original,'</style><script>',self.expected)
    def test_public_destination_refused(self):
        with self.assertRaises(ValueError):stage.private_output(Path('/home/account/public_html/player.js'))
    def test_existing_output_refused(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'player.js';p.write_text('keep')
            with self.assertRaises(ValueError):stage.private_output(p)
            self.assertEqual(p.read_text(),'keep')
    def test_symlink_refused(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'alias.js';p.symlink_to(Path(d)/'missing')
            with self.assertRaises(ValueError):stage.private_output(p)

if __name__=='__main__':unittest.main()
