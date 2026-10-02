"""Checkout FX text; rows match the website's 32 locales."""
import json
from pathlib import Path
ROWS='''en|Payment currency|Total in the selected currency|Rate source: {source} · Date: {date} · Conversion margin: {margin}% · Valid until: {until}|Refresh exchange rate|A current rate is unavailable. Choose USD or try again.|This quote expired. Refresh the rate and review the total.
ar|عملة الدفع|الإجمالي بالعملة المختارة|مصدر السعر: {source} · التاريخ: {date} · هامش التحويل: {margin}% · صالح حتى: {until}|تحديث سعر الصرف|تعذّر جلب سعر حديث. اختر الدولار أو حاول مجددًا.|انتهى عرض السعر. حدّث سعر الصرف وراجع الإجمالي.
tr|Ödeme para birimi|Seçilen para biriminde toplam|Kur kaynağı: {source} · Tarih: {date} · Dönüşüm marjı: %{margin} · Geçerlilik: {until}|Kuru yenile|Güncel kur alınamadı. USD seçin veya tekrar deneyin.|Teklifin süresi doldu. Kuru yenileyip toplamı kontrol edin.
fr|Devise de paiement|Total dans la devise choisie|Source : {source} · Date : {date} · Marge de conversion : {margin}% · Valable jusqu’à : {until}|Actualiser le taux|Taux récent indisponible. Choisissez USD ou réessayez.|Cette offre a expiré. Actualisez le taux et vérifiez le total.
es|Moneda de pago|Total en la moneda elegida|Fuente: {source} · Fecha: {date} · Margen de conversión: {margin}% · Válido hasta: {until}|Actualizar el cambio|No hay un tipo reciente. Elige USD o inténtalo de nuevo.|La oferta ha caducado. Actualiza el cambio y revisa el total.
de|Zahlungswährung|Gesamtbetrag in der gewählten Währung|Quelle: {source} · Datum: {date} · Umrechnungsmarge: {margin}% · Gültig bis: {until}|Wechselkurs aktualisieren|Kein aktueller Kurs verfügbar. USD wählen oder erneut versuchen.|Dieses Angebot ist abgelaufen. Kurs aktualisieren und Gesamtbetrag prüfen.
it|Valuta di pagamento|Totale nella valuta scelta|Fonte: {source} · Data: {date} · Margine di conversione: {margin}% · Valido fino a: {until}|Aggiorna il cambio|Tasso recente non disponibile. Scegli USD o riprova.|Il preventivo è scaduto. Aggiorna il cambio e verifica il totale.
pt|Moeda de pagamento|Total na moeda escolhida|Fonte: {source} · Data: {date} · Margem de conversão: {margin}% · Válido até: {until}|Atualizar câmbio|Taxa recente indisponível. Escolha USD ou tente novamente.|A cotação expirou. Atualize o câmbio e confira o total.
nl|Betaalvaluta|Totaal in de gekozen valuta|Bron: {source} · Datum: {date} · Wisselmarge: {margin}% · Geldig tot: {until}|Wisselkoers vernieuwen|Geen recente koers beschikbaar. Kies USD of probeer opnieuw.|Deze prijsopgave is verlopen. Vernieuw de koers en controleer het totaal.
ru|Валюта оплаты|Итого в выбранной валюте|Источник: {source} · Дата: {date} · Наценка за конвертацию: {margin}% · Действует до: {until}|Обновить курс|Свежий курс недоступен. Выберите USD или повторите попытку.|Срок расчёта истёк. Обновите курс и проверьте итог.
uk|Валюта оплати|Разом у вибраній валюті|Джерело: {source} · Дата: {date} · Націнка за конвертацію: {margin}% · Чинний до: {until}|Оновити курс|Свіжий курс недоступний. Виберіть USD або спробуйте ще раз.|Термін розрахунку минув. Оновіть курс і перевірте суму.
pl|Waluta płatności|Suma w wybranej walucie|Źródło: {source} · Data: {date} · Marża wymiany: {margin}% · Ważne do: {until}|Odśwież kurs|Aktualny kurs jest niedostępny. Wybierz USD lub spróbuj ponownie.|Wycena wygasła. Odśwież kurs i sprawdź sumę.
cs|Měna platby|Celkem ve zvolené měně|Zdroj: {source} · Datum: {date} · Kurzová marže: {margin}% · Platnost do: {until}|Aktualizovat kurz|Aktuální kurz není dostupný. Zvolte USD nebo to zkuste znovu.|Nabídka vypršela. Aktualizujte kurz a zkontrolujte částku.
ro|Moneda plății|Total în moneda aleasă|Sursă: {source} · Data: {date} · Marjă de conversie: {margin}% · Valabil până la: {until}|Actualizează cursul|Cursul actual nu este disponibil. Alege USD sau încearcă din nou.|Oferta a expirat. Actualizează cursul și verifică totalul.
hu|Fizetési pénznem|Összeg a választott pénznemben|Forrás: {source} · Dátum: {date} · Átváltási felár: {margin}% · Érvényes eddig: {until}|Árfolyam frissítése|Nincs friss árfolyam. Válasszon USD-t vagy próbálja újra.|Az ajánlat lejárt. Frissítse az árfolyamot és ellenőrizze az összeget.
el|Νόμισμα πληρωμής|Σύνολο στο επιλεγμένο νόμισμα|Πηγή: {source} · Ημερομηνία: {date} · Περιθώριο μετατροπής: {margin}% · Ισχύει έως: {until}|Ανανέωση ισοτιμίας|Δεν υπάρχει πρόσφατη ισοτιμία. Επιλέξτε USD ή δοκιμάστε ξανά.|Η προσφορά έληξε. Ανανεώστε την ισοτιμία και ελέγξτε το σύνολο.
sv|Betalningsvaluta|Totalt i vald valuta|Källa: {source} · Datum: {date} · Växlingspåslag: {margin}% · Giltigt till: {until}|Uppdatera växelkurs|Ingen aktuell kurs tillgänglig. Välj USD eller försök igen.|Offerten har löpt ut. Uppdatera kursen och kontrollera summan.
da|Betalingsvaluta|I alt i den valgte valuta|Kilde: {source} · Dato: {date} · Vekselpåslag: {margin}% · Gyldig til: {until}|Opdater valutakurs|En aktuel kurs er ikke tilgængelig. Vælg USD eller prøv igen.|Tilbuddet er udløbet. Opdater kursen og kontrollér beløbet.
no|Betalingsvaluta|Totalt i valgt valuta|Kilde: {source} · Dato: {date} · Valutapåslag: {margin}% · Gyldig til: {until}|Oppdater valutakurs|Ingen aktuell kurs tilgjengelig. Velg USD eller prøv igjen.|Tilbudet har utløpt. Oppdater kursen og kontroller totalen.
fi|Maksuvaluutta|Yhteensä valitussa valuutassa|Lähde: {source} · Päivä: {date} · Vaihtomarginaali: {margin}% · Voimassa asti: {until}|Päivitä vaihtokurssi|Tuoretta kurssia ei ole saatavilla. Valitse USD tai yritä uudelleen.|Tarjous on vanhentunut. Päivitä kurssi ja tarkista summa.
bg|Валута на плащане|Общо в избраната валута|Източник: {source} · Дата: {date} · Надценка за превалутиране: {margin}% · Валидно до: {until}|Обнови курса|Няма актуален курс. Изберете USD или опитайте отново.|Офертата е изтекла. Обновете курса и проверете сумата.
sr|Валута плаћања|Укупно у изабраној валути|Извор: {source} · Датум: {date} · Маржа конверзије: {margin}% · Важи до: {until}|Освежи курс|Актуелни курс није доступан. Изаберите USD или покушајте поново.|Понуда је истекла. Освежите курс и проверите износ.
hr|Valuta plaćanja|Ukupno u odabranoj valuti|Izvor: {source} · Datum: {date} · Marža konverzije: {margin}% · Vrijedi do: {until}|Osvježi tečaj|Aktualni tečaj nije dostupan. Odaberite USD ili pokušajte ponovno.|Ponuda je istekla. Osvježite tečaj i provjerite iznos.
he|מטבע תשלום|סך הכול במטבע שנבחר|מקור: {source} · תאריך: {date} · מרווח המרה: {margin}% · בתוקף עד: {until}|עדכון שער החליפין|שער עדכני אינו זמין. בחרו USD או נסו שוב.|תוקף ההצעה פג. עדכנו את השער ובדקו את הסכום.
fa|ارز پرداخت|مجموع به ارز انتخابی|منبع: {source} · تاریخ: {date} · حاشیه تبدیل: {margin}% · معتبر تا: {until}|به‌روزرسانی نرخ ارز|نرخ تازه در دسترس نیست. دلار را انتخاب کنید یا دوباره تلاش کنید.|اعتبار قیمت پایان یافت. نرخ را به‌روز و مبلغ را بررسی کنید.
ur|ادائیگی کی کرنسی|منتخب کرنسی میں کل رقم|ماخذ: {source} · تاریخ: {date} · تبدیلی کا مارجن: {margin}% · کارآمد تا: {until}|شرح مبادلہ تازہ کریں|تازہ شرح دستیاب نہیں۔ USD منتخب کریں یا دوبارہ کوشش کریں۔|اس قیمت کی مدت ختم ہوگئی۔ شرح تازہ کریں اور کل رقم دیکھیں۔
hi|भुगतान की मुद्रा|चुनी गई मुद्रा में कुल|स्रोत: {source} · तारीख: {date} · विनिमय मार्जिन: {margin}% · मान्य समय: {until}|विनिमय दर अपडेट करें|नई दर उपलब्ध नहीं है। USD चुनें या फिर कोशिश करें।|इस मूल्य की अवधि समाप्त हो गई। दर अपडेट करके कुल राशि जाँचें।
bn|পরিশোধের মুদ্রা|নির্বাচিত মুদ্রায় মোট|উৎস: {source} · তারিখ: {date} · রূপান্তর মার্জিন: {margin}% · মেয়াদ: {until}|বিনিময় হার হালনাগাদ করুন|নতুন হার পাওয়া যাচ্ছে না। USD বেছে নিন বা আবার চেষ্টা করুন।|এই মূল্যের মেয়াদ শেষ। হার হালনাগাদ করে মোট দেখুন।
id|Mata uang pembayaran|Total dalam mata uang pilihan|Sumber: {source} · Tanggal: {date} · Margin konversi: {margin}% · Berlaku hingga: {until}|Perbarui kurs|Kurs terbaru tidak tersedia. Pilih USD atau coba lagi.|Penawaran kedaluwarsa. Perbarui kurs dan periksa total.
ms|Mata wang pembayaran|Jumlah dalam mata wang pilihan|Sumber: {source} · Tarikh: {date} · Margin penukaran: {margin}% · Sah hingga: {until}|Kemas kini kadar|Kadar terkini tidak tersedia. Pilih USD atau cuba lagi.|Tawaran telah tamat. Kemas kini kadar dan semak jumlah.
zh|支付币种|所选币种的总额|来源：{source} · 日期：{date} · 兑换加价：{margin}% · 有效期至：{until}|刷新汇率|暂无最新汇率。请选择美元或重试。|报价已过期。请刷新汇率并核对总额。
ja|支払い通貨|選択した通貨での合計|出典：{source} · 日付：{date} · 換算マージン：{margin}% · 有効期限：{until}|為替レートを更新|最新レートを取得できません。USDを選択するか再試行してください。|見積もりの期限が切れました。レートを更新し、合計を確認してください。'''
KEYS=['pay_currency','fx_total','fx_details','fx_refresh','fx_error','fx_expired']
def translations():
    out={}
    for row in ROWS.splitlines():
        lang,*words=row.split('|');assert len(words)==len(KEYS);out[lang]=dict(zip(KEYS,words))
    assert len(out)==32
    return out
if __name__=='__main__':
    path=Path(__file__).resolve().parents[1]/'src/commerce/fx-locales.json'
    path.write_text(json.dumps(translations(),ensure_ascii=False,indent=2)+'\n')
