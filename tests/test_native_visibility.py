"""Regression checks for visibility and contrast on native-compatible markup.
No live-site changes, credentials, protected curriculum or network requests.
An opt-in test uses real localStorage on an intercepted loopback origin.
"""
import os
import unittest
import test_native_experiences as contract

FIXTURE=contract.FIXTURE

class NativeVisibilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        contract.BrowserTests.setUpClass.__func__(cls)
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop()
    def make(self):
        return contract.BrowserTests.make(self)

    def test_09_native_hidden_flags_win_over_layout(self):
        # The real focus shell toggles home.hidden. The old fixture incorrectly
        # supplied stronger CSS than the native shell and masked this regression.
        page=self.make()
        page.locator('head style').first.evaluate("s=>{s.textContent=s.textContent.replace('[hidden]{display:none!important}','').replace('body[data-focus-view=lesson] #hzn-home{display:none}','')}")
        page.evaluate("document.querySelector('#hzn-home').hidden=true")
        for width in [390,1366]:
            page.set_viewport_size({'width':width,'height':900})
            for mode in ['focus','adventure','discovery','sprout']:
                page.evaluate('m=>hznExperiences.choose(m)',mode)
                page.wait_for_timeout(40)
                self.assertFalse(page.locator('#hzn-home').is_visible(),(mode,width,'hidden home exposed'))
        page.evaluate("document.querySelector('#stages').hidden=true;hznExperiences.refresh()")
        for mode in ['focus','adventure','discovery','sprout']:
            page.evaluate('m=>hznExperiences.choose(m)',mode)
            page.wait_for_timeout(40)
            self.assertFalse(page.locator('#stages').is_visible(),(mode,'hidden stages exposed'))
        page.close()

    @unittest.skipUnless(os.environ.get('HZN_TEST_ORIGIN_STORAGE') == '1', 'Opt-in origin test; local runtime blocked origin navigation')
    def test_10_real_origin_preferences_survive_reload(self):
        # Real Chromium localStorage, but a synthetic reader on an intercepted
        # loopback URL. Does not claim authenticated/protected-reader testing.
        context=self.browser.new_context()
        page=context.new_page()
        origin='http://127.0.0.1:19877'
        page.route(origin+'/**',lambda route:route.fulfill(status=200,content_type='text/html',body=FIXTURE))
        def install():
            page.evaluate("window.fixtureOwner='demo:origin-A';window.hznFocusShell=Object.freeze({currentLearnerKey:()=>fixtureOwner})")
            page.add_script_tag(content=self.js)
            page.evaluate('a=>HZNInstallExperiences(window,document,a)',self.assets)
        page.goto(origin+'/reader');install()
        page.evaluate("localStorage.setItem('test.native.progress',JSON.stringify({heard:['baa-01'],ink:[[1,2]],favorite:true}));hznExperiences.choose('adventure');hznExperiences.setTone('dark')")
        expected=page.evaluate("localStorage.getItem('test.native.progress')")
        page.reload();install()
        self.assertEqual(page.evaluate('hznExperiences.snapshot().experience'),'adventure')
        self.assertEqual(page.evaluate('hznExperiences.snapshot().tone'),'dark')
        self.assertFalse(page.locator('#hzn-experience-dialog').is_visible())
        self.assertEqual(page.evaluate("localStorage.getItem('test.native.progress')"),expected)
        page.evaluate("fixtureOwner='demo:origin-B';hznExperiences.refresh()")
        page.wait_for_timeout(80)
        self.assertEqual(page.evaluate('hznExperiences.snapshot().experience'),'focus')
        page.evaluate("hznExperiences.choose('sprout');fixtureOwner='demo:origin-A';hznExperiences.refresh()")
        page.wait_for_timeout(80)
        self.assertEqual(page.evaluate('hznExperiences.snapshot().experience'),'adventure')
        self.assertEqual(page.evaluate("localStorage.getItem('test.native.progress')"),expected)
        context.close()

    def test_11_enabled_controls_have_clear_contrast(self):
        import re
        def lum(color):
            rgb=[int(v)/255 for v in re.findall(r'[0-9]+',color)[:3]]
            return sum(w*(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for w,v in zip([.2126,.7152,.0722],rgb))
        page=self.make()
        for mode in ['focus','adventure','discovery','sprout']:
            for tone in ['light','dark']:
                page.evaluate('x=>{hznExperiences.choose(x.mode);hznExperiences.setTone(x.tone)}',{'mode':mode,'tone':tone})
                for sel in ['#hzn-experience-button','#audio','#next','#stages button[aria-pressed=true]']:
                    row=page.locator(sel).evaluate('b=>{const s=getComputedStyle(b);return {fg:s.color,bg:s.backgroundColor,height:parseFloat(s.minHeight)}}')
                    a,b=sorted([lum(row['fg']),lum(row['bg'])])
                    self.assertGreaterEqual((b+.05)/(a+.05),4.5,(mode,tone,sel,row))
                    self.assertGreaterEqual(row['height'],44)
        page.close()


if __name__=='__main__':unittest.main(verbosity=2)
