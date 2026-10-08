"""Content and publication safeguards, independent of visual styling."""
from pathlib import Path
import importlib.util,json,re,subprocess,sys,unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('book_builder',ROOT/'scripts/build_enriched_reference.py')
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
def unpack(html):return json.loads(html.split('window.HZN_ENRICHED_DATA=',1)[1].split(';</script>',1)[0])
class ReferenceChecks(unittest.TestCase):
    def test_no_partial_translation_masquerades_as_complete(self):
        html,report=builder.assemble();data=unpack(html)
        self.assertEqual(len(report['target_languages']),32)
        self.assertEqual(set(data['ready_locales']),{p.stem for p in (ROOT/'src/theory-reference/enriched-locales').glob('*.json')})
        self.assertFalse(report['release_ready'])
        for lang,row in report['matrix'].items():
            self.assertFalse(row['independently_reviewed'])
            if lang not in data['ready_locales']:
                self.assertFalse(row['publication_ready']);self.assertGreater(len(row['missing']),0)
    def test_release_request_fails_without_creating_a_file(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            target=Path(d)/'book.html'
            result=subprocess.run([sys.executable,str(ROOT/'scripts/build_enriched_reference.py'),'--release','--output',str(target)],capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0)
            self.assertFalse(target.exists())
            self.assertIn('Release blocked',result.stderr)
    def test_demo_omits_locked_chapter_data(self):
        html,_=builder.assemble(demo=True);data=unpack(html)
        self.assertEqual([c['id'] for c in data['book']['chapters']],['foundations','profiles'])
        self.assertNotIn('فَتَحَتْ لَيْلَى النَّافِذَةَ',html)
        self.assertNotIn('قصة أصلية: النافذة والقلم',html)
        self.assertEqual({p['letter'] for p in data['letters']},{'ب','ظ','ض','ي','ذ'})
    def test_every_example_has_actual_localised_meaning(self):
        html,_=builder.assemble();data=unpack(html)
        for c in data['book']['chapters']:
            for lang in data['ready_locales']:
                self.assertTrue(c['exercise']['questions'][lang])
                self.assertTrue(c['exercise']['answers'][lang])
                for ex in c['examples']:self.assertTrue(ex['meanings'][lang])
        for letter in data['letters']:
            for lang in data['ready_locales']:
                self.assertTrue(letter['notes'][lang])
                for ex in letter['examples']:self.assertTrue(ex['meanings'][lang])
    def test_arabic_targets_preserved_across_translations(self):
        html,_=builder.assemble();data=unpack(html)
        self.assertEqual(''.join(x['letter'] for x in data['letters']),'ابتثجحخدذرزسشصضطظعغفقكلمنهوي')
        story=next(c for c in data['book']['chapters'] if c['id']=='stories')['sections'][0]['prose']
        self.assertEqual(story['ar'][0],story['en'][0]);self.assertEqual(story['ar'][0],story['tr'][0])
        pronouns=next(c for c in data['book']['chapters'] if c['id']=='pronouns')
        self.assertEqual(len(pronouns['examples']),12)
        playing=next(p for p in data['letters'] if p['letter']=='ع')['examples'][1]
        self.assertEqual(playing['ar'],'لَعِبَ');self.assertEqual(playing['meanings']['en'],'he played')
if __name__=='__main__':unittest.main()
