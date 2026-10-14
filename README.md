# מסע במעבדת ה־EP ❤️

אתר תלת־ממדי בעברית ליום ההורים, שמסביר לילדים מה אבא עושה בעבודה: מהנדס מערכות בג'ונסון אנד ג'ונסון מדטק, בתחום ה־EP (אלקטרופיזיולוגיה, החשמל של הלב).

האתר בנוי על אותו בסיס כמו [מסע במערכת השמש](https://github.com/Yanik1983/Space-explanation): three.js, הקריין, ונועם המדריך בתלת־ממד.

## מה יש באתר
- **מעבדת EP בתלת־ממד:** מיטת טיפולים עם מטופל ולב פועם, מכשיר רנטגן (C-arm), משטח מיקום, מסכים, מערכת הקלטה, מגש קטטרים, מחולל אבלציה וחדר בקרה.
- **מראה אמיתי:** מודלים אמיתיים מ־Sketchfab (מיטת ניתוח, מנורת ניתוח, מגדל מחשב שעל המסכים שלו רצים אותות הלב, עגלת מכשירים, מוניטור אק"ג, עמוד אינפוזיה, עגלת ציוד, וסריקה של רופא בבגדי ניתוח), לב אנטומי אמיתי, מטופל מתחת לסדין שנופל על הגוף, אבא ואנשי צוות, תאורה ממפת סביבה של מעבדה אמיתית (HDRI), צללים, וצל רך בפינות (AO).
- **10 תחנות:** כל נקודה ממוספרת במעבדה היא תחנה. כשעוברים לתחנה, המצלמה טסה אליה, ונועם מסביר בקול. כל משפט מודגש בזמן שהוא מוקרא.
- **מפת הלב:** על המסך הגדול מסתובב הלב האנטומי, צבוע לפי זמן ההפעלה כמו במערכת CARTO, ופס לבן עובר עליו ומראה איך האות החשמלי מתפשט.
- **מסכים חיים:** אותות הלב רצים על המסכים, כולל ערוץ של פרפור.
- **מילון מושגים וחידון.**
- אפשר לסובב את המעבדה עם העכבר או האצבע, וללחוץ על חפצים כדי לעבור לתחנה שלהם.

## הקראה
כמו באתר החלל: אם יש קבצי שמע בתיקייה `audio/`, הם מנוגנים. אחרת משתמשים בקול העברי של הדפדפן.
את הקבצים יוצרת הפעולה `.github/workflows/narration-audio.yml` ב־GitHub Actions, בכל שינוי בטקסטים ב־`main`. אפשר גם להריץ ידנית:

```bash
pip install -r tools/requirements-audio.txt
python3 tools/generate_audio.py
```

## הרצה במחשב
```bash
python3 -m http.server 8000
# ואז לפתוח: http://localhost:8000
```

## מבנה הקבצים
| קובץ | תפקיד |
|---|---|
| `js/data.js` | **כל הטקסטים** של התחנות ומיקום המצלמה בכל תחנה. כאן עורכים |
| `js/glossary.js` | מילון המושגים |
| `js/lab.js` | בניית המעבדה בתלת־ממד והאנימציות |
| `js/people.js` | אבא, אנשי הצוות והמטופל: בגדים לפי תפקיד ותנוחות |
| `assets/` | המודלים (הלב, הציוד, הרופא והדמות) ומפת התאורה |
| `js/main.js` | המצלמה, הסיור, הממשק |
| `js/presenter.js`, `js/speech.js` | נועם והקריין (מאתר החלל) |
| `vendor/three/` | ספריית [three.js](https://threejs.org) (רישיון MIT) |

## קרדיטים ורישיונות
- **מודל הלב:** [Realistic Human Heart](https://sketchfab.com/3d-models/realistic-human-heart-3f8072336ce94d18b3d0d055a1ece089) מאת neshallads, ברישיון [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/). הטקסטורות הוקטנו והומרו ל־WebP.
- **מודלים מ־Sketchfab, כולם ברישיון [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/)** (הטקסטורות הוקטנו והומרו ל־WebP):
  - [Realistic Medical Equipment and Accessories Set](https://sketchfab.com/3d-models/realistic-medical-equipment-and-accessories-set-5460fb2767c6468eb88466d2555d273b) מאת daonware: מיטת הניתוח, מנורת הניתוח, עגלת המכשירים ומגדל המחשב.
  - [FREE DOWNLOAD: Male surgical doctor working 222](https://sketchfab.com/3d-models/free-download-male-surgical-doctor-working-222-79e23af07d1243c789b3372c6ec72c27) מאת deep3dstudio: הרופא.
  - [ECG Monitor](https://sketchfab.com/3d-models/ecg-monitor-47e72cd57f45414aa82e41342b299b5b) מאת demagdev.
  - [IV Stand](https://sketchfab.com/3d-models/iv-stand-dd3115aafb0e4a628f261d0de7a787b9) מאת teeart.
  - [Medical Cart](https://sketchfab.com/3d-models/medical-cart-2a0a574f9e374702af8c415fce296f45) מאת NicolasVB.
- **הדמויות האחרות:** האווטאר `readyplayer.me.glb` מתוך הדוגמאות של [three.js](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf) (© Ready Player Me). הבגדים והתנוחות משתנים בקוד.
- **מפת התאורה:** HDRI בשם "lab" מ־[Poly Haven](https://polyhaven.com) (CC0), דרך החבילה [@pmndrs/assets](https://github.com/pmndrs/assets).
- **three.js** ותוספים שלה: רישיון MIT.
