/* apps/typely/js/texts.js
 * Typely corpus (PLAN.md section 4): TEXTS = { en, fr, ar } x { easy, medium, hard }.
 * 45 texts total, each 120-260 chars. Easy: common words, no punctuation.
 * Medium: capitals + punctuation. Hard: numbers / symbols / long words
 * (AR hard: longer forms + Arabic-Indic numerals).
 * All punctuation is typable on QWERTY / AZERTY / Arabic layouts.
 * Zero dependencies. Works over file:// (plain script, no modules).
 */
(function () {
  'use strict';

  var TEXTS = {
    en: {
      easy: [
        'the sun is warm and the sky is clear the birds sing in the tall tree while the kids play ball on the soft green grass near the quiet pond all afternoon',
        'my little dog runs fast in the yard every morning he likes to catch the red ball and drink fresh milk from his round bowl after a long and happy day',
        'we sat by the calm lake to eat bread and sweet fruit the air was soft and warm and the ducks swam slow past the tall reeds in the cool shade',
        'a kind man gave us sweet red apples from his wooden cart we said thank you with a smile and sat down to share them with our best friends at noon',
        'mom sings a soft song as she cooks rice and beans for dinner dad reads a thick book by the warm lamp and the cat sleeps long on the old rug'
      ],
      medium: [
        'The old train left London at dawn, and crossed the green hills long before noon. Tired passengers drank hot tea, read the morning news, and watched the cold rain fall.',
        'Maria asked me, "Have you seen my little blue coat?" I looked in the dark hall, behind the heavy door, and under the old stairs, but the coat was simply gone.',
        'Please bring fresh bread, soft cheese, red apples, and sweet honey for our picnic. We will meet at the old park gate at three, unless the weather suddenly turns cold.',
        'Last winter, the deep lake froze solid for many weeks. Happy children skated at dusk, loud dogs barked at the pale moon, and warm lamps glowed in every small window.',
        'Captain Nemo sailed past Spain and Italy in early June. The tired crew sang very old songs, mended the torn sails every day, and dreamed of calm sunny ports ahead.'
      ],
      hard: [
        'Cryptocurrency volatility (~68.4%) exacerbated Q3 hyperinflation @ 3:40pm: worried analysts juxtaposed $1,209.55 budgets vs. deficits of 876.20 (cf. figs. 12-19) - unprecedented!!!',
        'The schizophrenic xenophobe puzzled over 42 phosphorescent zebras zigzagging juxtapositionally through 7 crooked labyrinths (est. 1893) - quixotically bizarre!',
        'ML pipelines (v2.7.1) preprocess 5,432,109 tokens/sec across 8 GPUs: tokenize => embed => normalize!!! Accuracy hit 99.97% @ epoch #300 (cf. pp. 201-233).',
        'Floccinaucinihilipilification - a famous 18th-century curiosity - left Schopenhauerian psychologists utterly dumbfounded; 11 misspellings logged: quiz@lab-42.io',
        'In 1776, 56 signatories ratified Article XIII; section 4(b)(ii) stipulated $2.5M in specie + 3/4 of customs duties - an unprecedented constitutionalism!'
      ]
    },
    fr: {
      easy: [
        'le petit chat noir dort sur le vieux tapis du salon pendant que les oiseaux chantent dans le grand arbre vert devant la maison',
        'nous mangeons du pain frais avec du bon fromage de chèvre et nous buvons du lait froid assis sur le banc devant le jardin',
        'les enfants jouent au ballon dans la grande cour ils rient très fort et courent partout avec leur petit chien roux toujours joyeux',
        'ma mère prépare une soupe chaude avec les beaux légumes du marché mon père lit son journal près du feu qui chauffe bien chaque soir',
        'le soleil brille très fort sur le lac calme de la vallée les canards nagent doucement et les fleurs sentent bon dans le pré vert'
      ],
      medium: [
        'Paris est très belle au printemps, quand les fleurs éclatent de partout. Marie et Paul marchent doucement le long de la Seine, heureux et libres.',
        '« Peux-tu venir demain matin ? » demanda Julie à son petit frère. Il répondit oui avec joie, puis prépara son vieux sac avec soin avant la nuit.',
        'Le vieux train entra lentement en gare à huit heures précises. Les voyageurs, fatigués mais contents, burent un café bien chaud avant de partir.',
        'Mon oncle Jules habite à Lyon depuis le mois de Mars dernier. Sa maison, grande et très claire, donne sur un beau jardin plein de roses rouges.',
        'Le capitaine Roux navigua vers Nice et Bastia au début du mois de Juin. Les marins chantaient fort, réparaient les voiles et rêvaient du port.'
      ],
      hard: [
        "La cryptographie post-quantique (v3.14.2) chiffre 2 048 576 octets par seconde : hétérogénéité constitutionnelle + anticonstitutionnellement = 99,7 % !!! (cf. art. 7).",
        "En 1789, 17 articles proclamèrent les libertés ; l'art. 2(b) prévoyait 5 000 écus + 3/4 des impôts - une abracadabrantesque nouveauté, non ?",
        'La FFT #256 traite 1 024 échantillons à 512 Hz : SNR de +12,5 dB (cf. pp. 301-342) - une électroencéphalographie incroyablement précise !',
        'Soirée wax : 33 tours, 45 remixes, 78 % de scratch - contact : yazid_77@club-lyon.fr ; rendez-vous à 23h59, dress-code : strass et paillettes.',
        'Xylophones et kiosques : 12 xérus zébrés exhibés au Zambèze - inconstitutionnalité paradoxale et kleptomanie lexicale (dossier n°42bis).'
      ]
    },
    ar: {
      easy: [
        'الشمس تشرق في الصباح الباكر والطيور تغرد بصوت جميل فوق الأشجار العالية والأطفال يلعبون في الحديقة بسعادة وفرح طوال اليوم',
        'أمي تطبخ طعاما لذيذا جدا كل يوم وأبي يقرأ الصحيفة في المساء ونحن نجلس معا في غرفة الجلوس نشرب الشاي الساخن ونتحدث بفرح كبير',
        'القط الصغير الأبيض ينام على السجادة الناعمة والكلب النشيط يلعب في الفناء الواسع بالكرة الحمراء ويشرب الحليب من وعاء كبير',
        'ذهبنا إلى البحر الجميل في فصل الصيف وسبحنا في الماء البارد النظيف ولعبنا بالرمل الذهبي وبنينا قلعة جميلة وكبيرة مع أصدقائنا الصغار',
        'المدرسة قريبة جدا من بيتنا نذهب إليها كل صباح مبكرا نتعلم القراءة والحساب والعلوم ونلعب مع أصدقائنا الجدد في الساحة الواسعة كل يوم'
      ],
      medium: [
        'في الصباح الباكر، خرج الفلاح النشيط إلى حقله الواسع. زرع القمح والشعير، وسقى الأشجار الكثيرة، ثم عاد إلى بيته متعبا وسعيدا.',
        'سألت سارة أمها بفرح: هل نذهب إلى السوق الكبير اليوم؟ قالت الأم: نعم، سنشتري الخبز الساخن والفواكه والخضار الطازجة قبل الظهر.',
        'بغداد مدينة عريقة وقديمة على نهر دجلة الخالد، فيها أسواق شعبية قديمة ومساجد جميلة. يزورها الناس من كل مكان في فصل الربيع.',
        'عندما هطل المطر بغزارة شديدة، امتلأت الشوارع الواسعة بالماء. أسرع الأطفال الصغار إلى بيوتهم، وأغلق التجار دكاكينهم حتى توقف المطر. وبقيت الغيوم في السماء حتى المساء، ثم خرج الأطفال للعب من جديد.',
        'قال المعلم الحكيم لتلاميذه الصغار: من يقرأ الدرس جيدا؟ رفع أحمد يده بسرعة، وقرأ بصوت واضح وجميل، فصفق له الجميع وشجعه المعلم كثيرا.'
      ],
      hard: [
        'استضافت المكتبة المركزية ١٢٤٥ قارئا عام ١٤٤٧هـ، وفهرست ٣٦٧٨٩ مجلدا في ٢٣ قاعة كبيرة (راجع ص ٤٥-٩٨)!!! نسبة الاستعارة بلغت ٩٩.٧٪ @ ٣:٤٠م، وشارك ٣٢٠ باحثا من ١٢ دولة في الندوة الختامية.',
        'بموجب المادة ١٣/ب (فقرة ٤) صادق ٥٦ عضوا من المجلس على الميزانية: ٢٥٠٠٠٠٠ دينار + ٣/٤ الرسوم - استثنائية فوق دستورية؟ نعم!!!',
        'الاستشعار عن بعد عبر ٦٤ قمرا صناعيا @ تردد ٥١٢: دقة ١٠٢٤ بكسل، ومعدل نجاح ٩٩.٩٧٪!!! البريد: مختبر_٤٢@مثال.نت - تواصل الآن.',
        'قال المؤرخ الكبير (ت ٧٨٩هـ) في ١٧ مجلدا ضخما: ٥٠٠٠ صفحة و٢٥٦ خريطة و١٢ فهرسا - فاستبقوا الخيرات وتزودوا فإن خير الزاد التقوى!!!',
        'تظهر الإحصاءات الرسمية ٨٧.٥٪ نموا كبيرا: ٣٤٥ مصنعا + ١٢٠٩ متاجر = ١٥٥٤ منشأة (٢٠٢٤-٢٠٢٦م)؛ استدامة مفرطة واستشراف مستقبلي!!!'
      ]
    }
  };

  var VALID_LANGS = ['en', 'fr', 'ar'];
  var VALID_DIFFS = ['easy', 'medium', 'hard'];

  function normLang(lang) {
    if (typeof lang === 'string' && VALID_LANGS.indexOf(lang.toLowerCase()) >= 0) {
      return lang.toLowerCase();
    }
    return 'en';
  }

  function normDiff(diff) {
    if (typeof diff === 'string' && VALID_DIFFS.indexOf(diff.toLowerCase()) >= 0) {
      return diff.toLowerCase();
    }
    return 'easy';
  }

  /* Random non-repeating pick. Returns { text, idx }. */
  function pick(lang, diff, excludeIdx) {
    var l = normLang(lang);
    var d = normDiff(diff);
    var pool = TEXTS[l] && TEXTS[l][d];
    if (!Array.isArray(pool) || pool.length === 0) {
      pool = TEXTS.en.easy;
    }
    var idx = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && idx === excludeIdx) {
      idx = (idx + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length;
    }
    return { text: pool[idx], idx: idx };
  }

  if (typeof window !== 'undefined') {
    window.TYPELY_TEXTS = TEXTS;
    window.TypelyPick = pick;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TYPELY_TEXTS: TEXTS, TypelyPick: pick };
  }
})();
