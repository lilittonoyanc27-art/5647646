import React, { useState, useEffect, useCallback, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Volume2,
  VolumeX,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Languages,
  Eye,
  EyeOff,
  Trophy,
  ArrowRight,
  Filter,
  Search,
  BookMarked,
} from 'lucide-react';

// ==========================================
// 1. DATA TYPES & AUDIO UTILS
// ==========================================

export interface Question {
  id: number;
  part: 1 | 2;
  number: number;
  label: string;
  armenian: string;
  spanish: string;
  tense: string;
  tenseType: 'pasado' | 'subjuntivo';
  options: {
    key: 'A' | 'B' | 'C' | 'D';
    text: string;
  }[];
  correct: 'A' | 'B' | 'C' | 'D';
  explanationEs: string;
  explanationArm: string;
}

const ROSCO_LETTERS_30 = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'Ñ', 'O', 'P', 'Q', 'R', 'S',
  'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '1', '2', '3'
];

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

const playSound = {
  acierto: (enabled = true) => {
    if (!enabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(783.99, now); // G5
      osc1.frequency.setValueAtTime(1046.5, now + 0.12); // C6
      osc2.frequency.setValueAtTime(1567.98, now);
      osc2.frequency.setValueAtTime(2093.0, now + 0.12);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.45);
      osc2.stop(now + 0.45);
    } catch {
      // Audio silent fallback
    }
  },

  fallo: (enabled = true) => {
    if (!enabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(120, now + 0.28);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // Audio silent fallback
    }
  },

  pasapalabra: (enabled = true) => {
    if (!enabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.18);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // Audio silent fallback
    }
  },

  victory: (enabled = true) => {
    if (!enabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.5];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.01, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.22, now + idx * 0.1 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.5);
      });
    } catch {
      // Audio silent fallback
    }
  },
};

function speakSpanish(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech synthesis fallback
  }
}

// ==========================================
// 2. 60 QUESTIONS DATASET
// ==========================================

export const QUESTIONS: Question[] = [
  // ЧАСТЬ 1: LOS TIEMPOS DEL PASADO (30)
  {
    id: 1,
    part: 1,
    number: 1,
    label: ROSCO_LETTERS_30[0],
    armenian: 'Այսօր ես արդեն խոսել եմ ուսուցչիս հետ։',
    spanish: 'Hoy ya ___ con mi profesor.',
    tense: 'Pretérito Perfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'hablé' },
      { key: 'B', text: 'hablaba' },
      { key: 'C', text: 'he hablado' },
      { key: 'D', text: 'había hablado' },
    ],
    correct: 'C',
    explanationEs: 'Pretérito Perfecto: Se usa con "hoy", ya que el período de tiempo aún no ha concluido.',
    explanationArm: 'Pretérito Perfecto. Օգտագործվում է «hoy» (այսօր) ցուցիչի հետ, քանի որ օրը դեռ չի ավարտվել։',
  },
  {
    id: 2,
    part: 1,
    number: 2,
    label: ROSCO_LETTERS_30[1],
    armenian: 'Երեկ մենք գնացինք կինոթատրոն։',
    spanish: 'Ayer nosotros ___ al cine.',
    tense: 'Pretérito Indefinido',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'hemos ido' },
      { key: 'B', text: 'íbamos' },
      { key: 'C', text: 'habíamos ido' },
      { key: 'D', text: 'fuimos' },
    ],
    correct: 'D',
    explanationEs: 'Pretérito Indefinido: Acción puntual en un tiempo pasado completamente terminado ("ayer").',
    explanationArm: 'Pretérito Indefinido. Ավարտված գործողություն ավարտված ժամանակահատվածում («ayer»՝ երեկ)։',
  },
  {
    id: 3,
    part: 1,
    number: 3,
    label: ROSCO_LETTERS_30[2],
    armenian: 'Երբ փոքր էի, ամեն ամառ գնում էի գյուղ։',
    spanish: 'Cuando era pequeño, ___ al pueblo todos los veranos.',
    tense: 'Pretérito Imperfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'fui' },
      { key: 'B', text: 'iba' },
      { key: 'C', text: 'he ido' },
      { key: 'D', text: 'había ido' },
    ],
    correct: 'B',
    explanationEs: 'Pretérito Imperfecto: Expresa una acción habitual o repetitiva en el pasado ("todos los veranos").',
    explanationArm: 'Pretérito Imperfecto. Անցյալում կրկնվող, սովորական գործողություն («todos los veranos»՝ ամեն ամառ)։',
  },
  {
    id: 4,
    part: 1,
    number: 4,
    label: ROSCO_LETTERS_30[3],
    armenian: 'Երբ հասա, ֆիլմն արդեն սկսվել էր։',
    spanish: 'Cuando llegué, la película ya ___.',
    tense: 'Pretérito Pluscuamperfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'empezaba' },
      { key: 'B', text: 'empezó' },
      { key: 'C', text: 'ha empezado' },
      { key: 'D', text: 'había empezado' },
    ],
    correct: 'D',
    explanationEs: 'Pretérito Pluscuamperfecto: Acción pasada anterior a otra acción también pasada ("cuando llegué").',
    explanationArm: 'Pretérito Pluscuamperfecto. Գործողություն, որը տեղի է ունեցել մեկ այլ անցյալ գործողությունից առաջ («երբ հասա»)։',
  },
  {
    id: 5,
    part: 1,
    number: 5,
    label: ROSCO_LETTERS_30[4],
    armenian: 'Անցյալ տարի նա տեղափոխվեց Մադրիդ։',
    spanish: 'El año pasado ella se ___ a Madrid.',
    tense: 'Pretérito Indefinido',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'ha mudado' },
      { key: 'B', text: 'mudó' },
      { key: 'C', text: 'mudaba' },
      { key: 'D', text: 'había mudado' },
    ],
    correct: 'B',
    explanationEs: 'Pretérito Indefinido: Acción cerrada y puntual en un período de tiempo ya concluido ("el año pasado").',
    explanationArm: 'Pretérito Indefinido. Կոնկրետ ավարտված գործողություն անցյալում («el año pasado»՝ անցյալ տարի)։',
  },
  {
    id: 6,
    part: 1,
    number: 6,
    label: ROSCO_LETTERS_30[5],
    armenian: 'Այս շաբաթ մենք շատ ենք աշխատել։',
    spanish: 'Esta semana ___ mucho.',
    tense: 'Pretérito Perfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'trabajamos' },
      { key: 'B', text: 'trabajábamos' },
      { key: 'C', text: 'hemos trabajado' },
      { key: 'D', text: 'habíamos trabajado' },
    ],
    correct: 'C',
    explanationEs: 'Pretérito Perfecto: Se utiliza con "esta semana", período temporal que aún no ha terminado.',
    explanationArm: 'Pretérito Perfecto. Օգտագործվում է «esta semana» (այս շաբաթ) դեռ չավարտված ժամանակի հետ։',
  },
  {
    id: 7,
    part: 1,
    number: 7,
    label: ROSCO_LETTERS_30[6],
    armenian: 'Նախկինում նա ամեն օր գիրք էր կարդում։',
    spanish: 'Antes ella ___ un libro todos los días.',
    tense: 'Pretérito Imperfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'leía' },
      { key: 'B', text: 'leyó' },
      { key: 'C', text: 'ha leído' },
      { key: 'D', text: 'había leído' },
    ],
    correct: 'A',
    explanationEs: 'Pretérito Imperfecto: Describe una rutina o hábito continuo en el pasado con el marcador "antes".',
    explanationArm: 'Pretérito Imperfecto. Նկարագրում է անցյալի սովորություն («antes»՝ նախկինում, «todos los días»՝ ամեն օր)։',
  },
  {
    id: 8,
    part: 1,
    number: 8,
    label: ROSCO_LETTERS_30[7],
    armenian: 'Երբ նա զանգեց, ես արդեն ավարտել էի աշխատանքս։',
    spanish: 'Cuando llamó, yo ya ___ mi trabajo.',
    tense: 'Pretérito Pluscuamperfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'terminé' },
      { key: 'B', text: 'terminaba' },
      { key: 'C', text: 'he terminado' },
      { key: 'D', text: 'había terminado' },
    ],
    correct: 'D',
    explanationEs: 'Pretérito Pluscuamperfecto: La acción de terminar el trabajo ocurrió antes de la llamada.',
    explanationArm: 'Pretérito Pluscuamperfecto. Աշխատանքն ավարտելը տեղի էր ունեցել զանգահարելու պահից առաջ։',
  },
  {
    id: 9,
    part: 1,
    number: 9,
    label: ROSCO_LETTERS_30[8],
    armenian: 'Երկու օր առաջ մենք հետաքրքիր թանգարան այցելեցինք։',
    spanish: 'Hace dos días ___ un museo interesante.',
    tense: 'Pretérito Indefinido',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'visitábamos' },
      { key: 'B', text: 'visitamos' },
      { key: 'C', text: 'hemos visitado' },
      { key: 'D', text: 'habíamos visitado' },
    ],
    correct: 'B',
    explanationEs: 'Pretérito Indefinido: Se usa con "hace dos días", momento temporal específico y cerrado.',
    explanationArm: 'Pretérito Indefinido. «Hace dos días» (երկու օր առաջ) ցույց է տալիս կոնկրետ ավարտված անցյալ պահ։',
  },
  {
    id: 10,
    part: 1,
    number: 10,
    label: ROSCO_LETTERS_30[9],
    armenian: 'Դու երբևէ եղե՞լ ես Սևիլիայում։',
    spanish: '¿Alguna vez ___ en Sevilla?',
    tense: 'Pretérito Perfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'estuviste' },
      { key: 'B', text: 'estabas' },
      { key: 'C', text: 'has estado' },
      { key: 'D', text: 'habías estado' },
    ],
    correct: 'C',
    explanationEs: 'Pretérito Perfecto: Pregunta por una experiencia vital en cualquier momento de la vida ("alguna vez").',
    explanationArm: 'Pretérito Perfecto. «Alguna vez» (երբևէ) արտահայտությունը հարցնում է կյանքի ընթացքում ունեցած փորձի մասին։',
  },
  {
    id: 11,
    part: 1,
    number: 11,
    label: ROSCO_LETTERS_30[10],
    armenian: 'Երբ նա երեխա էր, շատ ամաչկոտ էր։',
    spanish: 'Cuando era niño, ___ muy tímido.',
    tense: 'Pretérito Imperfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'fue' },
      { key: 'B', text: 'era' },
      { key: 'C', text: 'ha sido' },
      { key: 'D', text: 'había sido' },
    ],
    correct: 'B',
    explanationEs: 'Pretérito Imperfecto: Se usa para descripciones de rasgos o estados en el pasado.',
    explanationArm: 'Pretérito Imperfecto. Օգտագործվում է անցյալում բնավորության գծի կամ վիճակի նկարագրության համար։',
  },
  {
    id: 12,
    part: 1,
    number: 12,
    label: ROSCO_LETTERS_30[11],
    armenian: 'Ես չկարողացա գտնել բանալիները, որովհետև դրանք տանն էի թողել։',
    spanish: 'No pude encontrar las llaves porque las ___ en casa.',
    tense: 'Pretérito Pluscuamperfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'dejaba' },
      { key: 'B', text: 'dejé' },
      { key: 'C', text: 'he dejado' },
      { key: 'D', text: 'había dejado' },
    ],
    correct: 'D',
    explanationEs: 'Pretérito Pluscuamperfecto: Dejar las llaves sucedió con anterioridad al intento de encontrarlas.',
    explanationArm: 'Pretérito Pluscuamperfecto. Բանալիները թողնելը տեղի էր ունեցել դրանք փնտրելուց առաջ։',
  },
  {
    id: 13,
    part: 1,
    number: 13,
    label: ROSCO_LETTERS_30[12],
    armenian: 'Անցյալ կիրակի մենք ամբողջ օրը հանգստացանք։',
    spanish: 'El domingo pasado ___ todo el día.',
    tense: 'Pretérito Indefinido',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'descansamos' },
      { key: 'B', text: 'descansábamos' },
      { key: 'C', text: 'hemos descansado' },
      { key: 'D', text: 'habíamos descansado' },
    ],
    correct: 'A',
    explanationEs: 'Pretérito Indefinido: Acción con inicio y final acotado en un marco temporal concluido ("el domingo pasado").',
    explanationArm: 'Pretérito Indefinido. Ավարտված գործողություն ավարտված ժամանակահատվածում («el domingo pasado»)։',
  },
  {
    id: 14,
    part: 1,
    number: 14,
    label: ROSCO_LETTERS_30[13],
    armenian: 'Այսօր առավոտյան ես երկու հաղորդագրություն եմ ստացել։',
    spanish: 'Esta mañana ___ dos mensajes.',
    tense: 'Pretérito Perfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'recibía' },
      { key: 'B', text: 'recibí' },
      { key: 'C', text: 'he recibido' },
      { key: 'D', text: 'había recibido' },
    ],
    correct: 'C',
    explanationEs: 'Pretérito Perfecto: "Esta mañana" se percibe como parte de la jornada presente aún no terminada.',
    explanationArm: 'Pretérito Perfecto. «Esta mañana» (այսօր առավոտյան) համարվում է ընթացիկ օրվա մի մաս։',
  },
  {
    id: 15,
    part: 1,
    number: 15,
    label: ROSCO_LETTERS_30[14],
    armenian: 'Մինչ մայրս ճաշ էր պատրաստում, ես դասերս էի անում։',
    spanish: 'Mientras mi madre cocinaba, yo ___ los deberes.',
    tense: 'Pretérito Imperfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'hice' },
      { key: 'B', text: 'hacía' },
      { key: 'C', text: 'he hecho' },
      { key: 'D', text: 'había hecho' },
    ],
    correct: 'B',
    explanationEs: 'Pretérito Imperfecto: Dos acciones continuas y simultáneas en el pasado unidas por "mientras".',
    explanationArm: 'Pretérito Imperfecto. Երկու զուգահեռ, շարունակական գործողություններ անցյալում («mientras»՝ մինչդեռ)։',
  },
  {
    id: 16,
    part: 1,
    number: 16,
    label: ROSCO_LETTERS_30[15],
    armenian: 'Երբ հյուրերը եկան, մենք արդեն սեղանը պատրաստել էինք։',
    spanish: 'Cuando llegaron los invitados, ya ___ la mesa.',
    tense: 'Pretérito Pluscuamperfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'preparábamos' },
      { key: 'B', text: 'preparamos' },
      { key: 'C', text: 'hemos preparado' },
      { key: 'D', text: 'habíamos preparado' },
    ],
    correct: 'D',
    explanationEs: 'Pretérito Pluscuamperfecto: Acción terminada con anterioridad a la llegada de los invitados.',
    explanationArm: 'Pretérito Pluscuamperfecto. Սեղանը պատրաստելու գործողությունը տեղի էր ունեցել հյուրերի գալուց առաջ։',
  },
  {
    id: 17,
    part: 1,
    number: 17,
    label: ROSCO_LETTERS_30[16],
    armenian: 'Երեկ ես պատահաբար հանդիպեցի հին ընկերոջս։',
    spanish: 'Ayer me ___ con un viejo amigo por casualidad.',
    tense: 'Pretérito Indefinido',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'encontraba' },
      { key: 'B', text: 'he encontrado' },
      { key: 'C', text: 'encontré' },
      { key: 'D', text: 'había encontrado' },
    ],
    correct: 'C',
    explanationEs: 'Pretérito Indefinido: Suceso puntual e inesperado acontecido en un momento pasado concreto ("ayer").',
    explanationArm: 'Pretérito Indefinido. Միանվագ դեպք երեկվա ավարտված օրվա մեջ («ayer»)։',
  },
  {
    id: 18,
    part: 1,
    number: 18,
    label: ROSCO_LETTERS_30[17],
    armenian: 'Վերջերս ես մի քանի հետաքրքիր ֆիլմ եմ դիտել։',
    spanish: 'Últimamente ___ varias películas interesantes.',
    tense: 'Pretérito Perfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'vi' },
      { key: 'B', text: 'veía' },
      { key: 'C', text: 'he visto' },
      { key: 'D', text: 'había visto' },
    ],
    correct: 'C',
    explanationEs: 'Pretérito Perfecto: Se emplea con el marcador temporal "últimamente", vinculado al presente.',
    explanationArm: 'Pretérito Perfecto. «Últimamente» (վերջերս) ցուցիչը կապված է ներկայի հետ։',
  },
  {
    id: 19,
    part: 1,
    number: 19,
    label: ROSCO_LETTERS_30[18],
    armenian: 'Այն ժամանակ մենք ապրում էինք ծովի մոտ։',
    spanish: 'En aquella época ___ cerca del mar.',
    tense: 'Pretérito Imperfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'vivíamos' },
      { key: 'B', text: 'vivimos' },
      { key: 'C', text: 'hemos vivido' },
      { key: 'D', text: 'habíamos vivido' },
    ],
    correct: 'A',
    explanationEs: 'Pretérito Imperfecto: Expresa un estado o situación prolongada en el pasado ("en aquella época").',
    explanationArm: 'Pretérito Imperfecto. Նկարագրում է անցյալում տևական վիճակ («en aquella época»՝ այն ժամանակ)։',
  },
  {
    id: 20,
    part: 1,
    number: 20,
    label: ROSCO_LETTERS_30[19],
    armenian: 'Նա արդեն գնացել էր, երբ ես եկա։',
    spanish: 'Él ya se ___ cuando yo llegué.',
    tense: 'Pretérito Pluscuamperfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'iba' },
      { key: 'B', text: 'fue' },
      { key: 'C', text: 'ha ido' },
      { key: 'D', text: 'había ido' },
    ],
    correct: 'D',
    explanationEs: 'Pretérito Pluscuamperfecto: Su partida ocurrió antes de mi llegada al lugar.',
    explanationArm: 'Pretérito Pluscuamperfecto. Նրա հեռանալը տեղի էր ունեցել իմ գալուց առաջ։',
  },
  {
    id: 21,
    part: 1,
    number: 21,
    label: ROSCO_LETTERS_30[20],
    armenian: 'Անցյալ շաբաթ նրանք նոր մեքենա գնեցին։',
    spanish: 'La semana pasada ellos ___ un coche nuevo.',
    tense: 'Pretérito Indefinido',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'han comprado' },
      { key: 'B', text: 'compraban' },
      { key: 'C', text: 'compraron' },
      { key: 'D', text: 'habían comprado' },
    ],
    correct: 'C',
    explanationEs: 'Pretérito Indefinido: Acción puntual completada en un intervalo terminado ("la semana pasada").',
    explanationArm: 'Pretérito Indefinido. «La semana pasada» (անցյալ շաբաթ) ավարտված ժամանակահատված է։',
  },
  {
    id: 22,
    part: 1,
    number: 22,
    label: ROSCO_LETTERS_30[21],
    armenian: 'Վերջին օրերին ես շատ բան եմ սովորել։',
    spanish: 'En los últimos días ___ muchas cosas.',
    tense: 'Pretérito Perfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'aprendí' },
      { key: 'B', text: 'aprendía' },
      { key: 'C', text: 'había aprendido' },
      { key: 'D', text: 'he aprendido' },
    ],
    correct: 'D',
    explanationEs: 'Pretérito Perfecto: Se usa con "en los últimos días", que incluye el presente inmediato.',
    explanationArm: 'Pretérito Perfecto. «En los últimos días» (վերջին օրերին) վերաբերում է ներկային մոտ շրջանին։',
  },
  {
    id: 23,
    part: 1,
    number: 23,
    label: ROSCO_LETTERS_30[22],
    armenian: 'Երբ տատիկիս այցելում էի, նա միշտ հետաքրքիր պատմություններ էր պատմում։',
    spanish: 'Cuando visitaba a mi abuela, siempre me ___ historias interesantes.',
    tense: 'Pretérito Imperfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'contó' },
      { key: 'B', text: 'contaba' },
      { key: 'C', text: 'ha contado' },
      { key: 'D', text: 'había contado' },
    ],
    correct: 'B',
    explanationEs: 'Pretérito Imperfecto: Expresa una costumbre repetida en el pasado reforzada por "siempre".',
    explanationArm: 'Pretérito Imperfecto. Կրկնվող սովորություն անցյալում («siempre»՝ միշտ)։',
  },
  {
    id: 24,
    part: 1,
    number: 24,
    label: ROSCO_LETTERS_30[23],
    armenian: 'Մենք չէինք կարող մտնել, որովհետև մոռացել էինք տոմսերը։',
    spanish: 'No podíamos entrar porque ___ las entradas.',
    tense: 'Pretérito Pluscuamperfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'olvidamos' },
      { key: 'B', text: 'olvidábamos' },
      { key: 'C', text: 'hemos olvidado' },
      { key: 'D', text: 'habíamos olvidado' },
    ],
    correct: 'D',
    explanationEs: 'Pretérito Pluscuamperfecto: Olvidar las entradas fue el hecho previo que impidió la entrada.',
    explanationArm: 'Pretérito Pluscuamperfecto. Տոմսերը մոռանալը տեղի էր ունեցել նախքան մուտք գործելու փորձը։',
  },
  {
    id: 25,
    part: 1,
    number: 25,
    label: ROSCO_LETTERS_30[24],
    armenian: 'Երեկ երեկոյան ես շատ համեղ բան պատրաստեցի։',
    spanish: 'Anoche ___ algo muy rico.',
    tense: 'Pretérito Indefinido',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'cocinaba' },
      { key: 'B', text: 'cociné' },
      { key: 'C', text: 'he cocinado' },
      { key: 'D', text: 'había cocinado' },
    ],
    correct: 'B',
    explanationEs: 'Pretérito Indefinido: Acción puntual en una noche concluida ("anoche").',
    explanationArm: 'Pretérito Indefinido. «Anoche» (երեկ գիշեր/երեկոյան) պահանջում է Indefinido։',
  },
  {
    id: 26,
    part: 1,
    number: 26,
    label: ROSCO_LETTERS_30[25],
    armenian: 'Այս ամիս ես երեք գիրք եմ կարդացել։',
    spanish: 'Este mes ___ tres libros.',
    tense: 'Pretérito Perfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'leí' },
      { key: 'B', text: 'leía' },
      { key: 'C', text: 'he leído' },
      { key: 'D', text: 'había leído' },
    ],
    correct: 'C',
    explanationEs: 'Pretérito Perfecto: Se usa con "este mes", unidad de tiempo no finalizada.',
    explanationArm: 'Pretérito Perfecto. «Este mes» (այս ամիս) ընթացիկ, դեռ չավարտված ժամանակ է։',
  },
  {
    id: 27,
    part: 1,
    number: 27,
    label: ROSCO_LETTERS_30[26],
    armenian: 'Երբ մենք երիտասարդ էինք, հաճախ էինք միասին ճանապարհորդում։',
    spanish: 'Cuando éramos jóvenes, ___ juntos con frecuencia.',
    tense: 'Pretérito Imperfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'viajamos' },
      { key: 'B', text: 'viajábamos' },
      { key: 'C', text: 'hemos viajado' },
      { key: 'D', text: 'habíamos viajado' },
    ],
    correct: 'B',
    explanationEs: 'Pretérito Imperfecto: Hábito o frecuencia en una etapa pasada de la vida ("con frecuencia").',
    explanationArm: 'Pretérito Imperfecto. Անցյալում հաճախ կրկնվող գործողություն («con frecuencia»՝ հաճախ)։',
  },
  {
    id: 28,
    part: 1,
    number: 28,
    label: ROSCO_LETTERS_30[27],
    armenian: 'Երբ հասանք ռեստորան, մեր ընկերներն արդեն պատվիրել էին։',
    spanish: 'Cuando llegamos al restaurante, nuestros amigos ya ___.',
    tense: 'Pretérito Pluscuamperfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'pidieron' },
      { key: 'B', text: 'pedían' },
      { key: 'C', text: 'han pedido' },
      { key: 'D', text: 'habían pedido' },
    ],
    correct: 'D',
    explanationEs: 'Pretérito Pluscuamperfecto: El pedido se realizó antes de nuestra llegada.',
    explanationArm: 'Pretérito Pluscuamperfecto. Պատվիրելը տեղի էր ունեցել նախքան մեր ռեստորան հասնելը։',
  },
  {
    id: 29,
    part: 1,
    number: 29,
    label: ROSCO_LETTERS_30[28],
    armenian: 'Անցյալ ամառ մենք երկու շաբաթ անցկացրինք Վալենսիայում։',
    spanish: 'El verano pasado ___ dos semanas en Valencia.',
    tense: 'Pretérito Indefinido',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'pasamos' },
      { key: 'B', text: 'pasábamos' },
      { key: 'C', text: 'hemos pasado' },
      { key: 'D', text: 'habíamos pasado' },
    ],
    correct: 'A',
    explanationEs: 'Pretérito Indefinido: Duración delimitada y concluida en el pasado ("el verano pasado").',
    explanationArm: 'Pretérito Indefinido. Կոնկրետ ավարտված ժամանակահատված անցյալում («el verano pasado»)։',
  },
  {
    id: 30,
    part: 1,
    number: 30,
    label: ROSCO_LETTERS_30[29],
    armenian: 'Մինչ դու եկար, ես արդեն լվացել էի բոլոր սպասքները։',
    spanish: 'Antes de que llegaras, yo ya ___ todos los platos.',
    tense: 'Pretérito Pluscuamperfecto',
    tenseType: 'pasado',
    options: [
      { key: 'A', text: 'lavé' },
      { key: 'B', text: 'lavaba' },
      { key: 'C', text: 'he lavado' },
      { key: 'D', text: 'había lavado' },
    ],
    correct: 'D',
    explanationEs: 'Pretérito Pluscuamperfecto: Acción finalizada con anterioridad a la llegada de la otra persona.',
    explanationArm: 'Pretérito Pluscuamperfecto. Սպասքը լվանալն ավարտվել էր մինչև դիմացինի գալը։',
  },

  // ЧАСТЬ 2: MODO SUBJUNTIVO (30)
  {
    id: 31,
    part: 2,
    number: 1,
    label: ROSCO_LETTERS_30[0],
    armenian: 'Ես ուզում եմ, որ դու ինձ ճշմարտությունն ասես։',
    spanish: 'Quiero que me ___ la verdad.',
    tense: 'Presente de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'dices' },
      { key: 'B', text: 'digas' },
      { key: 'C', text: 'dijiste' },
      { key: 'D', text: 'has dicho' },
    ],
    correct: 'B',
    explanationEs: 'Presente de Subjuntivo: Verbo de deseo ("Quiero que") exige Subjuntivo (decir -> digas).',
    explanationArm: 'Presente de Subjuntivo. Ցանկություն արտահայտող բայից հետո («Quiero que») պահանջվում է digas։',
  },
  {
    id: 32,
    part: 2,
    number: 2,
    label: ROSCO_LETTERS_30[1],
    armenian: 'Հուսով եմ, որ նա վաղը կգա։',
    spanish: 'Espero que mañana ___.',
    tense: 'Presente de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'viene' },
      { key: 'B', text: 'vino' },
      { key: 'C', text: 'venga' },
      { key: 'D', text: 'vendría' },
    ],
    correct: 'C',
    explanationEs: 'Presente de Subjuntivo: Expresión de esperanza ("Espero que") hacia una acción futura (venir -> venga).',
    explanationArm: 'Presente de Subjuntivo. Հույս արտահայտող «Espero que» կառույցից հետո գործածվում է Subjuntivo (venga)։',
  },
  {
    id: 33,
    part: 2,
    number: 3,
    label: ROSCO_LETTERS_30[2],
    armenian: 'Ուրախ եմ, որ դու արդեն ավարտել ես աշխատանքդ։',
    spanish: 'Me alegra que ya ___ tu trabajo.',
    tense: 'Pretérito Perfecto de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'has terminado' },
      { key: 'B', text: 'terminaras' },
      { key: 'C', text: 'hubieras terminado' },
      { key: 'D', text: 'hayas terminado' },
    ],
    correct: 'D',
    explanationEs: 'Pretérito Perfecto de Subjuntivo: Sentimiento en presente hacia una acción ya culminada (hayas terminado).',
    explanationArm: 'Pretérito Perfecto de Subjuntivo. Ուրախության զգացմունք արդեն ավարտված գործողության նկատմամբ (hayas terminado)։',
  },
  {
    id: 34,
    part: 2,
    number: 4,
    label: ROSCO_LETTERS_30[3],
    armenian: 'Ես ուզում էի, որ դու ինձ ավելի հաճախ զանգեիր։',
    spanish: 'Quería que me ___ más a menudo.',
    tense: 'Imperfecto de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'llamaras' },
      { key: 'B', text: 'llames' },
      { key: 'C', text: 'llamas' },
      { key: 'D', text: 'has llamado' },
    ],
    correct: 'A',
    explanationEs: 'Imperfecto de Subjuntivo: Pasado imperfecto ("Quería que") rige Imperfecto de Subjuntivo (llamaras).',
    explanationArm: 'Imperfecto de Subjuntivo. Գլխավոր նախադասության անցյալ բայից հետո («Quería que») պահանջվում է llamaras։',
  },
  {
    id: 35,
    part: 2,
    number: 5,
    label: ROSCO_LETTERS_30[4],
    armenian: 'Ես ուրախ էի, որ դու եկել էիր իմ ծննդյան տարեդարձին։',
    spanish: 'Me alegró que ___ a mi cumpleaños.',
    tense: 'Pluscuamperfecto de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'has venido' },
      { key: 'B', text: 'vengas' },
      { key: 'C', text: 'hubieras venido' },
      { key: 'D', text: 'vienes' },
    ],
    correct: 'C',
    explanationEs: 'Pluscuamperfecto de Subjuntivo: Acción concluida anterior a una emoción en pasado (hubieras venido).',
    explanationArm: 'Pluscuamperfecto de Subjuntivo. Անցյալում տեղի ունեցած գործողության նկատմամբ վերաբերմունք (hubieras venido)։',
  },
  {
    id: 36,
    part: 2,
    number: 6,
    label: ROSCO_LETTERS_30[5],
    armenian: 'Կարևոր է, որ բոլորը ժամանակին հասնեն։',
    spanish: 'Es importante que todos ___ a tiempo.',
    tense: 'Presente de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'llegan' },
      { key: 'B', text: 'lleguen' },
      { key: 'C', text: 'llegaron' },
      { key: 'D', text: 'llegarían' },
    ],
    correct: 'B',
    explanationEs: 'Presente de Subjuntivo: Estructura impersonal valorativa ("Es importante que") requiere Subjuntivo (lleguen).',
    explanationArm: 'Presente de Subjuntivo. Անդեմ գնահատողական կառույց («Es importante que») + Subjuntivo (lleguen)։',
  },
  {
    id: 37,
    part: 2,
    number: 7,
    label: ROSCO_LETTERS_30[6],
    armenian: 'Չեմ կարծում, որ նա հիմա տանն է։',
    spanish: 'No creo que ahora ___ en casa.',
    tense: 'Presente de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'está' },
      { key: 'B', text: 'estuvo' },
      { key: 'C', text: 'esté' },
      { key: 'D', text: 'estaría' },
    ],
    correct: 'C',
    explanationEs: 'Presente de Subjuntivo: Opinión negada ("No creo que") introduce duda y exige Subjuntivo (esté).',
    explanationArm: 'Presente de Subjuntivo. Ժխտված կարծիքը («No creo que») պահանջում է Subjuntivo (esté)։',
  },
  {
    id: 38,
    part: 2,
    number: 8,
    label: ROSCO_LETTERS_30[7],
    armenian: 'Ես կասկածում եմ, որ նրանք արդեն որոշում են կայացրել։',
    spanish: 'Dudo que ya ___ una decisión.',
    tense: 'Pretérito Perfecto de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'han tomado' },
      { key: 'B', text: 'tomaran' },
      { key: 'C', text: 'habían tomado' },
      { key: 'D', text: 'hayan tomado' },
    ],
    correct: 'D',
    explanationEs: 'Pretérito Perfecto de Subjuntivo: Verbo de duda ("Dudo que") ante una acción pasada con "ya" (hayan tomado).',
    explanationArm: 'Pretérito Perfecto de Subjuntivo. Կասկած արտահայտող բայ («Dudo que») + ավարտված գործողություն (hayan tomado)։',
  },
  {
    id: 39,
    part: 2,
    number: 9,
    label: ROSCO_LETTERS_30[8],
    armenian: 'Ուսուցիչն ուզում էր, որ աշակերտները ավելի շատ պարապեին։',
    spanish: 'El profesor quería que los alumnos ___ más.',
    tense: 'Imperfecto de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'practicaran' },
      { key: 'B', text: 'practiquen' },
      { key: 'C', text: 'practican' },
      { key: 'D', text: 'han practicado' },
    ],
    correct: 'A',
    explanationEs: 'Imperfecto de Subjuntivo: Deseo expresado en pasado ("quería que") rige Imperfecto de Subjuntivo (practicaran).',
    explanationArm: 'Imperfecto de Subjuntivo. Անցյալում արտահայտված ցանկություն («quería que») + practicaran։',
  },
  {
    id: 40,
    part: 2,
    number: 10,
    label: ROSCO_LETTERS_30[9],
    armenian: 'Ափսոս, որ երեկ դու չկարողացար գալ։',
    spanish: 'Es una pena que ayer no ___ venir.',
    tense: 'Pretérito Perfecto de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'puedes' },
      { key: 'B', text: 'hayas podido' },
      { key: 'C', text: 'hubieras podido' },
      { key: 'D', text: 'podrás' },
    ],
    correct: 'B',
    explanationEs: 'Pretérito Perfecto de Subjuntivo: Reacción emocional ("Es una pena que") ante un hecho pasado (hayas podido).',
    explanationArm: 'Pretérito Perfecto de Subjuntivo. Զգացմունք արտահայտող արտահայտություն («Es una pena que») + hayas podido։',
  },
  {
    id: 41,
    part: 2,
    number: 11,
    label: ROSCO_LETTERS_30[10],
    armenian: 'Ես խորհուրդ եմ տալիս, որ դու ավելի շատ հանգստանաս։',
    spanish: 'Te aconsejo que ___ más.',
    tense: 'Presente de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'descansas' },
      { key: 'B', text: 'descansaste' },
      { key: 'C', text: 'descanses' },
      { key: 'D', text: 'descansarías' },
    ],
    correct: 'C',
    explanationEs: 'Presente de Subjuntivo: Verbo de consejo ("Te aconsejo que") exige Subjuntivo (descanses).',
    explanationArm: 'Presente de Subjuntivo. Խորհուրդ տալու բայ («Te aconsejo que») + descanses։',
  },
  {
    id: 42,
    part: 2,
    number: 12,
    label: ROSCO_LETTERS_30[11],
    armenian: 'Ես ուզում էի, որ մենք միասին ճամփորդեինք։',
    spanish: 'Quería que ___ juntos.',
    tense: 'Imperfecto de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'viajamos' },
      { key: 'B', text: 'viajemos' },
      { key: 'C', text: 'hemos viajado' },
      { key: 'D', text: 'viajáramos' },
    ],
    correct: 'D',
    explanationEs: 'Imperfecto de Subjuntivo: Deseo en pasado ("Quería que") para primera persona plural (viajáramos).',
    explanationArm: 'Imperfecto de Subjuntivo. Անցյալ ցանկություն («Quería que») մենք դերանվան համար՝ viajáramos։',
  },
  {
    id: 43,
    part: 2,
    number: 13,
    label: ROSCO_LETTERS_30[12],
    armenian: 'Ես չէի հավատում, որ նա արդեն մեկնել էր Իսպանիա։',
    spanish: 'No creía que ya ___ a España.',
    tense: 'Pluscuamperfecto de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'haya viajado' },
      { key: 'B', text: 'hubiera viajado' },
      { key: 'C', text: 'viaja' },
      { key: 'D', text: 'viajó' },
    ],
    correct: 'B',
    explanationEs: 'Pluscuamperfecto de Subjuntivo: Incredulidad en pasado ("No creía que") sobre un viaje previo (hubiera viajado).',
    explanationArm: 'Pluscuamperfecto de Subjuntivo. Անցյալում չհավատալ («No creía que») ավելի վաղ տեղի ունեցածին (hubiera viajado)։',
  },
  {
    id: 44,
    part: 2,
    number: 14,
    label: ROSCO_LETTERS_30[13],
    armenian: 'Ես վախենում եմ, որ նա չհասցնի ավարտել աշխատանքը։',
    spanish: 'Temo que no ___ terminar el trabajo a tiempo.',
    tense: 'Presente de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'pueda' },
      { key: 'B', text: 'puede' },
      { key: 'C', text: 'pudo' },
      { key: 'D', text: 'podría' },
    ],
    correct: 'A',
    explanationEs: 'Presente de Subjuntivo: Expresión de temor ("Temo que") rige Subjuntivo (poder -> pueda).',
    explanationArm: 'Presente de Subjuntivo. Վախ արտահայտող բայ («Temo que») + pueda։',
  },
  {
    id: 45,
    part: 2,
    number: 15,
    label: ROSCO_LETTERS_30[14],
    armenian: 'Մենք ուրախ ենք, որ դու հաջողությամբ հանձնել ես քննությունը։',
    spanish: 'Estamos contentos de que ___ el examen con éxito.',
    tense: 'Pretérito Perfecto de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'aprobaste' },
      { key: 'B', text: 'apruebas' },
      { key: 'C', text: 'hayas aprobado' },
      { key: 'D', text: 'hubieras aprobado' },
    ],
    correct: 'C',
    explanationEs: 'Pretérito Perfecto de Subjuntivo: Alegría presente respecto a un logro ya completado (hayas aprobado).',
    explanationArm: 'Pretérito Perfecto de Subjuntivo. Ներկա ուրախություն արդեն հանձնած քննության համար (hayas aprobado)։',
  },
  {
    id: 46,
    part: 2,
    number: 16,
    label: ROSCO_LETTERS_30[15],
    armenian: 'Եթե ես ավելի շատ ազատ ժամանակ ունենայի, ավելի շատ կճամփորդեի։',
    spanish: 'Si ___ más tiempo libre, viajaría más.',
    tense: 'Imperfecto de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'tengo' },
      { key: 'B', text: 'tuviera' },
      { key: 'C', text: 'tendré' },
      { key: 'D', text: 'haya tenido' },
    ],
    correct: 'B',
    explanationEs: 'Imperfecto de Subjuntivo: Condicional de segundo tipo: "Si + Imperfecto de Subjuntivo, Condicional Simple".',
    explanationArm: 'Imperfecto de Subjuntivo. Երկրորդ տիպի պայմանական նախադասություն՝ Si + tuviera, viajaría։',
  },
  {
    id: 47,
    part: 2,
    number: 17,
    label: ROSCO_LETTERS_30[16],
    armenian: 'Եթե դու երեկ ինձ զանգած լինեիր, ես քեզ կօգնեի։',
    spanish: 'Si me ___ ayer, te habría ayudado.',
    tense: 'Pluscuamperfecto de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'llamaras' },
      { key: 'B', text: 'has llamado' },
      { key: 'C', text: 'llames' },
      { key: 'D', text: 'hubieras llamado' },
    ],
    correct: 'D',
    explanationEs: 'Pluscuamperfecto de Subjuntivo: Condicional irreal en pasado: "Si + Pluscuamperfecto de Subjuntivo, Condicional Compuesto".',
    explanationArm: 'Pluscuamperfecto de Subjuntivo. Երրորդ տիպի անիրական պայման անցյալում՝ Si + hubieras llamado, te habría ayudado։',
  },
  {
    id: 48,
    part: 2,
    number: 18,
    label: ROSCO_LETTERS_30[17],
    armenian: 'Ես ցանկանում եմ, որ ընտանիքս միշտ առողջ լինի։',
    spanish: 'Deseo que mi familia siempre ___ sana.',
    tense: 'Presente de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'esté' },
      { key: 'B', text: 'está' },
      { key: 'C', text: 'estuvo' },
      { key: 'D', text: 'estaría' },
    ],
    correct: 'A',
    explanationEs: 'Presente de Subjuntivo: Verbo de deseo ("Deseo que") exige Subjuntivo (estar -> esté).',
    explanationArm: 'Presente de Subjuntivo. Ցանկություն արտահայտող բայ («Deseo que») + esté։',
  },
  {
    id: 49,
    part: 2,
    number: 19,
    label: ROSCO_LETTERS_30[18],
    armenian: 'Ես զարմացած էի, որ դու այդքան արագ սովորել էիր իսպաներեն։',
    spanish: 'Me sorprendió que ___ español tan rápido.',
    tense: 'Pluscuamperfecto de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'hayas aprendido' },
      { key: 'B', text: 'aprendas' },
      { key: 'C', text: 'hubieras aprendido' },
      { key: 'D', text: 'aprendiste' },
    ],
    correct: 'C',
    explanationEs: 'Pluscuamperfecto de Subjuntivo: Sorpresa en pasado ("Me sorprendió que") por un aprendizaje previo (hubieras aprendido).',
    explanationArm: 'Pluscuamperfecto de Subjuntivo. Անցյալ զարմանք («Me sorprendió que») նախապես կատարված գործողության նկատմամբ (hubieras aprendido)։',
  },
  {
    id: 50,
    part: 2,
    number: 20,
    label: ROSCO_LETTERS_30[19],
    armenian: 'Հնարավոր է, որ նրանք այսօր ուշանան։',
    spanish: 'Es posible que hoy ___ tarde.',
    tense: 'Presente de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'llegan' },
      { key: 'B', text: 'lleguen' },
      { key: 'C', text: 'llegaron' },
      { key: 'D', text: 'llegarán' },
    ],
    correct: 'B',
    explanationEs: 'Presente de Subjuntivo: Expresión de posibilidad ("Es posible que") rige Subjuntivo (lleguen).',
    explanationArm: 'Presente de Subjuntivo. Հավանականություն («Es posible que») + lleguen։',
  },
  {
    id: 51,
    part: 2,
    number: 21,
    label: ROSCO_LETTERS_30[20],
    armenian: 'Ես չգիտեմ որևէ մեկին, ով կարող է լուծել այս խնդիրը։',
    spanish: 'No conozco a nadie que ___ resolver este problema.',
    tense: 'Presente de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'puede' },
      { key: 'B', text: 'pudo' },
      { key: 'C', text: 'podrá' },
      { key: 'D', text: 'pueda' },
    ],
    correct: 'D',
    explanationEs: 'Presente de Subjuntivo: Antecedente negativo ("No conozco a nadie que") exige Subjuntivo (pueda).',
    explanationArm: 'Presente de Subjuntivo. Ժխտական անորոշ հարաբերյալից հետո («a nadie que») պահանջվում է pueda։',
  },
  {
    id: 52,
    part: 2,
    number: 22,
    label: ROSCO_LETTERS_30[21],
    armenian: 'Իմ մայրը խնդրեց, որ ես ավելի շուտ վերադառնայի։',
    spanish: 'Mi madre me pidió que ___ más temprano.',
    tense: 'Imperfecto de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'volviera' },
      { key: 'B', text: 'vuelva' },
      { key: 'C', text: 'vuelvo' },
      { key: 'D', text: 'he vuelto' },
    ],
    correct: 'A',
    explanationEs: 'Imperfecto de Subjuntivo: Petición en pasado ("pidió que") rige Imperfecto de Subjuntivo (volver -> volviera).',
    explanationArm: 'Imperfecto de Subjuntivo. Անցյալ խնդրանքից հետո («me pidió que») պահանջվում է volviera։',
  },
  {
    id: 53,
    part: 2,
    number: 23,
    label: ROSCO_LETTERS_30[22],
    armenian: 'Ես ուրախ եմ, որ դու ինձ ճշմարտությունն ասել ես։',
    spanish: 'Me alegra que me ___ la verdad.',
    tense: 'Pretérito Perfecto de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'dijiste' },
      { key: 'B', text: 'dices' },
      { key: 'C', text: 'hayas dicho' },
      { key: 'D', text: 'hubieras dicho' },
    ],
    correct: 'C',
    explanationEs: 'Pretérito Perfecto de Subjuntivo: Alegría presente ante un hecho ya consumado (decir -> hayas dicho).',
    explanationArm: 'Pretérito Perfecto de Subjuntivo. Զգացմունք արդեն ասված ճշմարտության նկատմամբ (hayas dicho)։',
  },
  {
    id: 54,
    part: 2,
    number: 24,
    label: ROSCO_LETTERS_30[23],
    armenian: 'Եթե մենք ավելի վաղ դուրս եկած լինեինք, չէինք ուշանա։',
    spanish: 'Si ___ antes, no habríamos llegado tarde.',
    tense: 'Pluscuamperfecto de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'saliéramos' },
      { key: 'B', text: 'hubiéramos salido' },
      { key: 'C', text: 'hemos salido' },
      { key: 'D', text: 'salgamos' },
    ],
    correct: 'B',
    explanationEs: 'Pluscuamperfecto de Subjuntivo: Condición irreal en pasado: Si + hubiéramos salido, no habríamos llegado tarde.',
    explanationArm: 'Pluscuamperfecto de Subjuntivo. Անիրական պայման անցյալում՝ Si + hubiéramos salido, no habríamos llegado tarde։',
  },
  {
    id: 55,
    part: 2,
    number: 25,
    label: ROSCO_LETTERS_30[24],
    armenian: 'Ես չէի ուզում, որ նրանք իմանային իմ գաղտնիքը։',
    spanish: 'No quería que ellos ___ mi secreto.',
    tense: 'Imperfecto de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'saben' },
      { key: 'B', text: 'sepan' },
      { key: 'C', text: 'han sabido' },
      { key: 'D', text: 'supieran' },
    ],
    correct: 'D',
    explanationEs: 'Imperfecto de Subjuntivo: Deseo negativo en pasado ("No quería que") rige Imperfecto de Subjuntivo (saber -> supieran).',
    explanationArm: 'Imperfecto de Subjuntivo. Անցյալ ցանկություն («No quería que») + supieran։',
  },
  {
    id: 56,
    part: 2,
    number: 26,
    label: ROSCO_LETTERS_30[25],
    armenian: 'Հուսով եմ, որ դու արդեն գտել ես աշխատանք։',
    spanish: 'Espero que ya ___ trabajo.',
    tense: 'Pretérito Perfecto de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'hayas encontrado' },
      { key: 'B', text: 'encontraste' },
      { key: 'C', text: 'encuentres' },
      { key: 'D', text: 'hubieras encontrado' },
    ],
    correct: 'A',
    explanationEs: 'Pretérito Perfecto de Subjuntivo: Esperanza presente ("Espero que") con marcador "ya" (hayas encontrado).',
    explanationArm: 'Pretérito Perfecto de Subjuntivo. Հույս արդեն կատարված գործողության նկատմամբ՝ «ya» (արդեն) + hayas encontrado։',
  },
  {
    id: 57,
    part: 2,
    number: 27,
    label: ROSCO_LETTERS_30[26],
    armenian: 'Լավ կլիներ, եթե դու ավելի շատ վստահեիր քեզ։',
    spanish: 'Sería bueno que ___ más en ti mismo.',
    tense: 'Imperfecto de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'confías' },
      { key: 'B', text: 'confíes' },
      { key: 'C', text: 'confiaras' },
      { key: 'D', text: 'has confiado' },
    ],
    correct: 'C',
    explanationEs: 'Imperfecto de Subjuntivo: Valoración condicional ("Sería bueno que") rige Imperfecto de Subjuntivo (confiaras).',
    explanationArm: 'Imperfecto de Subjuntivo. Պայմանական խորհուրդ («Sería bueno que») + confiaras։',
  },
  {
    id: 58,
    part: 2,
    number: 28,
    label: ROSCO_LETTERS_30[27],
    armenian: 'Ես ափսոսում էի, որ նա չէր ընդունել իմ առաջարկը։',
    spanish: 'Lamentaba que no ___ mi propuesta.',
    tense: 'Pluscuamperfecto de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'ha aceptado' },
      { key: 'B', text: 'hubiera aceptado' },
      { key: 'C', text: 'acepte' },
      { key: 'D', text: 'acepta' },
    ],
    correct: 'B',
    explanationEs: 'Pluscuamperfecto de Subjuntivo: Pesar en pasado ("Lamentaba que") por acción rechazada antes (hubiera aceptado).',
    explanationArm: 'Pluscuamperfecto de Subjuntivo. Անցյալ ափսոսանք («Lamentaba que») ավելի վաղ տեղի ունեցածի համար (hubiera aceptado)։',
  },
  {
    id: 59,
    part: 2,
    number: 29,
    label: ROSCO_LETTERS_30[28],
    armenian: 'Ես քեզ կօգնեմ, որպեսզի դու կարողանաս ավարտել նախագիծը։',
    spanish: 'Te ayudaré para que ___ terminar el proyecto.',
    tense: 'Presente de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'puedes' },
      { key: 'B', text: 'pudiste' },
      { key: 'C', text: 'podrías' },
      { key: 'D', text: 'puedas' },
    ],
    correct: 'D',
    explanationEs: 'Presente de Subjuntivo: Conjunción final "para que" siempre rige Subjuntivo (poder -> puedas).',
    explanationArm: 'Presente de Subjuntivo. Նպատակային շաղկապը («para que»՝ որպեսզի) միշտ պահանջում է Subjuntivo (puedas)։',
  },
  {
    id: 60,
    part: 2,
    number: 30,
    label: ROSCO_LETTERS_30[29],
    armenian: 'Եթե ես իմանայի ճշմարտությունը, այլ որոշում կկայացնեի։',
    spanish: 'Si ___ la verdad, habría tomado otra decisión.',
    tense: 'Pluscuamperfecto de Subjuntivo',
    tenseType: 'subjuntivo',
    options: [
      { key: 'A', text: 'hubiera sabido' },
      { key: 'B', text: 'sepa' },
      { key: 'C', text: 'sé' },
      { key: 'D', text: 'sabía' },
    ],
    correct: 'A',
    explanationEs: 'Pluscuamperfecto de Subjuntivo: Condicional irreal en el pasado, consecuencia "habría tomado" (hubiera sabido).',
    explanationArm: 'Pluscuamperfecto de Subjuntivo: Օգտագործվում է, քանի որ խոսքը անցյալում չիրականացած պայմանի մասին է՝ «habría tomado» (hubiera sabido)։',
  },
];

// ==========================================
// 3. PASAPALABRA ROSCO COMPONENT
// ==========================================

export type QuestionStatus = 'unanswered' | 'passed' | 'correct' | 'wrong';

interface RoscoSectionProps {
  questions: Question[];
  soundEnabled: boolean;
  globalShowArmenian: boolean;
  partTitle: string;
}

function RoscoSection({
  questions,
  soundEnabled,
  globalShowArmenian,
  partTitle,
}: RoscoSectionProps) {
  const [statuses, setStatuses] = useState<Record<number, QuestionStatus>>({});
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, 'A' | 'B' | 'C' | 'D'>>({});
  const [localShowArmenian, setLocalShowArmenian] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; show: boolean } | null>(null);

  const total = questions.length;
  const currentQuestion = questions[currentIndex] || questions[0];

  const aciertos = useMemo(
    () => Object.values(statuses).filter((s) => s === 'correct').length,
    [statuses]
  );
  const fallos = useMemo(
    () => Object.values(statuses).filter((s) => s === 'wrong').length,
    [statuses]
  );
  const restantes = total - (aciertos + fallos);

  useEffect(() => {
    setStatuses({});
    setUserAnswers({});
    setCurrentIndex(0);
    setIsFinished(false);
    setSelectedOption(null);
    setFeedback(null);
    setLocalShowArmenian(false);
  }, [questions]);

  useEffect(() => {
    if (total > 0 && aciertos + fallos === total && !isFinished) {
      setIsFinished(true);
      playSound.victory(soundEnabled);
      try {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // Fallback
      }
    }
  }, [aciertos, fallos, total, isFinished, soundEnabled]);

  const getNextPendingIndex = useCallback(
    (startIndex: number) => {
      for (let step = 1; step <= total; step++) {
        const nextIdx = (startIndex + step) % total;
        const qId = questions[nextIdx].id;
        const st = statuses[qId] || 'unanswered';
        if (st === 'unanswered' || st === 'passed') {
          return nextIdx;
        }
      }
      return -1;
    },
    [questions, statuses, total]
  );

  const handleSelectOption = (key: 'A' | 'B' | 'C' | 'D') => {
    if (feedback?.show) return;
    const isCorrect = key === currentQuestion.correct;
    setSelectedOption(key);
    setUserAnswers((prev) => ({ ...prev, [currentQuestion.id]: key }));

    if (isCorrect) {
      playSound.acierto(soundEnabled);
      setStatuses((prev) => ({ ...prev, [currentQuestion.id]: 'correct' }));
      setFeedback({ isCorrect: true, show: true });
    } else {
      playSound.fallo(soundEnabled);
      setStatuses((prev) => ({ ...prev, [currentQuestion.id]: 'wrong' }));
      setFeedback({ isCorrect: false, show: true });
    }

    setTimeout(() => {
      const nextIdx = getNextPendingIndex(currentIndex);
      if (nextIdx !== -1) {
        setCurrentIndex(nextIdx);
        setSelectedOption(null);
        setFeedback(null);
        setLocalShowArmenian(false);
      } else {
        setFeedback(null);
      }
    }, 1100);
  };

  const handlePasapalabra = () => {
    if (feedback?.show) return;
    playSound.pasapalabra(soundEnabled);
    setStatuses((prev) => ({ ...prev, [currentQuestion.id]: 'passed' }));
    setLocalShowArmenian(false);

    const nextIdx = getNextPendingIndex(currentIndex);
    if (nextIdx !== -1) {
      setCurrentIndex(nextIdx);
      setSelectedOption(null);
      setFeedback(null);
    }
  };

  const handleJumpTo = (index: number) => {
    setCurrentIndex(index);
    setSelectedOption(null);
    setFeedback(null);
    setLocalShowArmenian(false);
  };

  const handleResetGame = () => {
    setStatuses({});
    setUserAnswers({});
    setCurrentIndex(0);
    setIsFinished(false);
    setSelectedOption(null);
    setFeedback(null);
    setLocalShowArmenian(false);
  };

  const isArmenianVisible = globalShowArmenian || localShowArmenian;

  return (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto px-4 py-2">
      {/* HUD Bar */}
      <div className="w-full flex flex-wrap items-center justify-between gap-4 py-2 px-4 rounded-xl bg-slate-900/80 border border-slate-800/80 mb-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-amber-400">{partTitle}</span>
          <span className="text-xs text-slate-400">·</span>
          <span className="text-xs text-slate-400">
            Вопрос {currentIndex + 1} из {total}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-sm tabular-nums">
              {aciertos}
            </span>
            <span className="text-xs font-medium text-emerald-400">Aciertos</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center font-bold text-sm tabular-nums">
              {fallos}
            </span>
            <span className="text-xs font-medium text-rose-400">Fallos</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-bold text-sm tabular-nums">
              {restantes}
            </span>
            <span className="text-xs font-medium text-amber-300">Restantes</span>
          </div>

          <button
            onClick={handleResetGame}
            title="Перезапустить раунд"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700/60"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Сброс</span>
          </button>
        </div>
      </div>

      {/* Main Rosco Arena */}
      <div className="relative w-full flex flex-col lg:flex-row items-center justify-center gap-8 py-2">
        {/* Rosco Circular Ring Container */}
        <div className="relative w-[340px] h-[340px] sm:w-[460px] sm:h-[460px] md:w-[500px] md:h-[500px] shrink-0 select-none">
          <div className="absolute inset-4 rounded-full bg-radial from-blue-900/30 via-slate-900/60 to-transparent blur-xl pointer-events-none" />
          <div className="absolute inset-8 rounded-full border border-blue-500/10 pointer-events-none" />

          {questions.map((q, idx) => {
            const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
            const rPercent = 43;
            const xPercent = 50 + rPercent * Math.cos(angle);
            const yPercent = 50 + rPercent * Math.sin(angle);

            const status = statuses[q.id] || 'unanswered';
            const isActive = idx === currentIndex;

            let nodeClasses = 'bg-blue-700 text-white border-blue-400/50 shadow-blue-950/40';
            if (status === 'correct') {
              nodeClasses = 'bg-emerald-500 text-white border-emerald-300 shadow-emerald-900/60 ring-2 ring-emerald-400/40';
            } else if (status === 'wrong') {
              nodeClasses = 'bg-rose-600 text-white border-rose-300 shadow-rose-950/60 ring-2 ring-rose-400/40';
            } else if (status === 'passed') {
              nodeClasses = 'bg-amber-500 text-slate-950 border-amber-300 shadow-amber-950/60 ring-2 ring-amber-400/50';
            }

            if (isActive) {
              nodeClasses = 'bg-amber-400 text-slate-950 border-white shadow-lg ring-4 ring-amber-300 scale-125 z-20 animate-pulse font-extrabold';
            }

            return (
              <button
                key={q.id}
                onClick={() => handleJumpTo(idx)}
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`absolute w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm border transition-all duration-200 cursor-pointer ${nodeClasses}`}
                title={`№${q.number} - ${q.label}: ${q.tense} (${status})`}
              >
                <span>{q.label}</span>
              </button>
            );
          })}

          {/* Center Rosco Display */}
          <div className="absolute inset-[18%] sm:inset-[17%] rounded-full bg-slate-950/90 border border-blue-500/20 shadow-2xl flex flex-col items-center justify-center p-4 text-center overflow-hidden">
            <div className="text-[10px] tracking-widest uppercase text-blue-400 font-semibold mb-1">
              EL ROSCO · B1–B2
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-amber-400 mb-1 tracking-tight">
              {currentQuestion.label}
            </div>
            <div className="text-[11px] sm:text-xs font-medium text-slate-300 max-w-[200px] line-clamp-1 mb-2 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
              {currentQuestion.tense}
            </div>
            <button
              onClick={() => speakSpanish(currentQuestion.spanish.replace('___', ''))}
              className="flex items-center gap-1 text-[11px] text-blue-300 hover:text-white transition-colors bg-blue-950/60 hover:bg-blue-900/80 px-2.5 py-1 rounded-full border border-blue-500/30"
              title="Escuchar pronunciación"
            >
              <Volume2 className="w-3 h-3 text-blue-400" />
              <span>Pronunciar</span>
            </button>
          </div>
        </div>

        {/* Center / Right Question Interactive Board */}
        <div className="w-full lg:max-w-xl flex flex-col gap-4">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl relative backdrop-blur-md">
            {/* Header of question card */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/30 flex items-center justify-center text-xs font-bold">
                  {currentQuestion.label}
                </span>
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  {currentQuestion.tense}
                </span>
              </div>

              <button
                onClick={() => setLocalShowArmenian((prev) => !prev)}
                className="flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 transition-colors bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-lg"
              >
                <Languages className="w-3.5 h-3.5" />
                <span>{isArmenianVisible ? 'Թաքցնել հայերենը' : 'Տեսնել հայերենը 🇦🇲'}</span>
              </button>
            </div>

            {/* Spanish Sentence Prompt (Clicking reveals Armenian) */}
            <div
              onClick={() => setLocalShowArmenian((prev) => !prev)}
              className="cursor-pointer group p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-blue-500/50 transition-all mb-4"
              title="Կտտացրեք հայերեն թարգմանությունը բացելու համար"
            >
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                <span className="flex items-center gap-1 text-blue-400 font-medium">
                  <span>🇪🇸</span>
                  <span>Español</span>
                </span>
                <span className="text-[10px] text-slate-500 group-hover:text-blue-300 transition-colors flex items-center gap-1">
                  {isArmenianVisible ? (
                    <>
                      <EyeOff className="w-3 h-3" />
                      <span>Թարգմանությունը բացված է</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3" />
                      <span>Սեղմեք հայերենի համար</span>
                    </>
                  )}
                </span>
              </div>

              <div className="text-lg sm:text-xl font-semibold text-slate-100 leading-relaxed">
                {currentQuestion.spanish}
              </div>
            </div>

            {/* Armenian Translation Box */}
            {isArmenianVisible ? (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-4 animate-in fade-in duration-200">
                <div className="text-[11px] font-medium text-amber-400 mb-1 flex items-center gap-1">
                  <span>🇦🇲</span>
                  <span>Հայերեն թարգմանություն</span>
                </div>
                <div className="text-base text-amber-100 font-medium leading-relaxed font-sans">
                  {currentQuestion.armenian}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setLocalShowArmenian(true)}
                className="w-full py-2 px-3 rounded-lg border border-dashed border-slate-700 hover:border-slate-600 text-xs text-slate-400 hover:text-slate-300 flex items-center justify-center gap-2 mb-4 transition-colors"
              >
                <span>🇦🇲 Կտտացրեք՝ հայերեն թարգմանությունը տեսնելու համար</span>
              </button>
            )}

            {/* 4 Interactive Choices */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
              {currentQuestion.options.map((opt) => {
                const isSelected = selectedOption === opt.key;
                const isCorrectOption = opt.key === currentQuestion.correct;
                const showCorrectness = feedback?.show;

                let btnStyle =
                  'bg-slate-800/80 hover:bg-slate-750 text-slate-200 border-slate-700/80 hover:border-slate-600 hover:shadow-md';

                if (showCorrectness) {
                  if (isCorrectOption) {
                    btnStyle =
                      'bg-emerald-600 text-white border-emerald-400 ring-2 ring-emerald-400/50 font-bold';
                  } else if (isSelected && !isCorrectOption) {
                    btnStyle = 'bg-rose-600 text-white border-rose-400 ring-2 ring-rose-400/50';
                  } else {
                    btnStyle = 'bg-slate-900/60 text-slate-500 border-slate-800 opacity-60';
                  }
                }

                return (
                  <button
                    key={opt.key}
                    onClick={() => handleSelectOption(opt.key)}
                    disabled={feedback?.show}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer ${btnStyle}`}
                  >
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        showCorrectness && isCorrectOption
                          ? 'bg-emerald-800 text-white'
                          : showCorrectness && isSelected
                          ? 'bg-rose-800 text-white'
                          : 'bg-slate-700/70 text-slate-300'
                      }`}
                    >
                      {opt.key}
                    </span>
                    <span className="text-base font-medium">{opt.text}</span>
                  </button>
                );
              })}
            </div>

            {/* Feedback / Explanation Banner */}
            {feedback?.show && (
              <div
                className={`p-3.5 rounded-xl border mb-4 animate-in zoom-in-95 duration-150 ${
                  feedback.isCorrect
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm mb-1">
                  {feedback.isCorrect ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>¡CORRECTO! Ճիշտ է</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span>¡INCORRECTO! Ճիշտ պատասխանն է: {currentQuestion.correct})</span>
                    </>
                  )}
                </div>
                <div className="text-xs leading-relaxed opacity-90 mt-1">
                  {currentQuestion.explanationEs}
                </div>
                <div className="text-xs leading-relaxed opacity-90 mt-0.5 font-sans">
                  {currentQuestion.explanationArm}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handlePasapalabra}
                disabled={feedback?.show}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-bold text-sm sm:text-base tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <span>PASAPALABRA</span>
                <ChevronRight className="w-4 h-4 stroke-[3]" />
              </button>

              <button
                onClick={() => {
                  const nextIdx = (currentIndex + 1) % total;
                  handleJumpTo(nextIdx);
                }}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-sm font-medium transition-colors flex items-center gap-1.5"
                title="Հաջորդ հարցը"
              >
                <span>Հաջորդը</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Finished Modal */}
      {isFinished && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-400 flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-extrabold text-white mb-2">¡Rosco completado!</h3>
            <p className="text-sm text-slate-300 mb-6 font-sans">
              Դուք ավարտեցիք բոլոր {total} հարցերը այս բաժնում։
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                <div className="text-2xl font-extrabold text-emerald-400 tabular-nums">
                  {aciertos}
                </div>
                <div className="text-xs text-emerald-300/80">Aciertos (Ճիշտ)</div>
              </div>
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30">
                <div className="text-2xl font-extrabold text-rose-400 tabular-nums">
                  {fallos}
                </div>
                <div className="text-xs text-rose-300/80">Fallos (Սխալ)</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleResetGame}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm transition-colors"
              >
                Խաղալ նորից
              </button>
              <button
                onClick={() => setIsFinished(false)}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
              >
                Դիտել արդյունքները
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 4. CARD-BY-CARD QUIZ COMPONENT
// ==========================================

interface QuizSectionProps {
  questions: Question[];
  soundEnabled: boolean;
  globalShowArmenian: boolean;
}

function QuizSection({
  questions,
  soundEnabled,
  globalShowArmenian,
}: QuizSectionProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, 'A' | 'B' | 'C' | 'D'>>({});
  const [revealedArmenian, setRevealedArmenian] = useState<Record<number, boolean>>({});
  const [selectedTenseFilter, setSelectedTenseFilter] = useState<string>('all');

  const filteredQuestions =
    selectedTenseFilter === 'all'
      ? questions
      : questions.filter((q) => q.tense === selectedTenseFilter);

  const availableTenses = Array.from(new Set(questions.map((q) => q.tense)));
  const currentQ = filteredQuestions[currentIndex] || filteredQuestions[0] || questions[0];
  const qId = currentQ?.id;
  const userAnswer = selectedAnswers[qId];
  const isArmenianVisible = globalShowArmenian || !!revealedArmenian[qId];

  const answeredCount = Object.keys(selectedAnswers).filter((id) =>
    filteredQuestions.some((q) => q.id === Number(id))
  ).length;

  const correctCount = Object.entries(selectedAnswers).filter(([id, ans]) => {
    const q = filteredQuestions.find((item) => item.id === Number(id));
    return q && q.correct === ans;
  }).length;

  const handleSelectOption = (key: 'A' | 'B' | 'C' | 'D') => {
    if (userAnswer) return;
    setSelectedAnswers((prev) => ({ ...prev, [qId]: key }));
    if (key === currentQ.correct) {
      playSound.acierto(soundEnabled);
    } else {
      playSound.fallo(soundEnabled);
    }
  };

  const toggleArmenian = () => {
    setRevealedArmenian((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  const handleReset = () => {
    setSelectedAnswers({});
    setRevealedArmenian({});
    setCurrentIndex(0);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4">
      {/* Tense Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 mb-6">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Filter className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold">Ժամանակաձև:</span>
          <select
            value={selectedTenseFilter}
            onChange={(e) => {
              setSelectedTenseFilter(e.target.value);
              setCurrentIndex(0);
            }}
            className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            <option value="all">Բոլորը ({questions.length})</option>
            {availableTenses.map((t) => (
              <option key={t} value={t}>
                {t} ({questions.filter((q) => q.tense === t).length})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {correctCount} / {answeredCount} ճիշտ
            </span>
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
            title="Մաքրել պատասխանները"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Մաքրել</span>
          </button>
        </div>
      </div>

      {/* Progress Dots / Question Navigator */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-4 scrollbar-thin">
        {filteredQuestions.map((q, idx) => {
          const ans = selectedAnswers[q.id];
          let color = 'bg-slate-800 text-slate-400 border-slate-700';
          if (ans) {
            color =
              ans === q.correct
                ? 'bg-emerald-600/30 text-emerald-400 border-emerald-500/50'
                : 'bg-rose-600/30 text-rose-400 border-rose-500/50';
          }
          if (idx === currentIndex) {
            color =
              'ring-2 ring-amber-400 bg-amber-400/20 text-amber-300 border-amber-400 font-bold';
          }

          return (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(idx)}
              className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs border transition-all cursor-pointer ${color}`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Active Question Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-md bg-amber-400/10 text-amber-400 border border-amber-400/30 font-bold text-xs">
              Հարց {currentIndex + 1} / {filteredQuestions.length}
            </span>
            <span className="text-xs font-semibold text-slate-300">{currentQ.tense}</span>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs text-slate-400">
              {currentQ.part === 1 ? 'Pasado (Մաս 1)' : 'Subjuntivo (Մաս 2)'}
            </span>
          </div>

          <button
            onClick={() => speakSpanish(currentQ.spanish.replace('___', ''))}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-950/60 hover:bg-blue-900/60 border border-blue-500/30 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Լսել իսպաներեն</span>
          </button>
        </div>

        {/* Spanish Prompt (Clicking toggles Armenian) */}
        <div
          onClick={toggleArmenian}
          className="p-5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group mb-4"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold text-blue-400 flex items-center gap-1">
              <span>🇪🇸</span>
              <span>Իսպաներեն հարց:</span>
            </span>
            <span className="text-slate-500 group-hover:text-amber-300 transition-colors flex items-center gap-1">
              {isArmenianVisible ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Թարգմանությունը բաց է</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Սեղմեք հայերենի համար</span>
                </>
              )}
            </span>
          </div>

          <div className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight leading-relaxed">
            {currentQ.spanish}
          </div>
        </div>

        {/* Armenian Prompt */}
        {isArmenianVisible ? (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-6 animate-in fade-in duration-200">
            <div className="text-xs font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
              <span>🇦🇲</span>
              <span>Հայերեն թարգմանություն:</span>
            </div>
            <div className="text-base sm:text-lg font-medium text-amber-100 font-sans">
              {currentQ.armenian}
            </div>
          </div>
        ) : (
          <button
            onClick={toggleArmenian}
            className="w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-800 hover:border-slate-700 text-xs text-slate-400 hover:text-slate-200 flex items-center justify-center gap-2 mb-6 transition-colors"
          >
            <Languages className="w-3.5 h-3.5 text-amber-400" />
            <span>🇦🇲 Կտտացրեք՝ հայերեն թարգմանությունը բացելու համար</span>
          </button>
        )}

        {/* 4 Choices */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {currentQ.options.map((opt) => {
            const isSelected = userAnswer === opt.key;
            const isCorrect = opt.key === currentQ.correct;
            const hasAnswered = !!userAnswer;

            let btnClass = 'bg-slate-800/70 hover:bg-slate-750 text-slate-200 border-slate-700';

            if (hasAnswered) {
              if (isCorrect) {
                btnClass =
                  'bg-emerald-600/90 text-white border-emerald-400 ring-2 ring-emerald-400/50 font-bold';
              } else if (isSelected) {
                btnClass = 'bg-rose-600/90 text-white border-rose-400 ring-2 ring-rose-400/50';
              } else {
                btnClass = 'bg-slate-950/40 text-slate-500 border-slate-800 opacity-60';
              }
            }

            return (
              <button
                key={opt.key}
                onClick={() => handleSelectOption(opt.key)}
                disabled={hasAnswered}
                className={`flex items-center gap-3.5 p-4 rounded-xl border text-left transition-all cursor-pointer ${btnClass}`}
              >
                <span
                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                    hasAnswered && isCorrect
                      ? 'bg-emerald-800 text-white'
                      : hasAnswered && isSelected
                      ? 'bg-rose-800 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {opt.key}
                </span>
                <span className="text-base font-semibold">{opt.text}</span>
              </button>
            );
          })}
        </div>

        {/* Feedback / Explanation Box */}
        {userAnswer && (
          <div
            className={`p-4 rounded-xl border mb-6 animate-in fade-in duration-200 ${
              userAnswer === currentQ.correct
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm mb-2">
              {userAnswer === currentQ.correct ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>¡Excelente! Ճիշտ պատասխան</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-rose-400" />
                  <span>Սխալ է։ Ճիշտ տարբերակն է: {currentQ.correct})</span>
                </>
              )}
            </div>

            <div className="text-xs sm:text-sm text-slate-300 mb-1 leading-relaxed">
              <strong>Իսպաներեն կանոն:</strong> {currentQ.explanationEs}
            </div>
            <div className="text-xs sm:text-sm text-slate-300 font-sans leading-relaxed">
              <strong>Բացատրություն:</strong> {currentQ.explanationArm}
            </div>
          </div>
        )}

        {/* Prev / Next Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-slate-300 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Նախորդը</span>
          </button>

          <span className="text-xs text-slate-400">
            {currentIndex + 1} / {filteredQuestions.length}
          </span>

          <button
            onClick={() =>
              setCurrentIndex((prev) =>
                Math.min(filteredQuestions.length - 1, prev + 1)
              )
            }
            disabled={currentIndex === filteredQuestions.length - 1}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-slate-300 transition-colors"
          >
            <span>Հաջորդը</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 5. ANSWER KEY & GRAMMAR REVIEW COMPONENT
// ==========================================

interface AnswerKeySectionProps {
  questions: Question[];
}

function AnswerKeySection({ questions }: AnswerKeySectionProps) {
  const [activePartTab, setActivePartTab] = useState<'all' | 'part1' | 'part2'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hideAnswersMode, setHideAnswersMode] = useState<boolean>(false);
  const [revealedIds, setRevealedIds] = useState<Record<number, boolean>>({});

  const filtered = questions.filter((q) => {
    if (activePartTab === 'part1' && q.part !== 1) return false;
    if (activePartTab === 'part2' && q.part !== 2) return false;
    if (!searchQuery.trim()) return true;

    const term = searchQuery.toLowerCase();
    return (
      q.spanish.toLowerCase().includes(term) ||
      q.armenian.toLowerCase().includes(term) ||
      q.tense.toLowerCase().includes(term) ||
      q.id.toString() === term
    );
  });

  const toggleReveal = (id: number) => {
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 mb-6 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-amber-400" />
              <span>Clave de Respuestas · Պատասխանների բանալի</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-sans">
              Լրիվ պատասխանների ցանկ քերականական բացատրություններով (60 հարց)
            </p>
          </div>

          <button
            onClick={() => {
              setHideAnswersMode((prev) => !prev);
              setRevealedIds({});
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            {hideAnswersMode ? (
              <>
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span>Ցույց տալ պատասխանները</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                <span>Թաքցնել ստուգման համար</span>
              </>
            )}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActivePartTab('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activePartTab === 'all'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Բոլորը (60)
            </button>
            <button
              onClick={() => setActivePartTab('part1')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activePartTab === 'part1'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Մաս 1: Pasado (1–30)
            </button>
            <button
              onClick={() => setActivePartTab('part2')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activePartTab === 'part2'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Մաս 2: Subjuntivo (31–60)
            </button>
          </div>

          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Որոնել (բառ, ժամանակաձև, համար)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-amber-400 placeholder:text-slate-600"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3.5">
        {filtered.map((q) => {
          const isRevealed = !hideAnswersMode || !!revealedIds[q.id];
          const correctOpt = q.options.find((o) => o.key === q.correct);
          const fullFilledSentence = q.spanish.replace('___', `[${correctOpt?.text || ''}]`);

          return (
            <div
              key={q.id}
              className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 sm:p-5 hover:border-slate-700 transition-all shadow-md"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800/60 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center justify-center font-bold text-xs">
                    {q.id}
                  </span>
                  <span className="text-xs font-bold text-slate-200">
                    {q.part === 1 ? 'Часть 1: Pasado' : 'Часть 2: Subjuntivo'}
                  </span>
                  <span className="text-xs text-slate-500">·</span>
                  <span className="text-xs font-semibold text-blue-400">{q.tense}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => speakSpanish(fullFilledSentence.replace(/[\[\]]/g, ''))}
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-500/20 transition-colors"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>Լսել</span>
                  </button>

                  {hideAnswersMode && (
                    <button
                      onClick={() => toggleReveal(q.id)}
                      className="text-xs text-amber-400 hover:text-amber-300 font-semibold px-2 py-1 bg-amber-400/10 rounded-lg border border-amber-400/20"
                    >
                      {isRevealed ? 'Թաքցնել' : 'Բացել'}
                    </button>
                  )}
                </div>
              </div>

              {/* Spanish & Armenian Prompts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <div className="text-[11px] font-semibold text-blue-400 mb-1 flex items-center gap-1">
                    <span>🇪🇸</span>
                    <span>Իսպաներեն հարց:</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-100">{q.spanish}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <div className="text-[11px] font-semibold text-amber-400 mb-1 flex items-center gap-1 font-sans">
                    <span>🇦🇲</span>
                    <span>Հայերեն թարգմանություն:</span>
                  </div>
                  <div className="text-sm font-medium text-slate-200 font-sans">{q.armenian}</div>
                </div>
              </div>

              {/* Options */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {q.options.map((opt) => {
                  const isThisCorrect = opt.key === q.correct;
                  return (
                    <div
                      key={opt.key}
                      className={`px-3 py-2 rounded-lg text-xs flex items-center gap-2 border ${
                        isRevealed && isThisCorrect
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50 font-bold'
                          : 'bg-slate-950/60 text-slate-400 border-slate-800'
                      }`}
                    >
                      <span className="font-bold">{opt.key})</span>
                      <span>{opt.text}</span>
                      {isRevealed && isThisCorrect && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-auto" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Answer & Explanation */}
              {isRevealed ? (
                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs">
                  <div className="flex items-center gap-2 font-bold text-emerald-400 mb-1">
                    <span>
                      Պատասխան: {q.id} — {q.correct}) {correctOpt?.text}
                    </span>
                    <span className="text-slate-400 font-normal">({fullFilledSentence})</span>
                  </div>
                  <div className="text-slate-300 leading-relaxed mb-0.5">
                    🇪🇸 {q.explanationEs}
                  </div>
                  <div className="text-amber-200/90 font-sans leading-relaxed">
                    🇦🇲 {q.explanationArm}
                  </div>
                  {q.id === 60 && (
                    <div className="mt-2 pt-2 border-t border-emerald-500/20 text-amber-300 font-sans">
                      ⚠️ <strong>Ուշադրություն:</strong> 60-րդ հարցում օգտագործվում է Pluscuamperfecto de Subjuntivo, քանի որ խոսքը անցյալում չիրականացած պայմանի մասին է՝ <em>habría tomado</em>։
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => toggleReveal(q.id)}
                  className="w-full py-2 rounded-lg bg-slate-950 border border-dashed border-slate-800 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Կտտացրեք՝ պատասխանը ստուգելու համար
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// 6. MAIN APPLICATION ROOT
// ==========================================

export type AppMode = 'rosco' | 'quiz' | 'keys';
export type PartSelection = 'part1' | 'part2' | 'all';

export default function App() {
  const [currentMode, setCurrentMode] = useState<AppMode>('rosco');
  const [selectedPart, setSelectedPart] = useState<PartSelection>('part1');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [globalShowArmenian, setGlobalShowArmenian] = useState<boolean>(false);

  const activeQuestions = useMemo<Question[]>(() => {
    if (selectedPart === 'part1') {
      return QUESTIONS.filter((q) => q.part === 1);
    }
    if (selectedPart === 'part2') {
      return QUESTIONS.filter((q) => q.part === 2);
    }
    return QUESTIONS;
  }, [selectedPart]);

  const partTitle = useMemo(() => {
    if (selectedPart === 'part1') {
      return 'Часть 1: Pasado (1–30)';
    }
    if (selectedPart === 'part2') {
      return 'Часть 2: Subjuntivo (31–60)';
    }
    return 'Марафон: Все 60 вопросов';
  }, [selectedPart]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 3-Zone Header Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setCurrentMode('rosco');
          }}
          className="text-lg font-bold tracking-tight text-white hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
        >
          <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-md">
            P
          </span>
          <span>Pasapalabra 🇪🇸🇦🇲</span>
        </a>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            onClick={() => setCurrentMode('rosco')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentMode === 'rosco'
                ? 'text-amber-400 font-bold border-b-2 border-amber-400 pb-0.5'
                : 'text-slate-400'
            }`}
          >
            El Rosco
          </button>
          <button
            onClick={() => setCurrentMode('quiz')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentMode === 'quiz'
                ? 'text-amber-400 font-bold border-b-2 border-amber-400 pb-0.5'
                : 'text-slate-400'
            }`}
          >
            Викторина
          </button>
          <button
            onClick={() => setCurrentMode('keys')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentMode === 'keys'
                ? 'text-amber-400 font-bold border-b-2 border-amber-400 pb-0.5'
                : 'text-slate-400'
            }`}
          >
            Ключ ответов
          </button>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            title={soundEnabled ? 'Выключить звук' : 'Включить звук'}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Звук: ВКЛ</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Звук: ВЫКЛ</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace Toolbar */}
      <div className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-sm px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Part Selection */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800/80 w-full sm:w-auto">
            <button
              onClick={() => setSelectedPart('part1')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                selectedPart === 'part1'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Часть 1: Pasado (30)
            </button>
            <button
              onClick={() => setSelectedPart('part2')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                selectedPart === 'part2'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Часть 2: Subjuntivo (30)
            </button>
            <button
              onClick={() => setSelectedPart('all')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                selectedPart === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Все (60)
            </button>
          </div>

          {/* Quick Settings & Mobile Tabs */}
          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1 p-1 bg-slate-950/80 rounded-xl border border-slate-800/80 md:hidden">
              <button
                onClick={() => setCurrentMode('rosco')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  currentMode === 'rosco'
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-400'
                }`}
              >
                Rosco
              </button>
              <button
                onClick={() => setCurrentMode('quiz')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  currentMode === 'quiz'
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-400'
                }`}
              >
                Викторина
              </button>
              <button
                onClick={() => setCurrentMode('keys')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  currentMode === 'keys'
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-400'
                }`}
              >
                Ключ
              </button>
            </div>

            <button
              onClick={() => setGlobalShowArmenian((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors"
              title="Переключение авто-показа армянского перевода"
            >
              {globalShowArmenian ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Перевод: Всегда открыт</span>
                  <span className="sm:hidden">🇦🇲 Открыт</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Перевод: По клику</span>
                  <span className="sm:hidden">🇦🇲 По клику</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-start w-full py-4 sm:py-6">
        {currentMode === 'rosco' && (
          <RoscoSection
            questions={activeQuestions}
            soundEnabled={soundEnabled}
            globalShowArmenian={globalShowArmenian}
            partTitle={partTitle}
          />
        )}

        {currentMode === 'quiz' && (
          <QuizSection
            questions={activeQuestions}
            soundEnabled={soundEnabled}
            globalShowArmenian={globalShowArmenian}
          />
        )}

        {currentMode === 'keys' && (
          <AnswerKeySection questions={QUESTIONS} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 px-4 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 font-sans">
          <div className="flex items-center gap-2">
            <span>Իսպաներենի վիկտորինա B1–B2</span>
            <span>·</span>
            <span>Հայերեն 🇦🇲 — Español 🇪🇸</span>
          </div>
          <div>
            <span>60 հարց · Los tiempos del pasado & El Subjuntivo</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
