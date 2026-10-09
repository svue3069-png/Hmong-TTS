/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Hmong Community Phrasebook & Authentic Spoken Idioms
 * Curated from native linguistic field work and Hmoob TTS Studio (https://lwazkaev.gensparkspace.com/)
 */

export interface HmongPhraseItem {
  id: string;
  hmong: string;
  english: string;
  category: 'greetings' | 'basics' | 'numbers' | 'family' | 'food' | 'travel' | 'shopping' | 'health' | 'culture';
  note?: string;
  literalMeaning?: string;
  dialect?: 'both' | 'dawb' | 'leeg';
}

export interface HmongPhraseCategory {
  id: HmongPhraseItem['category'];
  label: string;
  hmoobLabel: string;
  icon: string; // lucide icon name
  description: string;
}

export const HMONG_PHRASE_CATEGORIES: HmongPhraseCategory[] = [
  {
    id: 'greetings',
    label: 'Greetings & Salutations',
    hmoobLabel: 'Kev Sib Tham & Sib Hu',
    icon: 'Handshake',
    description: 'Polite welcomes, departures, and social pleasantries',
  },
  {
    id: 'basics',
    label: 'Everyday Basics',
    hmoobLabel: 'Cov Lus Siv Tas Li',
    icon: 'MessageSquare',
    description: 'Agreement, negation, questions, and comprehension checks',
  },
  {
    id: 'numbers',
    label: 'Numbers & Counting',
    hmoobLabel: 'Cov Naj Npawb & Suav',
    icon: 'Hash',
    description: 'Cardinal numbers, tens, hundreds, and counting classifiers',
  },
  {
    id: 'family',
    label: 'Family & Kinship',
    hmoobLabel: 'Tsev Neeg & Kwv Tij',
    icon: 'Users',
    description: 'Rich and precise traditional Hmong kinship designations',
  },
  {
    id: 'food',
    label: 'Food & Dining',
    hmoobLabel: 'Zaub Mov & Haus Dej',
    icon: 'Utensils',
    description: 'Staple dishes, meats, vegetables, flavors, and dining phrases',
  },
  {
    id: 'travel',
    label: 'Getting Around & Travel',
    hmoobLabel: 'Kev Mus Los & Kev Taw Qhia',
    icon: 'Compass',
    description: 'Directions, vehicles, destinations, and wayfinding',
  },
  {
    id: 'shopping',
    label: 'Shopping & Commerce',
    hmoobLabel: 'Kev Yuav & Muag Khoom',
    icon: 'ShoppingBag',
    description: 'Prices, bargaining, buying, and market transactions',
  },
  {
    id: 'health',
    label: 'Health & Emergencies',
    hmoobLabel: 'Kev Kho Mob & Xwm Ceev',
    icon: 'HeartPulse',
    description: 'Symptoms, medicine, urgent assistance, and hospital terms',
  },
  {
    id: 'culture',
    label: 'Traditional Culture & Sayings',
    hmoobLabel: 'Kab Lis Kev Cai & Paj Lug',
    icon: 'Sparkles',
    description: 'Proverbs, New Year blessings, wedding greetings, and cultural wisdom',
  },
];

export const HMONG_PHRASES: HmongPhraseItem[] = [
  /* ---- Greetings ---- */
  {
    id: 'g_01',
    hmong: 'Nyob zoo',
    english: 'Hello / Greetings / Goodbye (to someone staying)',
    category: 'greetings',
    literalMeaning: 'Live well / be well',
    note: 'The universal Hmong greeting. Also said by a departee to someone remaining.',
  },
  {
    id: 'g_02',
    hmong: 'Koj nyob li cas?',
    english: 'How are you?',
    category: 'greetings',
    literalMeaning: 'How do you live?',
    note: 'The standard cordial question among friends and acquaintances.',
  },
  {
    id: 'g_03',
    hmong: 'Kuv nyob zoo',
    english: 'I am fine / doing well',
    category: 'greetings',
    note: 'The polite reply to "Koj nyob li cas?".',
  },
  {
    id: 'g_04',
    hmong: 'Ua tsaug',
    english: 'Thank you',
    category: 'greetings',
    literalMeaning: 'To do / give blessing',
    note: 'The fundamental expression of gratitude.',
  },
  {
    id: 'g_05',
    hmong: 'Ua tsaug ntau',
    english: 'Thank you very much',
    category: 'greetings',
    note: 'ntau = much / abundant.',
  },
  {
    id: 'g_06',
    hmong: 'Tsis muaj dab tsi',
    english: "You're welcome / Don't mention it",
    category: 'greetings',
    literalMeaning: 'There is nothing',
    note: 'Similar to "it is nothing at all".',
  },
  {
    id: 'g_07',
    hmong: 'Thov txim',
    english: 'Excuse me / I apologize / Pardon me',
    category: 'greetings',
    literalMeaning: 'Ask pardon / request forgiveness of fault',
    note: 'Used both for asking permission and making an apology.',
  },
  {
    id: 'g_08',
    hmong: 'Zoo siab tau ntsib koj',
    english: 'Nice to meet you / Glad to meet you',
    category: 'greetings',
    literalMeaning: 'Heart is good to meet you',
    note: 'Standard courteous greeting upon meeting someone new.',
  },
  {
    id: 'g_09',
    hmong: 'Mus zoo',
    english: 'Goodbye (spoken to someone who is leaving)',
    category: 'greetings',
    literalMeaning: 'Go well',
    note: 'Wished to the person who is departing or traveling.',
  },
  {
    id: 'g_10',
    hmong: 'Sawv daws nyob zoo',
    english: 'Hello everyone / Greetings to all',
    category: 'greetings',
    literalMeaning: 'Everyone live well',
    note: 'Used to address groups, meetings, and gatherings.',
  },
  {
    id: 'g_11',
    hmong: 'Mob siab',
    english: 'I am deeply sorry (condolences/sympathy)',
    category: 'greetings',
    literalMeaning: 'Heart aches / heart hurts',
    note: 'Expresses genuine empathy, sorrow, and condolences.',
  },

  /* ---- Everyday Basics ---- */
  {
    id: 'b_01',
    hmong: 'Yog',
    english: 'Yes / It is so',
    category: 'basics',
    note: 'Affirmative copula and general agreement.',
  },
  {
    id: 'b_02',
    hmong: 'Tsis yog',
    english: 'No / It is not so',
    category: 'basics',
    literalMeaning: 'Not is',
    note: 'tsis negates the verb yog.',
  },
  {
    id: 'b_03',
    hmong: 'Yog lawm',
    english: "Yes, that's right / Exactly",
    category: 'basics',
    note: 'lawm marks completed confirmation.',
  },
  {
    id: 'b_04',
    hmong: 'Kuv tsis to taub',
    english: "I do not understand",
    category: 'basics',
    note: 'Vital phrase for learners.',
  },
  {
    id: 'b_05',
    hmong: 'Kuv to taub lawm',
    english: 'I understand now',
    category: 'basics',
    note: 'Indicates clarity or comprehension.',
  },
  {
    id: 'b_06',
    hmong: 'Koj puas hais lus Askiv?',
    english: 'Do you speak English?',
    category: 'basics',
    note: 'puas turns a declarative statement into a yes/no question.',
  },
  {
    id: 'b_07',
    hmong: 'Kuv hais lus Hmoob',
    english: 'I speak Hmong',
    category: 'basics',
    note: 'Can add "me ntsis" (a little bit).',
  },
  {
    id: 'b_08',
    hmong: 'Hais maj mam',
    english: 'Please speak slowly',
    category: 'basics',
    note: 'maj mam means gently / slowly / deliberately.',
  },
  {
    id: 'b_09',
    hmong: 'Rov hais dua',
    english: 'Please say it again',
    category: 'basics',
    note: 'dua = again / repetition.',
  },
  {
    id: 'b_10',
    hmong: 'Pab kuv',
    english: 'Help me',
    category: 'basics',
    note: 'Urgent or polite request for assistance.',
  },
  {
    id: 'b_11',
    hmong: 'Kuv xav tau',
    english: 'I would like / I need / I want',
    category: 'basics',
    note: 'Followed by the object or action desired.',
  },
  {
    id: 'b_12',
    hmong: 'Zoo kawg',
    english: 'Very good / Excellent / Wonderful',
    category: 'basics',
    note: 'kawg = superlative / utmost.',
  },

  /* ---- Numbers & Counting ---- */
  { id: 'n_01', hmong: 'ib', english: 'One (1)', category: 'numbers' },
  { id: 'n_02', hmong: 'ob', english: 'Two (2)', category: 'numbers' },
  { id: 'n_03', hmong: 'peb', english: 'Three (3)', category: 'numbers' },
  { id: 'n_04', hmong: 'plaub', english: 'Four (4)', category: 'numbers' },
  { id: 'n_05', hmong: 'tsib', english: 'Five (5)', category: 'numbers' },
  { id: 'n_06', hmong: 'rau', english: 'Six (6)', category: 'numbers' },
  { id: 'n_07', hmong: 'xya', english: 'Seven (7)', category: 'numbers' },
  { id: 'n_08', hmong: 'yim', english: 'Eight (8)', category: 'numbers' },
  { id: 'n_09', hmong: 'cuaj', english: 'Nine (9)', category: 'numbers' },
  { id: 'n_10', hmong: 'kaum', english: 'Ten (10)', category: 'numbers' },
  { id: 'n_11', hmong: 'kaum ib', english: 'Eleven (11)', category: 'numbers', literalMeaning: 'Ten one' },
  { id: 'n_12', hmong: 'nees nkaum', english: 'Twenty (20)', category: 'numbers' },
  { id: 'n_13', hmong: 'peb caug', english: 'Thirty (30)', category: 'numbers' },
  { id: 'n_14', hmong: 'ib pua', english: 'One hundred (100)', category: 'numbers' },
  { id: 'n_15', hmong: 'ib txhiab', english: 'One thousand (1,000)', category: 'numbers' },

  /* ---- Family & People ---- */
  { id: 'f_01', hmong: 'txiv', english: 'Father / Dad', category: 'family' },
  { id: 'f_02', hmong: 'niam', english: 'Mother / Mom', category: 'family' },
  { id: 'f_03', hmong: 'niam txiv', english: 'Parents', category: 'family', literalMeaning: 'Mother father' },
  { id: 'f_04', hmong: 'tub', english: 'Son / Boy', category: 'family' },
  { id: 'f_05', hmong: 'ntxhais', english: 'Daughter / Girl', category: 'family' },
  { id: 'f_06', hmong: 'menyuam', english: 'Children / Kids', category: 'family' },
  { id: 'f_07', hmong: 'kwv tij', english: 'Brothers / Clan kinsmen', category: 'family', note: 'Male relatives sharing clan lineage.' },
  { id: 'f_08', hmong: 'viv ncaus', english: 'Sisters / Female relatives', category: 'family' },
  { id: 'f_09', hmong: 'poj niam', english: 'Wife / Woman', category: 'family' },
  { id: 'f_10', hmong: 'txiv neej', english: 'Husband / Man', category: 'family' },
  { id: 'f_11', hmong: 'yawg', english: 'Grandfather (paternal)', category: 'family' },
  { id: 'f_12', hmong: 'puj / niam tais', english: 'Grandmother', category: 'family' },

  /* ---- Food & Dining ---- */
  { id: 'd_01', hmong: 'mov', english: 'Cooked rice / Meal', category: 'food', note: 'The staple food of Hmong daily life.' },
  { id: 'd_02', hmong: 'noj mov', english: 'To eat / Have a meal', category: 'food', literalMeaning: 'Eat rice' },
  { id: 'd_03', hmong: 'dej', english: 'Water / Stream', category: 'food' },
  { id: 'd_04', hmong: 'haus dej', english: 'To drink water', category: 'food' },
  { id: 'd_05', hmong: 'nqaij', english: 'Meat', category: 'food' },
  { id: 'd_06', hmong: 'nqaij npuas', english: 'Pork', category: 'food', literalMeaning: 'Pig meat' },
  { id: 'd_07', hmong: 'nqaij qaib', english: 'Chicken meat', category: 'food' },
  { id: 'd_08', hmong: 'zaub', english: 'Vegetables / Greens', category: 'food' },
  { id: 'd_09', hmong: 'kua txob', english: 'Chili pepper / Pepper sauce', category: 'food', note: 'Spicy chili condiment.' },
  { id: 'd_10', hmong: 'qab heev', english: 'Very delicious / Tasty', category: 'food' },
  { id: 'd_11', hmong: 'Kuv tshaib plab', english: 'I am hungry', category: 'food', literalMeaning: 'My stomach is starved' },
  { id: 'd_12', hmong: 'Kuv nqhis dej', english: 'I am thirsty', category: 'food', literalMeaning: 'I crave water' },

  /* ---- Getting Around & Travel ---- */
  { id: 't_01', hmong: 'mus', english: 'To go / Travel', category: 'travel' },
  { id: 't_02', hmong: 'los', english: 'To come / Arrive', category: 'travel' },
  { id: 't_03', hmong: 'tsev', english: 'House / Home', category: 'travel' },
  { id: 't_04', hmong: 'tsheb', english: 'Car / Vehicle', category: 'travel' },
  { id: 't_05', hmong: 'lub tsheb npav', english: 'Bus', category: 'travel' },
  { id: 't_06', hmong: 'lub tshav dav hlau', english: 'Airport', category: 'travel', literalMeaning: 'Field of flying iron' },
  { id: 't_07', hmong: 'txoj kev', english: 'Road / Street / Path', category: 'travel' },
  { id: 't_08', hmong: 'Qhov twg?', english: 'Where?', category: 'travel' },
  { id: 't_09', hmong: 'Nyob qhov twg?', english: 'Where is it located?', category: 'travel' },
  { id: 't_10', hmong: 'lub tsev kho mob', english: 'Hospital / Clinic', category: 'travel', literalMeaning: 'House that heals sickness' },

  /* ---- Shopping & Commerce ---- */
  { id: 's_01', hmong: 'Yuav khoom', english: 'To buy things / Shopping', category: 'shopping' },
  { id: 's_02', hmong: 'Muag khoom', english: 'To sell things', category: 'shopping' },
  { id: 's_03', hmong: 'Nqi pes tsawg?', english: 'How much does this cost?', category: 'shopping' },
  { id: 's_04', hmong: 'Kim heev', english: 'Very expensive', category: 'shopping' },
  { id: 's_05', hmong: 'Pheej yig', english: 'Inexpensive / Cheap / Good deal', category: 'shopping' },
  { id: 's_06', hmong: 'Pab txo nqi me ntsis puas tau?', english: 'Can you lower the price a little bit?', category: 'shopping' },

  /* ---- Health & Emergencies ---- */
  { id: 'h_01', hmong: 'Kuv mob', english: 'I am sick / in pain', category: 'health' },
  { id: 'h_02', hmong: 'Mob taub hau', english: 'Headache', category: 'health', literalMeaning: 'Head hurts' },
  { id: 'h_03', hmong: 'Mob plab', english: 'Stomachache', category: 'health', literalMeaning: 'Stomach hurts' },
  { id: 'h_04', hmong: 'Tshuaj', english: 'Medicine / Medication', category: 'health' },
  { id: 'h_05', hmong: 'Thov hu tub ceev xwm', english: 'Please call the police', category: 'health' },

  /* ---- Culture & Storytelling ---- */
  {
    id: 'c_01',
    hmong: 'Nyob zoo xyoo tshiab!',
    english: 'Happy New Year! (Hmong New Year)',
    category: 'culture',
    note: 'Celebrated with ball tossing (pov pob), traditional clothing, and qeej playing.',
  },
  {
    id: 'c_02',
    hmong: 'Hmoob lub siab ncaj ncees',
    english: 'The honest and steadfast Hmong spirit',
    category: 'culture',
  },
  {
    id: 'c_03',
    hmong: 'Kuv zoo siab heev tau ntsib nej hnub no.',
    english: 'I am very glad to meet you all today.',
    category: 'culture',
  },
  {
    id: 'c_04',
    hmong: 'Noj tsis tag, tseg cia rau tag kis.',
    english: 'If you cannot finish eating today, save it for tomorrow. (Traditional proverb of thrift)',
    category: 'culture',
  },
];
