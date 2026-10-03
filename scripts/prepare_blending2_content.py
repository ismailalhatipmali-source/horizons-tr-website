#!/usr/bin/env python3
"""Prepare section03 data and the exact closed-word recording transcript."""
import json
import unicodedata
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
WORDS=[
 ('man','مَنْ','miim','fatha','سؤال عن الشخص'),
 ('nam','نَمْ','nuun','fatha','اذهب إلى النوم'),
 ('hal','هَلْ','haa_breath','fatha','سؤال جوابه نعم أو لا'),
 ('bal','بَلْ','baa','fatha','لتصحيح المعلومة أو الانتقال إلى غيرها'),
 ('lam','لَمْ','laam','fatha','نفي حدث في الماضي'),
 ('lan','لَنْ','laam','fatha','نفي حدث في المستقبل'),
 ('an_ayn','عَنْ','ayn','fatha','لذكر الموضوع أو الابتعاد'),
 ('an_hamza','أَنْ','alif','fatha','أداة تربط أجزاء الجملة'),
 ('am','أَمْ','alif','fatha','للسؤال عن الاختيار'),
 ('da','دَعْ','daal','fatha','اترك'),
 ('da_emphatic','ضَعْ','daad','fatha','اجعل الشيء في مكان'),
 ('qad','قَدْ','qaaf','fatha','تفيد تحقق الحدث مع الماضي'),
 ('sal','سَلْ','siin','fatha','اسأل'),
 ('qum','قُمْ','qaaf','damma','انهض'),
 ('qul','قُلْ','qaaf','damma','تكلّم واذكر'),
 ('khudh','خُذْ','khaa','damma','تناول الشيء'),
 ('kul','كُلْ','kaaf','damma','تناول الطعام'),
 ('sum','صُمْ','saad','damma','امتنع عن الطعام والشراب للصيام'),
 ('ud','عُدْ','ayn','damma','ارجع'),
 ('min','مِنْ','miim','kasra','تدل على البداية أو المصدر'),
 ('in','إِنْ','alif','kasra','أداة شرط'),
 ('sir','سِرْ','siin','kasra','امشِ'),
 ('sil','صِلْ','saad','kasra','اربط'),
 ('zid','زِدْ','zaay','kasra','اجعله أكثر'),
 ('qif','قِفْ','qaaf','kasra','توقف'),
 ('bi','بِعْ','baa','kasra','أعطِ الشيء مقابل ثمن'),
 ('ish','عِشْ','ayn','kasra','واصل الحياة'),
]

def build():
    phonics=json.loads((ROOT/'release-assets/phonics-20261003/release.json').read_text())['audio']
    by_id={p['id']:p for p in phonics}
    opened=[]
    for p in phonics:
        if p['length']!='long' or p['letterKey']=='alif':continue
        assert len([c for c in p['text'] if not unicodedata.combining(c)])==2
        opened.append({'id':f"blend2.open.{p['letterKey']}_{p['vowel']}",'text':p['text'],
                       'letter_key':p['letterKey'],'vowel':p['vowel'],
                       'phonics_id':p['id'],'glyph_id':p['id'],'audio_path':p['path'],
                       'audio_status':'approved_reuse','advanced':p['letterKey'] in ('waaw','yaa')})
    closed=[]
    for i,(slug,text,key,vowel,meaning) in enumerate(WORDS,1):
        mark={'fatha':'َ','damma':'ُ','kasra':'ِ'}[vowel]
        assert len(text)==4 and text[1]==mark and text[-1]=='ْ'
        assert not any(c in text for c in 'ًٌٍّ')
        first=f'phonics.{key}.{vowel}.short'
        assert by_id[first]['text']==text[:2]
        closed.append({'id':'blend2.closed.'+slug,'recording_order':i,'text':text,
                       'vowel':vowel,'first_sound_id':first,'final_letter':text[2:],
                       'meaning':{'ar':meaning},'normal_audio_path':None,
                       'expected_audio_path':f'course/audio/blending2/blend2.closed.{slug}.normal.mp3',
                       'audio_status':'awaiting_recording_and_approval'})
    assert len(opened)==81 and len(closed)==27
    assert len({p['id'] for p in opened+closed})==108
    return {'schema_version':1,'section':'03','title_ar':'الدمج الثنائي',
            'status':'content_prepared_not_published','source_release':'phonics-20261003',
            'voice':'Erinome','new_recordings_required':27,'open_cards':opened,'closed_words':closed,
            'teaching_audio_sequence':['existing_initial_cv','visual_join_without_isolated_coda_audio','approved_complete_cvc'],
            'closed_transcript':[w[1] for w in WORDS]}

if __name__=='__main__':
    out=ROOT/'src/blending2/content.json';out.parent.mkdir(parents=True,exist_ok=True)
    data=build();out.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    print('Prepared 81 approved open cards + 27 closed words; every initial sound mapped; awaiting 27 recordings.')
