/*WORKBOOK_FOCUS_BEGIN*/
/* Shared presentation layer, installed inside the existing workbook closure.
 * Curriculum state and assessment handlers remain owned by the original reader.
 * Only a small, learner-scoped location bookmark is stored by this layer. */
(function installFocusShell(){
 'use strict';
 const COPY={"en":{"homeTitle":"Your Arabic learning journey","homeHint":"Choose a lesson or continue where you left off.","start":"Start learning","resume":"Continue learning","lessons":"Lessons","settings":"Settings","account":"Account","close":"Close","backToLessons":"Back to lessons","letterIndex":"Letter index","activityOptions":"Activity options"},"ar":{"homeTitle":"رحلتك مع اللغة العربية","homeHint":"اختر درسًا أو تابع من حيث توقفت.","start":"ابدأ التعلّم","resume":"تابع التعلّم","lessons":"الدروس","settings":"الإعدادات","account":"الحساب","close":"إغلاق","backToLessons":"العودة إلى الدروس","letterIndex":"فهرس الحروف","activityOptions":"خيارات النشاط"},"tr":{"homeTitle":"Arapça öğrenme yolculuğunuz","homeHint":"Bir ders seçin veya kaldığınız yerden devam edin.","start":"Öğrenmeye başla","resume":"Öğrenmeye devam et","lessons":"Dersler","settings":"Ayarlar","account":"Hesap","close":"Kapat","backToLessons":"Derslere dön","letterIndex":"Harf dizini","activityOptions":"Etkinlik seçenekleri"},"fr":{"homeTitle":"Votre parcours d’apprentissage de l’arabe","homeHint":"Choisissez une leçon ou reprenez là où vous en étiez.","start":"Commencer à apprendre","resume":"Continuer à apprendre","lessons":"Leçons","settings":"Paramètres","account":"Compte","close":"Fermer","backToLessons":"Retour aux leçons","letterIndex":"Index des lettres","activityOptions":"Options de l’activité"},"es":{"homeTitle":"Tu camino para aprender árabe","homeHint":"Elige una lección o continúa donde lo dejaste.","start":"Empezar a aprender","resume":"Seguir aprendiendo","lessons":"Lecciones","settings":"Ajustes","account":"Cuenta","close":"Cerrar","backToLessons":"Volver a las lecciones","letterIndex":"Índice de letras","activityOptions":"Opciones de la actividad"},"de":{"homeTitle":"Dein Weg zum Arabischlernen","homeHint":"Wähle eine Lektion oder mache dort weiter, wo du aufgehört hast.","start":"Lernen starten","resume":"Weiterlernen","lessons":"Lektionen","settings":"Einstellungen","account":"Konto","close":"Schließen","backToLessons":"Zurück zu den Lektionen","letterIndex":"Buchstabenverzeichnis","activityOptions":"Übungsoptionen"},"it":{"homeTitle":"Il tuo percorso per imparare l’arabo","homeHint":"Scegli una lezione o riprendi da dove hai lasciato.","start":"Inizia a imparare","resume":"Continua a imparare","lessons":"Lezioni","settings":"Impostazioni","account":"Account","close":"Chiudi","backToLessons":"Torna alle lezioni","letterIndex":"Indice delle lettere","activityOptions":"Opzioni dell’attività"},"pt":{"homeTitle":"Sua jornada de aprendizagem do árabe","homeHint":"Escolha uma lição ou continue de onde parou.","start":"Começar a aprender","resume":"Continuar aprendendo","lessons":"Lições","settings":"Configurações","account":"Conta","close":"Fechar","backToLessons":"Voltar às lições","letterIndex":"Índice de letras","activityOptions":"Opções da atividade"},"nl":{"homeTitle":"Jouw leerreis in het Arabisch","homeHint":"Kies een les of ga verder waar je gebleven was.","start":"Begin met leren","resume":"Verder leren","lessons":"Lessen","settings":"Instellingen","account":"Account","close":"Sluiten","backToLessons":"Terug naar de lessen","letterIndex":"Letteroverzicht","activityOptions":"Activiteitsopties"},"ru":{"homeTitle":"Ваш путь к изучению арабского","homeHint":"Выберите урок или продолжите с того места, где остановились.","start":"Начать обучение","resume":"Продолжить обучение","lessons":"Уроки","settings":"Настройки","account":"Аккаунт","close":"Закрыть","backToLessons":"Вернуться к урокам","letterIndex":"Список букв","activityOptions":"Параметры задания"},"uk":{"homeTitle":"Ваш шлях до вивчення арабської","homeHint":"Виберіть урок або продовжте з того місця, де зупинилися.","start":"Почати навчання","resume":"Продовжити навчання","lessons":"Уроки","settings":"Налаштування","account":"Обліковий запис","close":"Закрити","backToLessons":"Повернутися до уроків","letterIndex":"Перелік літер","activityOptions":"Параметри завдання"},"pl":{"homeTitle":"Twoja podróż z językiem arabskim","homeHint":"Wybierz lekcję lub kontynuuj od miejsca, w którym przerwano naukę.","start":"Rozpocznij naukę","resume":"Kontynuuj naukę","lessons":"Lekcje","settings":"Ustawienia","account":"Konto","close":"Zamknij","backToLessons":"Wróć do lekcji","letterIndex":"Spis liter","activityOptions":"Opcje ćwiczenia"},"cs":{"homeTitle":"Vaše cesta za arabštinou","homeHint":"Vyberte si lekci nebo pokračujte tam, kde jste skončili.","start":"Začít se učit","resume":"Pokračovat v učení","lessons":"Lekce","settings":"Nastavení","account":"Účet","close":"Zavřít","backToLessons":"Zpět na lekce","letterIndex":"Přehled písmen","activityOptions":"Možnosti cvičení"},"ro":{"homeTitle":"Călătoria ta în învățarea limbii arabe","homeHint":"Alege o lecție sau continuă de unde ai rămas.","start":"Începe să înveți","resume":"Continuă să înveți","lessons":"Lecții","settings":"Setări","account":"Cont","close":"Închide","backToLessons":"Înapoi la lecții","letterIndex":"Lista literelor","activityOptions":"Opțiunile activității"},"hu":{"homeTitle":"Az arab nyelvtanulás útján","homeHint":"Válassz egy leckét, vagy folytasd ott, ahol abbahagytad.","start":"Tanulás indítása","resume":"Tanulás folytatása","lessons":"Leckék","settings":"Beállítások","account":"Fiók","close":"Bezárás","backToLessons":"Vissza a leckékhez","letterIndex":"Betűk jegyzéke","activityOptions":"Feladatbeállítások"},"el":{"homeTitle":"Το ταξίδι σας στην εκμάθηση των αραβικών","homeHint":"Επιλέξτε ένα μάθημα ή συνεχίστε από εκεί που σταματήσατε.","start":"Ξεκινήστε τη μάθηση","resume":"Συνεχίστε τη μάθηση","lessons":"Μαθήματα","settings":"Ρυθμίσεις","account":"Λογαριασμός","close":"Κλείσιμο","backToLessons":"Επιστροφή στα μαθήματα","letterIndex":"Ευρετήριο γραμμάτων","activityOptions":"Επιλογές δραστηριότητας"},"sv":{"homeTitle":"Din resa mot att lära dig arabiska","homeHint":"Välj en lektion eller fortsätt där du slutade.","start":"Börja lära dig","resume":"Fortsätt lära dig","lessons":"Lektioner","settings":"Inställningar","account":"Konto","close":"Stäng","backToLessons":"Tillbaka till lektionerna","letterIndex":"Bokstavsöversikt","activityOptions":"Aktivitetsalternativ"},"da":{"homeTitle":"Din rejse mod at lære arabisk","homeHint":"Vælg en lektion, eller fortsæt, hvor du slap.","start":"Begynd at lære","resume":"Fortsæt med at lære","lessons":"Lektioner","settings":"Indstillinger","account":"Konto","close":"Luk","backToLessons":"Tilbage til lektionerne","letterIndex":"Bogstavoversigt","activityOptions":"Aktivitetsindstillinger"},"no":{"homeTitle":"Din reise mot å lære arabisk","homeHint":"Velg en leksjon eller fortsett der du slapp.","start":"Begynn å lære","resume":"Fortsett å lære","lessons":"Leksjoner","settings":"Innstillinger","account":"Konto","close":"Lukk","backToLessons":"Tilbake til leksjonene","letterIndex":"Bokstavoversikt","activityOptions":"Aktivitetsvalg"},"fi":{"homeTitle":"Matkasi arabian kielen oppimiseen","homeHint":"Valitse oppitunti tai jatka siitä, mihin jäit.","start":"Aloita oppiminen","resume":"Jatka oppimista","lessons":"Oppitunnit","settings":"Asetukset","account":"Tili","close":"Sulje","backToLessons":"Takaisin oppitunteihin","letterIndex":"Kirjainluettelo","activityOptions":"Tehtävän asetukset"},"bg":{"homeTitle":"Вашият път към изучаването на арабски","homeHint":"Изберете урок или продължете оттам, докъдето сте стигнали.","start":"Започнете да учите","resume":"Продължете да учите","lessons":"Уроци","settings":"Настройки","account":"Акаунт","close":"Затвори","backToLessons":"Обратно към уроците","letterIndex":"Списък с буквите","activityOptions":"Опции на упражнението"},"sr":{"homeTitle":"Vaše putovanje kroz učenje arapskog","homeHint":"Izaberite lekciju ili nastavite tamo gde ste stali.","start":"Počni da učiš","resume":"Nastavi da učiš","lessons":"Lekcije","settings":"Podešavanja","account":"Nalog","close":"Zatvori","backToLessons":"Nazad na lekcije","letterIndex":"Spisak slova","activityOptions":"Opcije aktivnosti"},"hr":{"homeTitle":"Vaše putovanje kroz učenje arapskog","homeHint":"Odaberite lekciju ili nastavite tamo gdje ste stali.","start":"Počni učiti","resume":"Nastavi učiti","lessons":"Lekcije","settings":"Postavke","account":"Račun","close":"Zatvori","backToLessons":"Natrag na lekcije","letterIndex":"Popis slova","activityOptions":"Opcije aktivnosti"},"he":{"homeTitle":"המסע שלכם ללימוד ערבית","homeHint":"בחרו שיעור או המשיכו מהמקום שבו הפסקתם.","start":"התחילו ללמוד","resume":"המשיכו ללמוד","lessons":"שיעורים","settings":"הגדרות","account":"חשבון","close":"סגירה","backToLessons":"חזרה לשיעורים","letterIndex":"רשימת האותיות","activityOptions":"אפשרויות הפעילות"},"fa":{"homeTitle":"مسیر شما در یادگیری زبان عربی","homeHint":"یک درس انتخاب کنید یا از همان‌جا که متوقف شدید ادامه دهید.","start":"شروع یادگیری","resume":"ادامهٔ یادگیری","lessons":"درس‌ها","settings":"تنظیمات","account":"حساب کاربری","close":"بستن","backToLessons":"بازگشت به درس‌ها","letterIndex":"فهرست حروف","activityOptions":"گزینه‌های فعالیت"},"ur":{"homeTitle":"عربی سیکھنے کا آپ کا سفر","homeHint":"کوئی سبق منتخب کریں یا جہاں سے چھوڑا تھا وہیں سے جاری رکھیں۔","start":"سیکھنا شروع کریں","resume":"سیکھنا جاری رکھیں","lessons":"اسباق","settings":"ترتیبات","account":"اکاؤنٹ","close":"بند کریں","backToLessons":"اسباق پر واپس جائیں","letterIndex":"حروف کی فہرست","activityOptions":"سرگرمی کے اختیارات"},"hi":{"homeTitle":"अरबी सीखने की आपकी यात्रा","homeHint":"कोई पाठ चुनें या जहाँ छोड़ा था वहीं से जारी रखें।","start":"सीखना शुरू करें","resume":"सीखना जारी रखें","lessons":"पाठ","settings":"सेटिंग्स","account":"खाता","close":"बंद करें","backToLessons":"पाठों पर वापस जाएँ","letterIndex":"अक्षर सूची","activityOptions":"गतिविधि के विकल्प"},"bn":{"homeTitle":"আপনার আরবি শেখার যাত্রা","homeHint":"একটি পাঠ বেছে নিন অথবা যেখানে থেমেছিলেন সেখান থেকে চালিয়ে যান।","start":"শেখা শুরু করুন","resume":"শেখা চালিয়ে যান","lessons":"পাঠ","settings":"সেটিংস","account":"অ্যাকাউন্ট","close":"বন্ধ করুন","backToLessons":"পাঠে ফিরে যান","letterIndex":"বর্ণের তালিকা","activityOptions":"কার্যক্রমের বিকল্প"},"id":{"homeTitle":"Perjalanan Anda belajar bahasa Arab","homeHint":"Pilih pelajaran atau lanjutkan dari bagian terakhir.","start":"Mulai belajar","resume":"Lanjutkan belajar","lessons":"Pelajaran","settings":"Pengaturan","account":"Akun","close":"Tutup","backToLessons":"Kembali ke pelajaran","letterIndex":"Daftar huruf","activityOptions":"Pilihan aktivitas"},"ms":{"homeTitle":"Perjalanan anda mempelajari bahasa Arab","homeHint":"Pilih pelajaran atau sambung dari tempat terakhir anda berhenti.","start":"Mula belajar","resume":"Teruskan belajar","lessons":"Pelajaran","settings":"Tetapan","account":"Akaun","close":"Tutup","backToLessons":"Kembali ke pelajaran","letterIndex":"Senarai huruf","activityOptions":"Pilihan aktiviti"},"zh":{"homeTitle":"你的阿拉伯语学习之旅","homeHint":"选择一节课，或从上次停下的地方继续学习。","start":"开始学习","resume":"继续学习","lessons":"课程","settings":"设置","account":"账户","close":"关闭","backToLessons":"返回课程","letterIndex":"字母目录","activityOptions":"学习活动选项"},"ja":{"homeTitle":"あなたのアラビア語学習の旅","homeHint":"レッスンを選ぶか、前回の続きから学習しましょう。","start":"学習を始める","resume":"学習を続ける","lessons":"レッスン","settings":"設定","account":"アカウント","close":"閉じる","backToLessons":"レッスンに戻る","letterIndex":"文字の一覧","activityOptions":"学習活動のオプション"}};
 const CSS="/* Shared focus shell. Educational text keeps the reader's five-font variables. */\n@media screen {\n body.hzn-focus{--hzn-paper:#fffdf8;--hzn-navy:#12384e;--hzn-teal:#087b73;--hzn-line:#d6e1dd;background:#f4f1e8;color:var(--hzn-navy);font-size:16px;min-width:0;margin:0;line-height:1.55}\n body.hzn-focus *,body.hzn-focus *::before,body.hzn-focus *::after{box-sizing:border-box}\n body.hzn-focus button,body.hzn-focus select,body.hzn-focus summary{touch-action:manipulation}\n body.hzn-focus button{min-height:44px}\n body.hzn-focus button:focus-visible,body.hzn-focus a:focus-visible,body.hzn-focus summary:focus-visible,body.hzn-focus select:focus-visible{outline:3px solid #17786e;outline-offset:3px}\n body.hzn-focus>.topbar{min-height:60px;height:auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:8px clamp(10px,2vw,28px);border-bottom:1px solid var(--hzn-line);background:var(--hzn-paper)}\n body.hzn-focus .topbar .brand{font-size:18px;min-width:0;gap:7px}\n body.hzn-focus .topbar .brand svg{width:34px;height:34px}\n body.hzn-focus .topbar .brand small{font-size:9px;letter-spacing:1px}\n body.hzn-focus .topbar .top-actions:empty{display:none}\n body.hzn-focus .hzn-top-controls{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:6px;min-width:0}\n body.hzn-focus .hzn-top-controls button{font:600 14px/1.3 system-ui,sans-serif;padding:8px 13px;border:1px solid var(--hzn-line);background:white;border-radius:12px;width:auto;color:var(--hzn-navy)}\n body.hzn-focus .hzn-top-controls #hzn-lessons-button{background:var(--hzn-navy);border-color:var(--hzn-navy);color:white}\n body.hzn-focus>main{max-width:1200px;padding:12px clamp(10px,2vw,24px) max(12px,env(safe-area-inset-bottom));margin:0 auto;min-width:0;width:100%}\n body.hzn-focus>#reader-controls{display:none}\n body.hzn-focus main>.author-credit{font-size:11px;margin:16px 0 0;color:#657b82;line-height:1.5}\n body.hzn-focus #demo-upgrade{margin:0 0 8px;padding:6px 12px;min-height:0;border-radius:12px;gap:8px;box-shadow:none;display:flex;align-items:center;justify-content:space-between}\n body.hzn-focus #demo-upgrade .demo-upgrade-copy{flex:1 1 auto;display:flex;align-items:center;gap:8px}\n body.hzn-focus #demo-upgrade .demo-upgrade-copy p{font-size:12px;margin:0;line-height:1.4}\n body.hzn-focus #demo-upgrade .demo-badge{font-size:11px;margin:0;padding:3px 6px;white-space:normal}\n body.hzn-focus #demo-upgrade .demo-upgrade-actions{flex:0 1 auto;margin:0;width:auto}\n body.hzn-focus #demo-upgrade .demo-buy-link{font-size:12px;min-height:36px;padding:6px 10px;display:inline-flex;gap:5px;align-items:center;width:auto}\n body.hzn-focus #hzn-home{padding:10px 0 18px}\n body.hzn-focus .hzn-home-welcome{padding:clamp(20px,3vw,32px);border:1px solid #dfdfcf;border-radius:24px;background:linear-gradient(120deg,#fffdf8,#e9f4ef);margin-bottom:20px}\n body.hzn-focus #hzn-home h1{font-size:clamp(24px,3vw,36px);line-height:1.4;margin:0 0 9px}\n body.hzn-focus #hzn-home-hint{max-width:65ch;margin:0 0 20px;color:#526c76;font-size:16px}\n body.hzn-focus .hzn-resume{display:flex;flex-direction:column;align-items:flex-start;gap:2px;max-width:100%;min-width:210px;background:var(--hzn-teal);padding:12px 22px;border-radius:14px;border:1px solid var(--hzn-teal);color:white;font-size:18px}\n body.hzn-focus .hzn-resume small{font-size:12px;font-weight:400}\n body.hzn-focus #course-nav.course-nav{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));width:100%;gap:10px;margin:0;padding:0}\n body.hzn-focus #course-nav.course-nav button{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;position:relative;min-height:96px;padding:14px 16px;border-radius:16px;background:var(--hzn-paper);color:var(--hzn-navy);border:1px solid var(--hzn-line);font-size:17px;line-height:1.5;min-width:0;white-space:normal;overflow-wrap:anywhere;text-align:start}\n body.hzn-focus #course-nav.course-nav button[aria-pressed=true]{background:#e2f1ed;border-color:#81b5a8}\n body.hzn-focus #course-nav.course-nav button>span:first-child:not(.demo-section-title){font-size:12px;color:#698078;line-height:1.3}\n body.hzn-focus #course-nav.course-nav .demo-section-title{font-size:17px;line-height:1.5;margin:0}\n body.hzn-focus #course-nav.course-nav small{font-size:11px;line-height:1.4;margin:3px 0 0;padding:0}\n body.hzn-focus .lesson-heading{position:relative;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px 14px;padding:0;margin:0 0 8px;min-height:0}\n body.hzn-focus .lesson-heading>div:first-of-type{flex:1 1 auto;min-width:0;width:auto}\n body.hzn-focus #lesson-title{font-size:22px;line-height:1.45;margin:0}\n body.hzn-focus #eyebrow,body.hzn-focus #lesson-subtitle{display:none}\n body.hzn-focus .hzn-back-lessons{font:600 13px/1.3 system-ui,sans-serif;padding:5px 9px;border-radius:10px;background:white;border:1px solid var(--hzn-line);color:var(--hzn-navy)}\n body.hzn-focus .lesson-heading .progress-box{min-width:110px;max-width:230px;width:auto;padding:0;margin:0;font-size:11px;line-height:1.4}\n body.hzn-focus .lesson-heading .progress-box .meter{height:5px;margin:3px 0}\n body.hzn-focus #saved-label{display:block;font-size:12px;line-height:1.7;margin:10px 0}\n body.hzn-focus #activity-navigation{display:block;margin:0;padding:0;min-width:0}\n body.hzn-focus #stages{display:flex;flex-wrap:wrap;gap:5px;padding:4px;margin:0 0 8px;background:#eaf1ee;border-radius:13px;min-width:0}\n body.hzn-focus #stages[hidden]{display:none}\n body.hzn-focus #stages button{flex:1 1 120px;min-width:0;min-height:44px;font-size:14px;line-height:1.4;padding:8px 12px;white-space:normal;overflow-wrap:anywhere}\n body.hzn-focus #activity{padding:14px;border:1px solid var(--hzn-line);border-radius:20px;box-shadow:0 6px 24px #12384e06;min-height:0;background:white;overflow:visible}\n body.hzn-focus .lesson-footer{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;margin:0;position:static;background:transparent}\n body.hzn-focus .lesson-footer[hidden]{display:none}\n body.hzn-focus .lesson-footer button{min-width:100px;padding:8px 15px;font-size:15px;min-height:44px}\n body.hzn-focus #page-label{font-size:12px;line-height:1.4;text-align:center}\n body.hzn-focus #preview-note{font-size:11px;line-height:1.4;margin:6px 0}\n body.hzn-focus[data-focus-view=home] .lesson-heading,body.hzn-focus[data-focus-view=home] #activity-navigation,body.hzn-focus[data-focus-view=home] #activity,body.hzn-focus[data-focus-view=home] .lesson-footer,body.hzn-focus[data-focus-view=home] #preview-note{display:none}\n body.hzn-focus[data-focus-view=lesson] #demo-upgrade .demo-upgrade-copy p{display:none}\n body.hzn-focus #hzn-utility-dock:empty{display:none}\n body.hzn-focus #hzn-utility-dock{display:flex;flex-wrap:wrap;gap:10px}\n body.hzn-focus #hzn-utility-dock #saved-label{flex-basis:100%}\n body.hzn-focus .hzn-focus-dialog,body.hzn-focus #settings{border:1px solid var(--hzn-line);border-radius:20px;max-width:min(640px,calc(100vw - 24px));width:640px;max-height:calc(100vh - 36px);max-height:calc(100dvh - 36px);padding:20px;background:var(--hzn-paper);color:var(--hzn-navy);overflow:auto}\n body.hzn-focus dialog::backdrop{background:#09253888;backdrop-filter:blur(3px)}\n body.hzn-focus .hzn-dialog-head,body.hzn-focus #settings .dialog-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 16px;position:static}\n body.hzn-focus .hzn-dialog-head h2,body.hzn-focus #settings-title{font-size:21px;margin:0}\n body.hzn-focus .hzn-dialog-close{font-size:14px;padding:8px 12px;min-width:70px}\n body.hzn-focus #hzn-lessons-dialog #course-nav.course-nav{grid-template-columns:1fr 1fr}\n body.hzn-focus #hzn-lessons-dialog #course-nav.course-nav button{min-height:96px}\n body.hzn-focus #hzn-language-dock{padding:0 0 14px;border-bottom:1px solid var(--hzn-line);margin:0 0 14px}\n body.hzn-focus #hzn-language-dock>.language{display:grid;gap:6px;font-size:14px;font-weight:650}\n body.hzn-focus #hzn-language-dock select{width:100%;min-height:44px;padding:7px 12px;font-size:16px}\n body.hzn-focus #hzn-language-dock .typography-toolbar{padding:14px 0 0;margin:0;display:flex;flex-wrap:wrap;gap:12px;background:transparent;box-shadow:none;border:0}\n body.hzn-focus #hzn-language-dock .reading-options{flex:1 1 250px;min-width:0}\n body.hzn-focus #hzn-language-dock .reading-options-panel{position:static;display:flex;flex-wrap:wrap;box-shadow:none;padding:8px 0;border:0;background:transparent;min-width:0;width:100%}\n body.hzn-focus #hzn-language-dock .typography-control{flex:1 1 170px;min-width:0}\n body.hzn-focus #hzn-language-dock .typography-size-controls{align-self:flex-end}\n body.hzn-focus #hzn-language-dock .typography-toolbar-title{font-size:14px}\n body.hzn-focus #hzn-account-controls .learner-toolbar{display:flex;flex-direction:column;align-items:stretch;gap:10px;border:0;box-shadow:none;background:transparent;padding:0;margin:0 0 15px}\n body.hzn-focus #hzn-account-controls select{min-height:44px;font-size:16px;max-width:100%}\n body.hzn-focus .hzn-account-details{padding:12px 0;border-bottom:1px solid var(--hzn-line)}\n body.hzn-focus .hzn-letter-index,body.hzn-focus .hzn-activity-help,body.hzn-focus .word-overview{padding:0;margin:10px 0 0;border-top:1px solid #e5ebe7;border-radius:0;background:transparent}\n body.hzn-focus .hzn-letter-index>summary,body.hzn-focus .hzn-activity-help>summary,body.hzn-focus .word-overview>summary{font:600 13px/1.45 system-ui,sans-serif;min-height:44px;cursor:pointer;padding:12px 4px;color:#446974}\n body.hzn-focus .hzn-activity-help .activity-header{margin:0;padding:10px 0;gap:10px;font-size:14px;flex-wrap:wrap}\n body.hzn-focus .hzn-activity-help .activity-header h2{font-size:18px}\n body.hzn-focus .alphabet-layout{display:block;min-width:0}\n body.hzn-focus .alphabet-layout .letter-focus{padding:8px;min-height:0;border:0;background:transparent}\n body.hzn-focus .alphabet-layout .letter-focus .letter-orbit{line-height:1.4;min-height:0;margin:0}\n body.hzn-focus .alphabet-layout .letter-focus h2{margin:0 0 7px;line-height:1.65}\n body.hzn-focus .alphabet-layout .letter-focus .mini-forms{margin:10px auto;max-width:700px;gap:8px}\n body.hzn-focus .mini-forms>div{padding:6px}\n body.hzn-focus .word-scene-layout{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);grid-template-areas:none;grid-template-rows:auto;gap:16px;align-items:center;margin:0}\n body.hzn-focus .illustration-panel{min-width:0;grid-area:auto;display:flex;flex-direction:column;align-items:center}\n body.hzn-focus .media-switch{grid-area:auto;display:flex;flex-wrap:wrap;gap:6px;margin:0 0 6px;justify-content:center}\n body.hzn-focus .media-switch button{font-size:12px;min-height:44px;padding:5px 9px;display:inline-flex;align-items:center;gap:5px}\n body.hzn-focus .media-switch img{width:26px;height:26px;object-fit:contain}\n body.hzn-focus .sentence-scene{grid-area:auto;width:100%;max-width:330px;aspect-ratio:1.5;background:transparent;min-height:0}\n body.hzn-focus .sentence-scene img{display:block;width:100%;height:100%;object-fit:contain;border-radius:14px}\n body.hzn-focus .vocab-panel{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);align-items:center;gap:6px 14px;grid-area:auto;min-width:0;padding:0}\n body.hzn-focus .word-reading{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px 12px;text-align:center}\n body.hzn-focus .vocab-word{margin:0;width:100%;max-width:100%;line-height:1.5;white-space:nowrap;overflow-wrap:normal;word-break:normal;overflow-x:auto;scrollbar-width:thin}\n body.hzn-focus .translation{font-size:15px;line-height:1.5;margin:4px 0}\n body.hzn-focus .vocab-panel>.word-reading>.translation{width:100%}\n body.hzn-focus .sound{min-height:44px;padding:8px 14px;font-size:14px}\n body.hzn-focus .sentence-block{padding:7px 0 7px 12px;margin:0;border:0;border-inline-start:1px solid var(--hzn-line);text-align:center}\n body.hzn-focus .sentence{margin:0 0 5px;line-height:1.8}\n body.hzn-focus .story-layout{align-items:start;gap:18px}\n body.hzn-focus .story-picture{max-width:400px;min-width:0}\n body.hzn-focus .story-picture img{width:100%;height:auto;object-fit:contain}\n body.hzn-focus .story-sentence{line-height:1.9}\n body.hzn-focus .writing-workspace{min-width:0}\n body.hzn-focus .trace-wrap{width:100%;max-width:760px;min-width:0}\n body.hzn-focus .trace-tools,body.hzn-focus .pen-demo-tools{gap:6px;flex-wrap:wrap}\n body.hzn-focus .trace-tools button,body.hzn-focus .pen-demo-tools button{font-size:14px;min-height:44px}\n @media(min-width:900px) and (max-height:720px){\n  body.hzn-focus>main{padding-top:8px}\n  body.hzn-focus #activity{padding:10px 14px}\n  body.hzn-focus .sentence-scene{max-width:260px}\n  body.hzn-focus .word-scene-layout{grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr)}\n  body.hzn-focus .alphabet-layout .letter-focus{display:grid;grid-template-columns:minmax(120px,.65fr) minmax(0,1fr);gap:3px 20px;align-items:center}\n  body.hzn-focus .alphabet-layout .letter-focus .letter-orbit{grid-row:1 / span 4}\n  body.hzn-focus .alphabet-layout .letter-focus .mini-forms{margin:3px 0}\n }\n @media(max-width:760px){\n  body.hzn-focus>main{padding-top:8px}\n  body.hzn-focus .lesson-heading{margin-bottom:6px}\n  body.hzn-focus #stages{margin-bottom:6px}\n  body.hzn-focus .word-overview{margin-top:4px}\n  body.hzn-focus .lesson-footer{padding-block:6px}\n  body.hzn-focus .topbar .brand{font-size:15px}\n  body.hzn-focus .topbar .brand small{display:none}\n  body.hzn-focus .hzn-top-controls{gap:4px}\n  body.hzn-focus .hzn-top-controls button{font-size:12px;padding:7px 9px}\n  body.hzn-focus #course-nav.course-nav{grid-template-columns:repeat(2,minmax(0,1fr))}\n  body.hzn-focus #course-nav.course-nav button{font-size:16px;min-height:96px;padding:12px}\n  body.hzn-focus #course-nav.course-nav .demo-section-title{font-size:16px}\n  body.hzn-focus .lesson-heading{display:flex;flex-wrap:nowrap;gap:5px 8px}\n  body.hzn-focus .lesson-heading>div:first-of-type{flex:1 1 80px;width:auto;min-width:0}\n  body.hzn-focus .hzn-back-lessons{flex:0 1 112px}\n  body.hzn-focus #lesson-title{font-size:19px}\n  body.hzn-focus .lesson-heading .progress-box{flex:0 0 100px;width:100px;min-width:0;max-width:100px;font-size:10px}\n  body.hzn-focus #stages button{flex-basis:calc(50% - 6px);padding:6px 9px;font-size:13px}\n  body.hzn-focus #activity{padding:10px;border-radius:16px}\n  body.hzn-focus .word-scene-layout{grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);grid-template-areas:\"picture word\" \"sentence sentence\" \"tags tags\";gap:7px 10px}\n  body.hzn-focus .word-scene-layout .illustration-panel{display:flex;grid-area:picture;flex-direction:column;gap:5px;width:100%}\n  body.hzn-focus .word-scene-layout .sentence-scene{grid-area:auto;height:112px;aspect-ratio:auto;max-width:none;order:-1}\n  body.hzn-focus .word-scene-layout .media-switch{grid-area:auto;display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:0}\n  body.hzn-focus .media-switch button{padding:4px;font-size:11px;width:100%;justify-content:center}\n  body.hzn-focus .media-switch img{display:none}\n  body.hzn-focus .vocab-word{line-height:1.55}\n  body.hzn-focus .word-reading{gap:2px 9px}\n  body.hzn-focus .word-scene-layout .vocab-panel{display:contents}\n  body.hzn-focus .word-scene-layout .word-reading{grid-area:word}\n  body.hzn-focus .word-scene-layout .sentence-block{grid-area:sentence;margin-top:3px;padding:7px 0 0;border:0;border-top:1px solid var(--hzn-line)}\n  body.hzn-focus .word-scene-layout .position-tags{grid-area:tags}\n  body.hzn-focus .word-scene-layout #meaning-toggle{grid-area:meaning}\n  body.hzn-focus .word-scene-layout:has(#meaning-toggle){grid-template-areas:\"picture word\" \"sentence sentence\" \"meaning meaning\" \"tags tags\"}\n  body.hzn-focus .lesson-footer button{min-width:80px;font-size:14px;padding:7px 12px}\n  body.hzn-focus .hzn-home-welcome{padding:22px 18px}\n  body.hzn-focus #hzn-home-hint{font-size:14px}\n  body.hzn-focus .hzn-resume{min-width:0;width:100%;font-size:17px}\n  body.hzn-focus .alphabet-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}\n  body.hzn-focus .story-layout{display:block}\n  body.hzn-focus .story-picture{max-width:290px;margin:auto}\n  body.hzn-focus .hzn-focus-dialog,body.hzn-focus #settings{padding:15px}\n }\n @media(max-width:390px){\n  body.hzn-focus>.topbar{gap:4px;padding:6px 8px}\n  body.hzn-focus .topbar .brand svg{width:25px;height:25px}\n  body.hzn-focus .topbar .brand{font-size:12px;gap:4px}\n  body.hzn-focus .hzn-top-controls button{font-size:11px;padding:7px 7px}\n  body.hzn-focus .lesson-heading{align-items:center}\n  body.hzn-focus #lesson-title{font-size:18px}\n  body.hzn-focus .lesson-heading .progress-box{max-width:105px}\n  body.hzn-focus .hzn-back-lessons{font-size:11px;padding:5px 7px}\n }\n @media(max-width:380px){\n  body.hzn-focus .word-scene-layout{grid-template-columns:minmax(0,1fr);grid-template-areas:\"word\" \"picture\" \"sentence\" \"tags\"}\n  body.hzn-focus .word-scene-layout:has(#meaning-toggle){grid-template-areas:\"word\" \"picture\" \"sentence\" \"meaning\" \"tags\"}\n  body.hzn-focus .word-scene-layout .illustration-panel{display:grid;grid-template-columns:minmax(0,1fr) minmax(80px,.6fr);align-items:center}\n  body.hzn-focus .word-scene-layout .media-switch{grid-template-columns:1fr}\n }\n @media(prefers-reduced-motion:reduce){body.hzn-focus *,body.hzn-focus *::before,body.hzn-focus *::after{scroll-behavior:auto;transition:none;animation:none}}\n}\n@media print{#hzn-home,.hzn-top-controls,.hzn-back-lessons,.hzn-focus-dialog{display:none}}\n";
 const q=selector=>document.querySelector(selector);
 const text=key=>COPY[locale]?.[key]??COPY.en[key];
 const sectionNames=['alphabet','phonics','blending2','blending3','blending4','catalog'];
 const componentNames=new Set(['phonics','blending2','blending3','blending4']);
 const memory=new Map();
 const components=new Map();
 let view='home',owner=null,installed=false,returnFocus=null,restoring=false,wordObserver;
 let home,homeNav,drawer,drawerNav,accountDialog,languageDock,utilityDock,toolbar,backButton;
 const original={render,nav,setLearner,learnerToolbar,openSettingsWithTypography,applyTypography};
 function learnerKey(){return (IS_DEMO?'demo:':'full:')+(learnerStorage.enabled?learnerStorage.current?.id||'pending':'local');}
 function storageKey(){return 'horizons.focus-location.v1:'+learnerKey();}
 function locationRecord(){
  const key=learnerKey();if(memory.has(key))return memory.get(key);
  let row=null;try{row=JSON.parse(localStorage.getItem(storageKey()));}catch{}
  if(!row||row.schema!==1||!sectionNames.includes(row.section)||typeof row.components!=='object')row={schema:1,section:null,components:{}};
  memory.set(key,row);return row;
 }
 function persistLocation(){try{localStorage.setItem(storageKey(),JSON.stringify(locationRecord()));}catch{/* Core progress saving remains authoritative. */}}
 function safeSnapshot(snapshot){
  const result={};
  for(const key of ['lesson','index','size'])if(Number.isFinite(snapshot?.[key])&&snapshot[key]>=0&&snapshot[key]<100000)result[key]=snapshot[key];
  for(const key of ['mode','font'])if(typeof snapshot?.[key]==='string'&&/^[a-zA-Z0-9_-]{1,40}$/.test(snapshot[key]))result[key]=snapshot[key];
  for(const key of ['practice','review'])if(typeof snapshot?.[key]==='boolean')result[key]=snapshot[key];
  return result;
 }
 function rememberComponent(section,snapshot){
  if(!componentNames.has(section)||!state||restoring)return;
  const row=locationRecord();row.components[section]=safeSnapshot(snapshot);
  if(view==='lesson')row.section=section;
  persistLocation();
 }
 function restoreComponent(section){const value=locationRecord().components[section];return value?{...value}:null;}
 function currentSection(){
  const selected=q('#course-nav button[aria-pressed="true"]');
  const value=selected?.dataset.demoSection||selected?.dataset.b4Course||selected?.dataset.b3Course||selected?.dataset.b2Course||selected?.dataset.phonicsCourse||selected?.dataset.course;
  if(sectionNames.includes(value))return value;
  const fromBody=document.body.dataset.course;
  return sectionNames.includes(fromBody)?fromBody:state.course==='lesson'?'catalog':state.course;
 }
 function hasProgress(){
  if(!state)return false;
  return state.course==='lesson'||state.letter>0||Object.values(state.heard||{}).some(Boolean)||
   Object.values(state.attempts||{}).some(value=>value?.count>0)||Object.values(state.written||{}).some(Boolean)||
   Object.values(state.ink||{}).some(strokes=>strokes.length>0)||!!locationRecord().section;
 }
 function element(tag,attributes={}){
  const node=document.createElement(tag);for(const [key,value]of Object.entries(attributes))node.setAttribute(key,value);return node;
 }
 function button(id,action){const node=element('button',{type:'button',id});node.onclick=action;return node;}
 function createDialog(id,titleId){
  const dialog=element('dialog',{id,class:'hzn-focus-dialog','aria-labelledby':titleId});
  const head=element('div',{class:'hzn-dialog-head'}),title=element('h2',{id:titleId}),close=button(id+'-close',()=>dialog.close());
  close.className='secondary hzn-dialog-close';head.append(title,close);dialog.append(head);document.body.append(dialog);
  dialog.addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  return dialog;
 }
 function closePanels(){for(const dialog of [drawer,accountDialog])if(dialog?.open)dialog.close();}
 function openPanel(dialog,trigger){returnFocus=trigger;dialog.showModal();}
 function saveHistory(next,replace=false){
  if(restoring||!globalThis.history?.pushState)return;
  const previous=history.state&&typeof history.state==='object'?history.state:{};
  const value={...previous,hznFocus:{view:next,learner:learnerKey()}};
  try{history[replace?'replaceState':'pushState'](value,'');}catch{}
 }
 function lessonView(){
  const changed=view!=='lesson';view='lesson';closePanels();applyView();
  if(changed)saveHistory('lesson');
 }
 function showHome(){
  stopPenDemo();stop();closePanels();const changed=view!=='home';view='home';sync();
  if(changed)saveHistory('home');q('#hzn-home-title')?.focus({preventScroll:true});
 }
 function openLessons(){
  if(view==='home'){homeNav.scrollIntoView({block:'nearest',behavior:'auto'});q('#course-nav button')?.focus();return;}
  drawerNav.append(q('#course-nav'));openPanel(drawer,q('#hzn-lessons-button'));
 }
 function startOrResume(){
  // A locked preview is not a learning location. Return through its original
  // handler before resuming the untouched free activity beneath it.
  if(IS_DEMO)q('#activity [data-demo-return]')?.click();
  lessonView();const target=locationRecord().section;
  if(target&&target!==currentSection()&&componentNames.has(target)){
   const choice=[...q('#course-nav').querySelectorAll('button')].find(node=>[node.dataset.b4Course,node.dataset.b3Course,node.dataset.b2Course,node.dataset.phonicsCourse,node.dataset.course].includes(target));
   if(choice&&!choice.disabled)choice.click();
  }
  applyView();q('#activity')?.focus({preventScroll:true});
 }
 function install(){
  if(installed)return;installed=true;document.body.classList.add('hzn-focus');
  const style=element('style',{id:'hzn-focus-style'});style.textContent=CSS;document.head.append(style);
  const main=q('main');
  home=element('section',{id:'hzn-home','aria-labelledby':'hzn-home-title'});
  const welcome=element('div',{class:'hzn-home-welcome'}),heading=element('h1',{id:'hzn-home-title',tabindex:'-1'}),hint=element('p',{id:'hzn-home-hint'});
  const resume=button('hzn-resume',startOrResume);resume.className='primary hzn-resume';
  const resumeLabel=element('span',{id:'hzn-resume-label'}),resumeTitle=element('small',{id:'hzn-resume-title'});resume.append(resumeLabel,resumeTitle);
  welcome.append(heading,hint,resume);homeNav=element('div',{id:'hzn-home-nav'});home.append(welcome,homeNav);main.prepend(home);
  drawer=createDialog('hzn-lessons-dialog','hzn-lessons-title');drawerNav=element('div',{class:'hzn-drawer-nav'});drawer.append(drawerNav);
  accountDialog=createDialog('hzn-account-dialog','hzn-account-title');accountDialog.append(element('div',{id:'hzn-account-controls'}));
  const accountHelp=button('hzn-account-help',()=>{accountDialog.close();openSettings();});accountHelp.className='secondary';accountDialog.append(accountHelp);
  toolbar=element('nav',{class:'hzn-top-controls','aria-label':text('activityOptions')});
  toolbar.append(button('hzn-lessons-button',openLessons),button('hzn-account-button',()=>{
   if(learnerStorage.enabled)openPanel(accountDialog,q('#hzn-account-button'));else openSettings();
  }));
  const settingsButton=q('#settings-button');settingsButton.classList.add('hzn-settings-button');settingsButton.onclick=openSettings;toolbar.append(settingsButton);
  q('.topbar').append(toolbar);
  const language=q('#locale')?.closest('label')||q('#locale');
  languageDock=element('section',{id:'hzn-language-dock',class:'setting-section'});if(language)languageDock.append(language);
  q('#settings').append(languageDock);
  utilityDock=element('section',{id:'hzn-utility-dock',class:'setting-section'});q('#settings').append(utilityDock);
  const collectUtilities=()=>{const actions=q('.top-actions');if(!actions)return;for(const node of [...actions.children])utilityDock.append(node);};
  collectUtilities();
  if(typeof MutationObserver==='function'&&q('.top-actions'))new MutationObserver(collectUtilities).observe(q('.top-actions'),{childList:true});
  const brand=q('.topbar .brand');if(brand)brand.addEventListener('click',event=>{event.preventDefault();showHome();});
  backButton=button('hzn-back-lessons',showHome);backButton.className='hzn-back-lessons';q('.lesson-heading').prepend(backButton);
  q('#course-nav').addEventListener('click',event=>{
   const target=event.target.closest('button');if(!target||target.disabled)return;
   lessonView();
   queueMicrotask(()=>{if(!state)return;const section=currentSection();if(!IS_DEMO||!componentNames.has(section)){locationRecord().section=section;persistLocation();}sync();q('#activity')?.focus({preventScroll:true});});
  },true);
  q('#settings').addEventListener('close',()=>{q('#settings-button')?.focus({preventScroll:true});});
  const originalLocale=q('#locale').onchange;
  q('#locale').onchange=function(event){const result=originalLocale?.call(this,event);syncSettings();return result;};
  addEventListener('popstate',event=>{
   const record=event.state?.hznFocus;if(!record||record.learner!==learnerKey())return;
   restoring=true;view=record.view==='lesson'?'lesson':'home';stopPenDemo();stop();closePanels();sync();restoring=false;
  });
  saveHistory('home',true);
 }
 function syncSettings(){
  const dialog=q('#settings');if(!dialog)return;
  q('#settings-title').textContent=text('settings');q('#close-settings').setAttribute('aria-label',text('close'));
  // The existing toolbar is relocated, not copied; its select handlers and font
  // preference persistence remain intact. The generated duplicate is removed.
  const nativeToolbar=q('#typography-toolbar');
  if(nativeToolbar){languageDock.append(nativeToolbar);nativeToolbar.querySelector('details')?.setAttribute('open','');}
  q('#settings-content .typography-settings')?.remove();
  if(languageDock.parentElement!==dialog)dialog.append(languageDock);
  const learnerTools=q('#settings-content .learner-settings');
  if(learnerTools){
   let wrapper=learnerTools.closest('.hzn-account-details');
   if(!wrapper){wrapper=element('details',{class:'hzn-account-details'});const summary=element('summary');learnerTools.before(wrapper);wrapper.append(summary,learnerTools);}
   wrapper.querySelector('summary').textContent=text('account');
  }
  q('#settings-button').onclick=openSettings;
 }
 function openSettings(){
  closePanels();returnFocus=q('#settings-button');original.openSettingsWithTypography();syncSettings();
  q('#settings').prepend(languageDock);q('#settings').prepend(q('#settings .dialog-head'));
 }
 function compactActivity(){
  const activity=q('#activity');if(!activity)return;
  const grid=activity.querySelector('.alphabet-grid');
  if(grid&&!grid.closest('.hzn-letter-index')){
   const details=element('details',{class:'hzn-letter-index'}),summary=element('summary');summary.textContent=text('letterIndex');details.append(summary,grid);activity.append(details);
   grid.addEventListener('click',event=>{if(event.target.closest('[data-letter]'))details.open=false;});
  }
  const header=activity.querySelector(':scope > .activity-header');
  if(header&&state.course!=='catalog'){
   const existing=activity.querySelector('.word-overview,.hzn-letter-index,.writing-notes');
   if(existing)existing.append(header);
   else{const details=element('details',{class:'hzn-activity-help'}),summary=element('summary');summary.textContent=text('activityOptions');details.append(summary,header);activity.append(details);}
  }
  const word=activity.querySelector('.vocab-word');
  if(typeof ResizeObserver==='function'){wordObserver??=new ResizeObserver(wordAccess);wordObserver.disconnect();if(word)wordObserver.observe(word);}
  wordAccess();
 }
 function wordAccess(){
  const word=q('#activity .vocab-word');if(!word)return;
  if(word.scrollWidth>word.clientWidth+1){word.setAttribute('tabindex','0');word.setAttribute('role','region');word.setAttribute('aria-label',t('words'));}
  else{word.removeAttribute('tabindex');word.removeAttribute('role');word.removeAttribute('aria-label');}
 }
 function applyView(){
  document.body.dataset.focusView=view;home.hidden=view!=='home';
  const nav=q('#course-nav'),destination=view==='home'?homeNav:drawerNav;if(nav.parentElement!==destination)destination.append(nav);
  const upgrade=q('#demo-upgrade');if(upgrade){const target=view==='home'?homeNav:drawerNav;if(upgrade.parentElement!==target||upgrade.nextElementSibling!==nav)nav.before(upgrade);}
  const navContainer=q('#activity-navigation');if(navContainer)navContainer.classList.toggle('hzn-has-activities',!q('#stages').hidden);
 }
 function sync(){
  if(!state||!q('#activity'))return;
  const nextOwner=learnerKey();if(nextOwner!==owner){owner=nextOwner;view='home';closePanels();if(installed)saveHistory('home',true);}
  install();
  const currentProfile=learnerStorage.enabled?learnerStorage.current:null;
  q('#hzn-home-title').textContent=text('homeTitle');q('#hzn-home-hint').textContent=text('homeHint');
  q('#hzn-resume-label').textContent=text(hasProgress()?'resume':'start');
  let title=IS_DEMO&&q('#activity [data-demo-return]')
   ?state.course==='lesson'?t('letterLesson',{letter:data.letter}):t(state.course==='catalog'?'courseTitle':'alphabet')
   :q('#lesson-title')?.textContent||'';
  const lastSection=locationRecord().section;
  if(lastSection&&componentNames.has(lastSection)&&lastSection!==currentSection()){
   const choice=[...q('#course-nav').querySelectorAll('button')].find(node=>[node.dataset.b4Course,node.dataset.b3Course,node.dataset.b2Course,node.dataset.phonicsCourse,node.dataset.course].includes(lastSection));
   if(choice)title=choice.querySelector('.demo-section-title')?.textContent||choice.textContent.trim();
   const saved=restoreComponent(lastSection);if(saved?.lesson)title+=' · '+text('lessons')+' '+new Intl.NumberFormat(locale).format(saved.lesson);
  }
  q('#hzn-resume-title').textContent=hasProgress()?title:'';
  q('#hzn-lessons-button').textContent=text('lessons');q('#hzn-account-button').textContent=currentProfile?.nickname||text('account');
  q('#settings-button').textContent=text('settings');q('#settings-button').setAttribute('aria-label',text('settings'));
  backButton.textContent=text('backToLessons');
  q('#hzn-lessons-title').textContent=text('lessons');q('#hzn-account-title').textContent=text('account');q('#hzn-account-help').textContent=text('account')+' · '+text('settings');
  for(const id of ['hzn-lessons-dialog','hzn-account-dialog']){q('#'+id+'-close').textContent=text('close');q('#'+id).lang=locale;q('#'+id).dir=document.documentElement.dir;}
  toolbar.setAttribute('aria-label',text('activityOptions'));
  const learnerToolbarNode=q('#learner-toolbar');if(learnerToolbarNode){q('#hzn-account-controls').append(learnerToolbarNode);const manage=q('#learner-manage');if(manage)manage.onclick=openSettings;}
  const nativeToolbar=q('#typography-toolbar');if(nativeToolbar)languageDock.append(nativeToolbar);
  const savedLabel=q('#saved-label');if(savedLabel)utilityDock.append(savedLabel);
  q('#settings-button').onclick=openSettings;
  compactActivity();applyView();if(q('#settings')?.open)syncSettings();
 }
 render=function(...args){const result=original.render.apply(this,args);sync();return result;};
 nav=function(...args){lessonView();const result=original.nav.apply(this,args);locationRecord().section=currentSection();persistLocation();return result;};
 learnerToolbar=function(...args){
  const result=original.learnerToolbar.apply(this,args),manage=q('#learner-manage');if(manage)manage.onclick=openSettings;
  const native=q('#learner-toolbar');if(installed&&native)q('#hzn-account-controls').append(native);return result;
 };
 setLearner=function(...args){view='home';closePanels();const result=original.setLearner.apply(this,args);sync();return result;};
 function wrapComponent(section,mount){
  return function(root,data,config){
   const componentOwner=learnerKey(),onSnapshot=config.onSnapshot;
   const snapshot=config.snapshot||restoreComponent(section);
   const instance=mount(root,data,{...config,externalSettings:true,snapshot,
    onSnapshot(value){if(componentOwner!==learnerKey())return;onSnapshot?.(value);rememberComponent(section,value);}
   });
   components.set(section,{instance,host:root.host,owner:componentOwner});
   instance.setPreferences?.({font:typographyFont().id,size:TYPOGRAPHY_SIZES[typography.size]/100,locale});
   return instance;
  };
 }
 if(typeof mountBlending3Component==='function')mountBlending3Component=wrapComponent('blending3',mountBlending3Component);
 if(typeof mountBlending4Component==='function')mountBlending4Component=wrapComponent('blending4',mountBlending4Component);
 applyTypography=function(...args){
  const result=original.applyTypography.apply(this,args);
  for(const item of components.values())if(item.owner===learnerKey()&&item.host.isConnected)item.instance.setPreferences?.({font:typographyFont().id,size:TYPOGRAPHY_SIZES[typography.size]/100,locale});
  requestAnimationFrame(wordAccess);
  return result;
 };
 addEventListener('resize',wordAccess);
 document.fonts?.ready.then(wordAccess);
 globalThis.hznFocusShell=Object.freeze({sync,currentLearnerKey:learnerKey,rememberComponent,restoreComponent,showHome,openSettings});
})();
/*WORKBOOK_FOCUS_END*/
