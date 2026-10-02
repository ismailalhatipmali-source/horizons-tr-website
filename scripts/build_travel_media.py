#!/usr/bin/env python3
"""Render three authentic, flattened sample pages from each verified edition."""
import hashlib, json, sys
from pathlib import Path
import fitz

repo = Path(__file__).resolve().parents[1]
root = Path(sys.argv[1])
languages = 'en ar tr fr es de it pt nl ru uk pl cs ro hu el sv da no fi bg sr hr he fa ur hi bn id ms zh ja'.split()
labels = {
 'en': ['Preview the pages', 'Short product preview', 'Close'],
 'ar': ['شاهد الصفحات من الداخل', 'معاينة قصيرة للحزمة', 'إغلاق'],
 'tr': ['Sayfaları inceleyin', 'Kısa ürün ön izlemesi', 'Kapat'],
 'fr': ['Aperçu des pages', 'Courte présentation du produit', 'Fermer'],
 'es': ['Vista previa de las páginas', 'Breve presentación del producto', 'Cerrar'],
 'de': ['Einblick in die Seiten', 'Kurze Produktvorschau', 'Schließen'],
 'it': ['Anteprima delle pagine', 'Breve anteprima del prodotto', 'Chiudi'],
 'pt': ['Prévia das páginas', 'Breve apresentação do produto', 'Fechar'],
 'nl': ['Bekijk de pagina’s', 'Korte productpreview', 'Sluiten'],
 'ru': ['Посмотрите страницы', 'Краткий обзор набора', 'Закрыть'],
 'uk': ['Перегляньте сторінки', 'Короткий огляд набору', 'Закрити'],
 'pl': ['Podgląd stron', 'Krótka prezentacja produktu', 'Zamknij'],
 'cs': ['Náhled stránek', 'Krátká ukázka produktu', 'Zavřít'],
 'ro': ['Previzualizarea paginilor', 'Scurtă prezentare a produsului', 'Închide'],
 'hu': ['Az oldalak előnézete', 'Rövid termékbemutató', 'Bezárás'],
 'el': ['Προεπισκόπηση σελίδων', 'Σύντομη παρουσίαση προϊόντος', 'Κλείσιμο'],
 'sv': ['Förhandsvisa sidorna', 'Kort produktvisning', 'Stäng'],
 'da': ['Se siderne', 'Kort produktvisning', 'Luk'],
 'no': ['Se sidene', 'Kort produktvisning', 'Lukk'],
 'fi': ['Sivujen esikatselu', 'Lyhyt tuote-esittely', 'Sulje'],
 'bg': ['Преглед на страниците', 'Кратко представяне на продукта', 'Затвори'],
 'sr': ['Преглед страница', 'Кратак приказ производа', 'Затвори'],
 'hr': ['Pregled stranica', 'Kratki prikaz proizvoda', 'Zatvori'],
 'he': ['תצוגה מקדימה של הדפים', 'סרטון קצר על הערכה', 'סגירה'],
 'fa': ['پیش‌نمایش صفحه‌ها', 'پیش‌نمایش کوتاه بسته', 'بستن'],
 'ur': ['صفحات کا پیش نظارہ', 'کِٹ کا مختصر پیش نظارہ', 'بند کریں'],
 'hi': ['पृष्ठों की झलक देखें', 'उत्पाद का संक्षिप्त परिचय', 'बंद करें'],
 'bn': ['পাতাগুলোর পূর্বরূপ দেখুন', 'পণ্যের সংক্ষিপ্ত পরিচিতি', 'বন্ধ করুন'],
 'id': ['Pratinjau halaman', 'Pratinjau singkat produk', 'Tutup'],
 'ms': ['Pratonton halaman', 'Pratonton ringkas produk', 'Tutup'],
 'zh': ['查看内页预览', '产品短视频', '关闭'],
 'ja': ['ページのプレビュー', '商品のショートプレビュー', '閉じる'],
}
result = {}
for lang in languages:
    folder = root / ('Agency_Kit_' + lang.upper())
    index = (folder / 'Document_Index.txt').read_text().splitlines()
    pdf = fitz.open(folder / 'Agency_Documents_A4.pdf')
    assert len(pdf) == 40
    target = repo / 'dist/assets/travel-kit' / lang
    target.mkdir(parents=True, exist_ok=True)
    samples = []
    for name, page in [('proposal', 8), ('pricing', 14), ('itinerary', 22)]:
        output = target / (name + '.jpg')
        image = pdf[page].get_pixmap(matrix=fitz.Matrix(1.25, 1.25), alpha=False)
        output.write_bytes(image.tobytes('jpg', jpg_quality=85))
        samples.append({'src': 'assets/travel-kit/' + lang + '/' + name + '.jpg', 'caption': index[page].split('—', 1)[-1].strip(), 'page': page + 1})
    result[lang] = {'preview_title': labels[lang][0], 'video_title': labels[lang][1], 'close_preview': labels[lang][2], 'samples': samples, 'video': 'assets/travel-kit/' + lang + '/preview.mp4'}
    pdf.close()
(repo / 'dist/travel-kit-media.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('Rendered 96 authentic preview pages from 32 editions.')
