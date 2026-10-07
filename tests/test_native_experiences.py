"""Local UI CONTRACT tests; this is NOT an authenticated workbook test.

Uses a synthetic native-reader DOM matching the fetched focus shell selectors,
synthetic shadow readers, and memory-backed storage for persistence unit tests.
No curriculum, glyph outlines, recordings or protected production content.
"""
from pathlib import Path
import importlib.util
import json
import tempfile
import unittest
import os
import shutil

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('stage',ROOT/'scripts/stage_workbook_experiences.py')
stage=importlib.util.module_from_spec(spec);spec.loader.exec_module(stage)
FIXTURE='''<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;color:#163047;line-height:1.6}
button,select{font:inherit;cursor:pointer}button{min-height:44px;padding:8px;border:1px solid #ccc;border-radius:12px;background:white}
[hidden]{display:none!important}.topbar{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;padding:10px;gap:10px}.brand{font-weight:bold}.brand small{display:block}.hzn-top-controls{display:flex;flex-wrap:wrap;gap:5px}main{max-width:1200px;padding:16px;margin:auto;min-width:0}.course-nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.course-nav button{text-align:start;display:flex;flex-direction:column}#hzn-home{padding:10px 0}.hzn-home-welcome{padding:28px;border:1px solid #ddd;border-radius:22px;margin-bottom:18px}#hzn-home h1{font-size:30px}.lesson-heading{display:flex;justify-content:space-between;gap:10px;margin:10px 0}#stages{display:flex;gap:6px;flex-wrap:wrap}#stages button{flex:1 1 100px}#activity{border:1px solid #ddd;padding:16px;margin-top:12px;border-radius:20px;min-width:0}.lesson-footer{display:flex;justify-content:space-between;align-items:center;margin-top:10px}.letter{text-align:center;font-size:64px;line-height:1.8}canvas{display:block;width:100%;max-width:600px;height:170px;border:1px solid #888;margin:auto}#native-lesson-text{text-align:center;font-size:26px}#fixture-shadow{display:block}.author-credit{font-size:12px}body[data-focus-view=home] .lesson-heading,body[data-focus-view=home] #activity-navigation,body[data-focus-view=home] #activity,body[data-focus-view=home] .lesson-footer{display:none}body[data-focus-view=lesson] #hzn-home{display:none}dialog:not([open]){display:none}
</style></head><body class="hzn-focus" data-focus-view="lesson"><header class="topbar"><span class="brand">HORIZONS<small>UI CONTRACT TEST</small></span><nav class="hzn-top-controls"><button id="hzn-lessons-button">الدروس</button><button id="settings-button">الإعدادات</button><select id="locale" aria-label="لغة الواجهة"><option value="ar">العربية</option></select></nav></header><main>
<section id="hzn-home"><div class="hzn-home-welcome"><h1 id="hzn-home-title">الكراسة العربية</h1><p id="hzn-home-hint">نموذج اختبار برمجي، وليس محتوى الكراسة.</p><button id="hzn-resume" class="hzn-resume">تابع التعلّم</button></div><div id="hzn-home-nav"><nav id="course-nav" class="course-nav">
<button data-course="alphabet" aria-pressed="true">الحروف العربية</button><button data-course="phonics">التأسيس الصوتي</button><button data-course="blending2">الدمج الثنائي</button><button data-course="blending3">الدمج الثلاثي</button><button data-course="blending4">الدمج الرباعي</button><button data-course="catalog" disabled>دروس الحروف — قفل اختباري</button></nav></div></section>
<section class="lesson-heading"><h1 id="lesson-title">فحص القارئ الأصلي</h1><button id="favorite" aria-pressed="false">المفضلة</button></section>
<div id="activity-navigation"><nav id="stages"><button aria-pressed="true" data-stage="0">التعرّف</button><button data-stage="1">الكتابة</button><button data-stage="2">اختيار</button></nav></div>
<section id="activity"><p id="native-lesson-text" lang="ar" dir="rtl">بَ بُ بِ</p><canvas id="native-canvas" width="500" height="170"></canvas><button class="sound" id="audio">صوت الاختبار</button><div id="fixture-shadow"></div></section>
<footer class="lesson-footer"><button id="previous" class="secondary">السابق</button><span id="page-label">١ / ٣</span><button id="next" class="primary">التالي</button></footer><p class="author-credit">Synthetic UI contract fixture; not a product preview.</p></main><dialog id="settings"><button id="close-settings">إغلاق</button></dialog></body></html>'''
SHADOW='''<style>:host{--ink:#163047;--fatha:#cc503c;display:block}*{box-sizing:border-box}.reader{background:white;border:1px solid #ddd;border-radius:16px;margin-top:12px}.modes{display:flex;gap:6px;padding:8px}.modes button{flex:1;min-width:0}button{min-height:44px;border:1px solid #ccc;border-radius:10px;padding:8px;font:inherit}.target-visual{padding:10px}.target-glyph{width:160px;height:50px}.pager{display:flex;justify-content:space-between;padding:8px}.correct{background:rgb(215,241,223)}.wrong{background:rgb(254,231,224)}</style><div class="b4"><div class="reader"><div class="modes"><button>قراءة</button><button>فهم</button><button>اختبار</button><button>مراجعة</button></div><div id="reader-inner"><div class="target-visual"><svg class="target-glyph" viewBox="0 0 160 50"><path id="glyph" d="M10 10h140v20H10z" fill="var(--fatha)"/></svg></div><div class="semantic">بطاقة اختبار للمكوّن</div><div class="meaning-options"><button class="correct">صحيح</button><button class="wrong">خطأ</button></div><button id="native-shadow-click">اختيار</button></div><footer class="pager"><button>السابق</button><button>التالي</button></footer></div></div>'''

class BuilderTests(unittest.TestCase):
    original=b'// synthetic contract input\n/*WORKBOOK_FOCUS_BEGIN*/\nglobalThis.hznFocusShell=Object.freeze({});\n/*WORKBOOK_FOCUS_END*/\n'
    def test_exact_prefix(self):
        result,report=stage.build(self.original,stage.digest(self.original))
        self.assertTrue(result.startswith(self.original));self.assertTrue(report['original_bytes_preserved'])
        self.assertEqual(len(report['languages']),32)
    def test_reject_hash(self):
        with self.assertRaises(ValueError):stage.build(self.original,'0'*64)
    def test_reject_duplicate(self):
        built,_=stage.build(self.original,stage.digest(self.original))
        with self.assertRaises(ValueError):stage.build(built,stage.digest(built))
    def test_reject_phase1_staged_player(self):
        raw=self.original+b'/*HZN_COMFORT_UI_BEGIN*/'
        with self.assertRaises(ValueError):stage.build(raw,stage.digest(raw))
    def test_reject_missing_shell(self):
        with self.assertRaises(ValueError):stage.build(b'abc',stage.digest(b'abc'))
    def test_reject_missing_api(self):
        raw=self.original.replace(b'globalThis.hznFocusShell=Object.freeze',b'other')
        with self.assertRaises(ValueError):stage.build(raw,stage.digest(raw))
    def test_locales_complete(self):
        data,_=stage.assets();self.assertEqual(len(data['locales']),32)
        for row in data['locales'].values():self.assertEqual(len(row),27)
    def test_output_overwrite_refused(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'player.js';p.write_bytes(b'old')
            with self.assertRaises(ValueError):stage.validate_output(p)
    def test_output_public_refused(self):
        with self.assertRaises(ValueError):stage.validate_output(Path('/mnt/data/public_html/player.js'))
    def test_output_symlink_refused(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'link';p.symlink_to(Path(d)/'gone')
            with self.assertRaises(ValueError):stage.validate_output(p)

class BrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from playwright.sync_api import sync_playwright
        (ROOT/'artifacts').mkdir(exist_ok=True)
        executable=os.environ.get('HZN_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome')
        cls.pw=sync_playwright().start();cls.browser=cls.pw.chromium.launch(**({'executable_path':executable} if executable else {}),headless=True,args=['--no-sandbox'])
        cls.assets,_=stage.assets();cls.js=(stage.SOURCE/'native-experiences.js').read_text()
        cls.results={'kind':'synthetic-native-contract','engine':cls.browser.version,'network_navigation':False,'physical_devices':False,'production_reader':False,'cases':[]}
    @classmethod
    def tearDownClass(cls):
        (ROOT/'artifacts/native-contract-results.json').write_text(json.dumps(cls.results,ensure_ascii=False,indent=2)+'\n')
        cls.browser.close();cls.pw.stop()
    def make(self,storage=True,native=True):
        page=self.browser.new_page(viewport={'width':1366,'height':900});page.set_content(FIXTURE)
        page.evaluate('''arg=>{
          window.fixtureOwner='full:test-A';window.calls={next:0,stage:0,audio:0,shadow:0};window.storageWrites=[];window.testStorage=new Map();
          if(arg.storage)Object.defineProperty(window,'localStorage',{value:{getItem:k=>testStorage.get(k)??null,setItem:(k,v)=>{testStorage.set(k,v);storageWrites.push(k)},removeItem:k=>testStorage.delete(k)}});
          if(arg.native)window.hznFocusShell=Object.freeze({currentLearnerKey:()=>fixtureOwner});
          document.querySelector('#next').onclick=()=>calls.next++;
          document.querySelector('#stages').onclick=()=>calls.stage++;
          document.querySelector('#audio').onclick=()=>calls.audio++;
          const c=document.querySelector('canvas');const ctx=c.getContext('2d');ctx.fillStyle='#176c67';ctx.fillRect(20,30,95,25);window.originalCanvas=c;window.canvasBefore=c.toDataURL();
          window.originalActivity=document.querySelector('#activity');window.originalStages=document.querySelector('#stages');
          window.originalText=document.querySelector('#native-lesson-text').outerHTML;
          document.querySelector('#locale').innerHTML=arg.langs.map(l=>`<option value="${l}">${l}</option>`).join('');document.querySelector('#locale').value='ar';
        }''',{'storage':storage,'native':native,'langs':list(self.assets['locales'])})
        page.add_script_tag(content=self.js);page.evaluate('a=>HZNInstallExperiences(window,document,a)',self.assets)
        if native:page.evaluate("hznExperiences.choose('focus')")
        page.wait_for_timeout(80);return page
    def test_01_switch_preserves_native_nodes_and_events(self):
        page=self.make()
        for mode in ['sprout','adventure','discovery','focus']:
            page.evaluate('m=>hznExperiences.choose(m)',mode);page.wait_for_timeout(50)
            self.assertTrue(page.evaluate("originalCanvas===document.querySelector('canvas')&&originalActivity===document.querySelector('#activity')&&originalStages===document.querySelector('#stages')&&originalText===document.querySelector('#native-lesson-text').outerHTML&&canvasBefore===originalCanvas.toDataURL()"))
            page.click('#next');page.click('#audio');page.locator('#stages button').first.evaluate('b=>b.click()')
            self.assertTrue(page.locator('#course-nav button').last.is_disabled())
        self.assertEqual(page.evaluate('calls'),{'next':4,'audio':4,'stage':4,'shadow':0})
        self.assertTrue(page.evaluate("storageWrites.every(k=>k.startsWith('horizons.experiences.v1:'))"));page.close()
    def test_02_profile_isolation_and_mocked_restore(self):
        page=self.make();page.evaluate("hznExperiences.choose('adventure');hznExperiences.setTone('dark')")
        page.evaluate("fixtureOwner='full:test-B';hznExperiences.refresh()")
        page.wait_for_timeout(100);self.assertEqual(page.evaluate('hznExperiences.snapshot().experience'),'focus')
        page.evaluate("hznExperiences.choose('sprout');fixtureOwner='full:test-A';hznExperiences.refresh()")
        page.wait_for_timeout(100);self.assertEqual(page.evaluate('hznExperiences.snapshot().experience'),'adventure')
        self.assertEqual(page.evaluate('hznExperiences.snapshot().tone'),'dark')
        page.evaluate('hznExperiences.destroy()');page.evaluate('a=>HZNInstallExperiences(window,document,a)',self.assets)
        self.assertEqual(page.evaluate('hznExperiences.snapshot().experience'),'adventure');page.close()
    def test_03_unavailable_storage(self):
        page=self.make(storage=False);self.assertFalse(page.evaluate('hznExperiences.snapshot().persistent'))
        page.evaluate("hznExperiences.choose('sprout')");self.assertEqual(page.evaluate('hznExperiences.snapshot().experience'),'sprout');page.close()
    def test_04_fail_open_on_missing_native_shell(self):
        page=self.make(native=False);self.assertFalse(page.evaluate('hznExperiences.snapshot().mounted'))
        self.assertEqual(page.locator('[data-hzn-experiences-ready]').count(),0);page.click('#next')
        self.assertEqual(page.evaluate('calls.next'),1);page.close()
    def test_05_all_locales_and_keyboard(self):
        page=self.make()
        for lang,row in self.assets['locales'].items():
            page.select_option('#locale',lang);page.wait_for_timeout(40);page.evaluate('hznExperiences.openChooser()')
            self.assertEqual(page.locator('#hzn-exp-title').inner_text(),row['choose'])
            self.assertEqual(page.locator('#hzn-experience-dialog').get_attribute('dir'),'rtl' if lang in ['ar','he','fa','ur'] else 'ltr')
            self.assertEqual(page.locator('[data-experience]').count(),4)
            self.assertEqual(page.locator('#hzn-exp-future li').count(),7)
            page.keyboard.press('Escape');page.wait_for_timeout(20)
        page.locator('#next').focus();page.evaluate('hznExperiences.openChooser()');page.keyboard.press('Escape');page.wait_for_timeout(50)
        self.assertEqual(page.evaluate('document.activeElement.id'),'next');page.close()
    def test_06_shadow_late_mount_rebuild_and_feedback(self):
        page=self.make();page.evaluate('(s)=>{const r=document.querySelector("#fixture-shadow").attachShadow({mode:"open"});r.innerHTML=s;r.querySelector("#native-shadow-click").onclick=()=>calls.shadow++;window.glyph=r.querySelector("#glyph");window.glyphFill=getComputedStyle(glyph).fill;}',SHADOW)
        page.evaluate('hznExperiences.refresh()');page.wait_for_timeout(80)
        for mode in ['sprout','adventure','discovery','focus']:
            page.evaluate('m=>hznExperiences.choose(m)',mode)
            page.locator('#fixture-shadow').locator('#native-shadow-click').click()
            self.assertEqual(page.evaluate('hznExperiences.snapshot().shadowReaders'),1)
            self.assertTrue(page.evaluate('getComputedStyle(glyph).fill===glyphFill'))
            self.assertEqual(page.locator('#fixture-shadow').locator('.correct').evaluate('b=>getComputedStyle(b).backgroundColor'),'rgb(215, 241, 223)')
        page.evaluate("document.querySelector('#fixture-shadow').shadowRoot.querySelector('style[data-hzn-experience-style]').remove()")
        page.wait_for_timeout(100);self.assertEqual(page.locator('#fixture-shadow').locator('style[data-hzn-experience-style]').count(),1)
        page.evaluate('hznExperiences.destroy()');self.assertEqual(page.locator('#fixture-shadow').locator('style[data-hzn-experience-style]').count(),0)
        self.assertTrue(page.evaluate("document.querySelector('#stages').parentElement.id==='activity-navigation'"));page.close()
    def test_07_layout_matrix(self):
        page=self.make();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        for width in [320,390,768,1366]:
            page.set_viewport_size({'width':width,'height':900})
            for mode in ['sprout','adventure','discovery','focus']:
                for tone in ['light','dark']:
                    page.evaluate('x=>{hznExperiences.choose(x.mode);hznExperiences.setTone(x.tone)}',{'mode':mode,'tone':tone})
                    for view in ['home','lesson']:
                        page.evaluate('v=>document.body.dataset.focusView=v',view);page.wait_for_timeout(35)
                        overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
                        self.results['cases'].append({'width':width,'mode':mode,'tone':tone,'view':view,'overflow':overflow})
                        self.assertFalse(overflow,(width,mode,tone,view))
                    page.evaluate('hznExperiences.openChooser()');page.wait_for_timeout(25)
                    self.assertFalse(page.locator('#hzn-experience-dialog').evaluate('d=>d.scrollWidth>d.clientWidth+1'))
                    page.keyboard.press('Escape');page.wait_for_timeout(15)
        self.assertEqual(errors,[]);page.close()
    def test_08_idle_does_not_rewrite_dom(self):
        page=self.make();page.evaluate("window.mutations=0;window.mObs=new MutationObserver(rows=>mutations+=rows.length);mObs.observe(document.body,{childList:true,subtree:true,attributes:true});")
        page.wait_for_timeout(1800);self.assertEqual(page.evaluate('mutations'),0);page.close()

if __name__=='__main__':unittest.main(verbosity=2)
