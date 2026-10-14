// מדפיס (כ־JSON) את כל המשפטים שהקריין מקריא, באותה חלוקה שבה משתמש האתר.
// משמש את tools/generate_audio.py.
import { INTRO, OUTRO, STATIONS, QUIZ_RIGHT, QUIZ_WRONG } from '../js/data.js';
import { GLOSSARY } from '../js/glossary.js';
import { splitSentences } from '../js/speech.js';

const texts = [
  INTRO.narration,
  ...STATIONS.map((s) => s.narration),
  OUTRO.narration,
  QUIZ_RIGHT,
  QUIZ_WRONG,
  ...GLOSSARY.map((g) => g.text),
];
const sentences = [...new Set(texts.flatMap(splitSentences))];
process.stdout.write(JSON.stringify(sentences, null, 2));
