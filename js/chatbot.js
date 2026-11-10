/*!
 * AshBot, the Aśvattha Assistant (chatbot.js) v2.1.32
 * ---------------------------------------------------------------------------
 * A self-contained, dependency-free, rule-based assistant for the Aśvattha
 * website. No network requests are made and nothing leaves the visitor's
 * browser.
 *
 * FILE MAP
 *   1. Configuration      Defaults, profile facts, page lookup (+ optional overrides)
 *   2. Knowledge base     INTENTS: the only section most edits ever touch
 *   3. Language engine    Normalising, stemming, spell correction, scoring
 *   4. Conversation       Session memory, follow-ups, "tell me more", "yes"
 *   5. Interface          Widget markup, message queue, persistence, a11y
 *   6. Public API         window.AshBot
 *
 * OPTIONAL OVERRIDES (define BEFORE this script loads)
 *   window.AshBotConfig = {
 *     config:  { minThinkingMs: 300, persist: false },
 *     profile: { sessionFrequency: 'weekly', replyTime: '2 days' },
 *     pages:   { contact: '/contact.html', events: '/events.html' }
 *   };oing
 *
 * ADDING A TOPIC (no engine changes needed)
 *   AshBot.registerIntent({
 *     id: 'dress_code', label: 'Dress code', priority: 6,
 *     keywords: ['dress code', 'what to wear', 'clothing*'],   // strong signals
 *     weak:     ['wear'],                                      // low-confidence signals
 *     answer:   'Come as you are! Comfortable clothes work best.',
 *     related:  ['events'], actions: ['contact']
 *   });
 *
 * KEYWORD SYNTAX
 *   'free'        whole word (plurals are matched automatically)
 *   'volunteer*'  prefix: volunteer, volunteers, volunteering...
 *   'who can join' multi-word phrase. Longer phrases score higher.
 *   Typos such as "volenteer" or "wokshop" are corrected automatically.
 *   Keywords must be plain a-z / 0-9 (accents are stripped from visitor text,
 *   so "Aśvattha" is matched as 'asvattha').
 *
 * EVENTS (analytics hook)
 *   window.addEventListener('ashbot:chatbot', e => console.log(e.detail));
 *   detail.type: open | close | reset | reply | chip
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  if (window.__ashBotLoaded) return;
  window.__ashBotLoaded = true;

  const VERSION = '2.0.0';

  /* =========================================================================
     1. CONFIGURATION
     ========================================================================= */

  const USER =
    window.AshBotConfig && typeof window.AshBotConfig === 'object'
      ? window.AshBotConfig
      : {};

  const CONFIG = Object.assign(
    {
      minThinkingMs: 450,
      msPerCharacter: 3,
      maxExtraThinkingMs: 500,
      maxInputLength: 300,
      inputPlaceholder: 'Ask about our project...',
      welcomeMessage:
        "Hello! 🌱 I'm AshBot, the virtual assistant for Aśvattha. Ask me about our workshops, " +
        'storytelling circles, who can join, or how to get involved!',
      errorMessage:
        'Something went wrong while preparing that answer. Please try again, or reach out ' +
        'to our team through the Contact page.',
      statusText: 'Replies instantly',
      footnote: 'Automated assistant. For a person, use Contact.',
      persist: true,               // keep the chat while visitors move between pages
      storageKey: 'ashbot.chatbot.v2',
      maxStoredMessages: 40,
      restoreOpenState: true,
      spellCorrection: true,
      emitEvents: true,
      includeQueryInEvents: false  // keep visitor text out of events unless you opt in
    },
    USER.config || {}
  );

  const PROFILE = Object.assign(
    {
      founders: 'Mudita Agrawal and Yutika Solanki',
      sessionFrequency: 'biweekly',
      venues: 'partner community centers, libraries, and schools',
      replyTime: '24-48 hours'
    },
    USER.profile || {}
  );

  // Pages the bot can link to. URLs are discovered from the site's own links
  // (nav, footer) so nothing is hard-coded; set USER.pages to override.
  const PAGES = {
    contact: { label: 'Open Contact page', pattern: /contact/i },
    events: { label: 'See Events page', pattern: /event/i },
    workshops: { label: 'Browse Workshops', pattern: /workshop/i }
  };
  const PAGE_OVERRIDES = USER.pages && typeof USER.pages === 'object' ? USER.pages : {};
  const pageCache = {};

  function safeUrl(candidate) {
    try {
      const url = new URL(candidate, window.location.href);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
    } catch (e) {
      return null;
    }
  }

  function resolvePage(key) {
    if (pageCache[key]) return pageCache[key];
    const def = PAGES[key];
    if (!def) return null;

    let url = null;
    if (typeof PAGE_OVERRIDES[key] === 'string' && PAGE_OVERRIDES[key]) {
      url = safeUrl(PAGE_OVERRIDES[key]);
    } else {
      const links = document.querySelectorAll('a[href]');
      for (let i = 0; i < links.length; i += 1) {
        const link = links[i];
        const href = link.getAttribute('href') || '';
        if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
        if (link.closest && link.closest('#ngo-chatbot-container')) continue;
        if (def.pattern.test(href) || def.pattern.test(link.textContent || '')) {
          url = safeUrl(link.href);
          if (url) break;
        }
      }
    }

    if (url) pageCache[key] = url; // never cache a miss: the nav may load later
    return url;
  }

  /* =========================================================================
     2. KNOWLEDGE BASE
     -------------------------------------------------------------------------
     Intent fields
       id          unique key
       label       short chip text (used for suggestions)
       priority    tie-breaker when scores are equal (higher wins)
       smallTalk   true = never merged into a topic answer
       maxTokens   ignore this intent for messages longer than this
       keywords    strong signals (weight = number of words)
       weak        low-confidence signals (weight = 0.4 per word)
       patterns    RegExp (or {re, w}) tested on the cleaned query
       answer      string, or array of variants (one is picked at random)
       next        { intent, prompt }: a follow-up the bot offers; "yes" accepts it
       related     other intent ids to suggest as quick replies
       actions     page keys to show as buttons: 'contact' | 'events' | 'workshops'
       redirect    'offer' | 'more': context-driven behaviour (see engine)
       yields      true = lose to any real topic match
     Use {,name} inside an answer to insert ", Name" when the visitor gave one.
     ========================================================================= */

  const QUICK_START = ['programs', 'eligibility', 'volunteer', 'pricing'];
  const ALL_TOPICS = [
    'programs', 'eligibility', 'join', 'volunteer',
    'pricing', 'events', 'location', 'safety'
  ];

  const INTENTS = [
    /* ---------------------------- Small talk ---------------------------- */
    {
      id: 'greeting',
      label: 'Say hello',
      smallTalk: true,
      priority: 2,
      maxTokens: 6,
      keywords: [
        'hi', 'hii*', 'hello*', 'hey*', 'heyy*', 'hiya', 'howdy', 'greeting',
        'sup', 'yo', 'yoo', 'yooo*', 'namaste', 'namaskar', 'pranam', 'salaam',
        'salam', 'vanakkam', 'what is up', 'whats up', 'whatsup', 'wazzup',
        'wassup', 'wagwan', 'ayyy', 'ahoy', 'hola', 'bonjour', 'ciao', 'hallo',
        'aloha', 'konnichiwa', 'good morning', 'good afternoon', 'good evening',
        'top of the morning', 'good day', 'nice to meet you', 'pleased to meet you',
        'how do you do', 'good day to you', 'it is a pleasure to meet you',
        'salutation*', 'gday', 'howdy partner', 'what crackin', 'what is good',
        'whats good', 'alright mate', 'hiya pal'
      ],
      patterns: [/^(morning|afternoon|evening)$/],
      answer: [
        'Hello there{,name}! Welcome to Aśvattha. What would you like to know about our intergenerational project today?',
        "Hi{,name}! 🌱 I'm AshBot, the Aśvattha assistant. Ask me about our workshops, storytelling circles, or how to get involved!",
        "Hey there{,name}! It's great to have you here. How can I help you learn more about Aśvattha?"
      ],
      related: QUICK_START
    },
    {
      id: 'how_are_you',
      label: 'How are you?',
      smallTalk: true,
      priority: 3,
      maxTokens: 8,
      keywords: [
        'how are you', 'how do you do', 'how is it going', 'how are things',
        'how have you been', 'how is your day'
      ],
      answer: [
        "I'm doing great, thanks for asking! I'm here and ready to answer any questions you have about Aśvattha.",
        'Wonderful, thank you! 🌱 How can I help you today?'
      ],
      related: QUICK_START
    },
    {
      id: 'thanks',
      label: 'Thanks',
      smallTalk: true,
      priority: 2,
      maxTokens: 9,
      keywords: [
        'thank*', 'thx', 'ty', 'tyy*', 'tyyy*', 'appreciate*', 'grateful',
        'cheers', 'much obliged', 'that helps', 'that was helpful', 'very helpful',
        'good bot', 'nice bot', 'well done', 'great job', 'good job',
        'you are great', 'you are helpful', 'you are awesome', 'love it'
      ],
      answer: [
        "You're very welcome{,name}! Let me know if there's anything else I can help you with.",
        'Happy to help! Feel free to ask me anything else about Aśvattha. 🌱',
        "Anytime{,name}! If you think of more questions, I'm right here."
      ]
    },
    {
      id: 'goodbye',
      label: 'Goodbye',
      smallTalk: true,
      priority: 2,
      maxTokens: 8,
      keywords: [
        'bye*', 'goodbye', 'good bye', 'see you', 'see ya', 'take care',
        'talk later', 'farewell', 'have a good day', 'have a nice day',
        'that is all', 'nothing else', 'no thanks', 'cya', 'gotta go'
      ],
      answer: [
        'Goodbye{,name}! Thanks for stopping by. We hope to see you at an Aśvattha session soon. 🌱',
        'Take care{,name}! Come back anytime if you have more questions.'
      ]
    },
    {
      id: 'acknowledge',
      label: 'Okay',
      smallTalk: true,
      priority: 1,
      maxTokens: 3,
      keywords: [
        'ok', 'okay', 'cool', 'great', 'nice', 'awesome', 'got it', 'alright',
        'sounds good', 'i see', 'wonderful', 'amazing', 'perfect', 'good',
        'fine', 'interesting', 'makes sense', 'understood', 'noted'
      ],
      answer: [
        "Glad to hear it! Is there anything else you'd like to know about Aśvattha?",
        "Great! Just ask if you'd like to know more about our workshops, storytelling circles, or how to get involved."
      ],
      related: QUICK_START
    },
    {
      id: 'affirm',
      label: 'Yes',
      smallTalk: true,
      priority: 2,
      maxTokens: 4,
      yields: true,
      redirect: 'offer', // "yes" accepts whatever the bot just offered
      keywords: [
        'yes', 'yeah', 'yep', 'yup', 'sure', 'definitely', 'absolutely',
        'of course', 'go ahead', 'why not', 'please do', 'yes please',
        'sure thing', 'i would', 'i d like that', 'that would be great'
      ],
      answer: [
        'Great! What would you like to know? Pick a topic below or type your own question.'
      ],
      related: QUICK_START
    },
    {
      id: 'negate',
      label: 'No',
      smallTalk: true,
      priority: 2,
      maxTokens: 3,
      keywords: ['no', 'nope', 'nah', 'not really'],
      answer: [
        "No problem{,name}! If you think of anything else, just ask.",
        "That's okay! I'm here whenever you have a question."
      ]
    },
    {
      id: 'more',
      label: 'Tell me more',
      smallTalk: true,
      priority: 3,
      maxTokens: 5,
      yields: true,
      redirect: 'more', // walks to the next related topic not yet covered
      keywords: [
        'tell me more', 'more detail*', 'more info', 'more information',
        'elaborate', 'go on', 'continue', 'explain more', 'explain further',
        'say more', 'what else', 'anything else'
      ],
      answer: [
        'Happy to help! What would you like to know more about? Pick a topic below or type your question.'
      ],
      related: ALL_TOPICS
    },
    {
      id: 'joke',
      label: 'Tell a joke',
      smallTalk: true,
      priority: 2,
      maxTokens: 8,
      keywords: [
        'joke*', 'funny', 'laugh*', 'make me laugh', 'humor', 'humour', 'pun', 'puns'
      ],
      answer: [
        'Why did the smartphone need glasses? It lost all its contacts! ...Okay, maybe I should stick to answering questions about our NGO.',
        'Why did the tree join a video call? To stay in touch with its roots! 🌳',
        'Why was the computer cold? It left its Windows open!'
      ],
      related: QUICK_START
    },
    {
      id: 'bot_identity',
      label: 'Who are you?',
      smallTalk: true,
      priority: 4,
      keywords: [
        'your name', 'what is your name', 'who are you', 'what are you',
        'are you a robot', 'are you a bot', 'are you an ai', 'are you ai',
        'are you human', 'are you real', 'are you a real person',
        'are you a person', 'is this a bot', 'is this a robot', 'is this ai',
        'talking to a bot', 'talking to a human', 'chatbot', 'who made you',
        'who built you', 'who created you', 'who programmed you',
        'ashbot', 'ash bot'
      ],
      answer:
        "I'm AshBot, the Aśvattha Assistant, a chatbot built into this website (not a person!). Aśvattha is an " +
        'intergenerational community school project that connects seniors and youth, and I can tell you about our ' +
        'programs and how to get involved. If you would like to talk to a human, our team is a message away on the Contact page.',
      related: ['programs', 'contact'],
      actions: ['contact']
    },
    {
      id: 'frustrated',
      label: 'Talk to the team',
      smallTalk: true,
      priority: 4,
      keywords: [
        'not helpful', 'not useful', 'useless', 'stupid', 'dumb', 'wrong answer',
        'that is wrong', 'that is not what i asked', 'not what i asked',
        'not what i meant', 'you did not understand', 'you do not understand',
        'bad bot', 'terrible', 'awful', 'you are wrong', 'did not help',
        'does not help', 'not helping'
      ],
      answer: [
        "I'm sorry I wasn't able to help with that. I'm only a simple assistant, but our team would be glad to help you personally through the Contact page.",
        "Sorry about that! I'm still learning. If I couldn't answer your question, the Aśvattha team can help you directly."
      ],
      related: QUICK_START,
      actions: ['contact']
    },
    {
      id: 'help',
      label: 'What can I ask?',
      smallTalk: true,
      priority: 1,
      keywords: [
        'help', 'what can you do', 'what can you help with', 'what can i ask',
        'what do you know', 'what should i ask', 'topics', 'menu', 'options',
        'faq*', 'assist*', 'i have a question', 'i have questions',
        'quick question', 'can i ask', 'may i ask'
      ],
      answer:
        'Here are some things I can help with. Tap a topic, or type your own question, such as ' +
        '"Who founded Aśvattha?" or "How do I volunteer?"',
      related: ['about', 'programs', 'eligibility', 'join', 'volunteer', 'pricing', 'events', 'location'],
      chipLimit: 8
    },

    /* ------------------------------ About ------------------------------- */
    {
      id: 'about',
      label: 'About Aśvattha',
      priority: 3,
      keywords: [
        'what is asvattha', 'what is ashvattha', 'what is ashwattha',
        'what is this', 'what is this site',
        'what is this website', 'what is this project', 'what is this about',
        'what do you do', 'what does asvattha do',
        'what does ashvattha do', 'what does ashwattha do',
        'what does your organization do', 'what does your ngo do',
        'about us', 'about asvattha', 'about ashvattha', 'about ashwattha',
        'about the project',
        'about your organization', 'about your ngo', 'tell me about asvattha',
        'tell me about ashvattha', 'tell me about ashwattha',
        'tell me about your organization', 'tell me about your ngo',
        'ngo', 'nonprofit', 'non profit', 'charity', 'intergenerational',
        'generation gap', 'generational gap', 'across generations', 'bridge*',
        'how does it work', 'how does this work', 'how does asvattha work',
        'how does ashvattha work', 'how does ashwattha work'
      ],
      weak: [
        'asvattha', 'ashvattha', 'ashwattha', 'project', 'organization',
        'organisation', 'initiative', 'concept', 'overview', 'explain', 'stand for'
      ],
      answer:
        'Aśvattha is an intergenerational community school project dedicated to bridging the generation gap between ' +
        'senior citizens and youth. Through Digital Literacy Workshops and Oral History Storytelling Circles, we help build ' +
        'meaningful relationships, digital confidence, and a lasting record of local history.',
      next: { intent: 'programs', prompt: 'Would you like to hear about our programs?' },
      related: ['mission', 'founders', 'eligibility']
    },
    {
      id: 'mission',
      label: 'Our mission',
      priority: 5,
      keywords: [
        'mission', 'goal*', 'purpose', 'vision', 'aim*', 'objective*',
        'why do you exist', 'why does asvattha exist',
        'why does ashvattha exist', 'why does ashwattha exist',
        'why was asvattha created', 'why was ashvattha created',
        'why was ashwattha created', 'why did you start',
        'why did you create', 'why do you do this', 'what are you trying to do',
        'what do you hope', 'impact', 'achieve*', 'believe*', 'philosophy',
        'motivation', 'inspired', 'inspiration'
      ],
      weak: ['value'],
      answer:
        'Our mission is to foster meaningful relationships, build digital confidence, and preserve local history through ' +
        'shared human connection and community engagement. Seniors share their lived experiences and wisdom, youth ' +
        'volunteers share their time and tech know-how, and both generations come away more connected.',
      next: { intent: 'programs', prompt: 'Would you like to see how we put this into practice?' },
      related: ['founders', 'benefits']
    },
    {
      id: 'founders',
      label: 'Founders',
      priority: 8,
      keywords: [
        'founder*', 'cofounder*', 'co founder*', 'founded', 'founding',
        'who founded', 'who started', 'who created', 'who made', 'who runs',
        'who leads', 'who manages', 'who is behind', 'who is in charge',
        'who owns', 'behind asvattha', 'behind ashvattha', 'behind ashwattha',
        'started by', 'created by',
        'founded by', 'run by', 'led by', 'mudita', 'yutika', 'agrawal',
        'solanki', 'leader*', 'ceo', 'director', 'president', 'organizer*',
        'organiser*', 'creator*', 'how did it start', 'how did you start',
        'how did asvattha start', 'how did ashvattha start',
        'how did ashwattha start', 'how did this start', 'how did it begin',
        'origin*', 'history of asvattha', 'history of ashvattha',
        'history of ashwattha', 'why was asvattha started',
        'why was ashvattha started', 'why was ashwattha started'
      ],
      weak: ['team'],
      answer:
        `Aśvattha was co-founded by ${PROFILE.founders}. They lead this intergenerational community school project, ` +
        'working alongside student volunteers and community members to bridge the generation gap.',
      next: { intent: 'mission', prompt: 'Would you like to know about our mission?' },
      related: ['programs', 'contact']
    },
    {
      id: 'benefits',
      label: 'Why take part?',
      priority: 5,
      keywords: [
        'benefit*', 'why join', 'why should i join', 'why should i volunteer',
        'what do i get', 'what do i gain', 'what will i gain',
        'what is in it for me', 'is it worth', 'worth it', 'advantage*'
      ],
      answer:
        'Here is what people get out of Aśvattha:\n' +
        '• Seniors (60+) feel less isolated, gain confidence with everyday technology, and share their life stories.\n' +
        '• Youth give back to their community, mentor seniors, practice active listening, and learn from older generations.\n' +
        'And everything is 100% free.',
      next: { intent: 'join', prompt: 'Would you like to know how to take part?' },
      related: ['eligibility', 'volunteer']
    },

    /* ----------------------------- Programs ----------------------------- */
    {
      id: 'programs',
      label: 'Our programs',
      priority: 5,
      keywords: [
        'program*', 'programme*', 'service*', 'offer*', 'activit*',
        'what do you offer', 'what can i do', 'what can i join',
        'what can i attend', 'what happens', 'what to expect',
        'what can i expect', 'what will i do', 'core programs',
        'main programs', 'list of programs'
      ],
      answer:
        'We run two core programs, and both are completely free:\n' +
        '1. Digital Literacy Workshops: hands-on, beginner-friendly sessions on smartphones, video calls, safe social media use, and spotting online scams.\n' +
        "2. Oral History Storytelling Circles: structured conversations that capture seniors' life stories, lessons, and legacies in written archives.",
      next: { intent: 'join', prompt: 'Would you like to know how to take part?' },
      related: ['digital', 'oral_history', 'pricing']
    },
    {
      id: 'digital',
      label: 'Digital workshops',
      priority: 5,
      keywords: [
        'digital*', 'literacy', 'workshop*', 'tech*', 'tech support', 'tech help',
        'one on one', 'hands on', 'training', 'computer*', 'laptop*',
        'smartphone*', 'iphone*', 'android', 'tablet*', 'ipad*', 'internet',
        'wifi', 'wi fi'
      ],
      weak: [
        'class', 'lesson*', 'learn*', 'teach*', 'taught', 'course*', 'session*',
        'phone*', 'mobile*', 'online', 'app', 'device*', 'gadget*'
      ],
      answer:
        'Our Digital Literacy Workshops are hands-on, beginner-friendly sessions where friendly youth volunteers guide seniors ' +
        'step by step. We help with navigating smartphones, making video calls to stay close to distant family, using social ' +
        'media safely, and spotting online scams. All workshops are 100% free!',
      next: { intent: 'join', prompt: 'Would you like to know how to sign up?' },
      related: ['video_calls', 'beginner', 'safety'],
      actions: ['workshops']
    },
    {
      id: 'video_calls',
      label: 'Video calls',
      priority: 6,
      keywords: [
        'video call*', 'video chat*', 'videocall*', 'facetime', 'skype', 'zoom',
        'google meet', 'whatsapp', 'call my family', 'call family',
        'connect with family', 'distant family', 'family far away',
        'family abroad', 'long distance', 'see my family'
      ],
      answer:
        'Yes! Video calling is a key part of our Digital Literacy Workshops. Our volunteers guide seniors step by step ' +
        'through making video calls, so they can see and talk with distant family members and friends. If you have a ' +
        'particular app in mind, mention it when you contact us and the team can tell you how they can help.',
      next: { intent: 'digital', prompt: 'Want to hear more about the Digital Literacy Workshops?' },
      related: ['join', 'beginner'],
      actions: ['contact']
    },
    {
      id: 'social_media',
      label: 'Social media',
      priority: 6,
      keywords: [
        'social media', 'facebook', 'instagram', 'twitter', 'tiktok',
        'snapchat', 'social network*'
      ],
      answer:
        'Yes, using social media safely is part of our Digital Literacy Workshops. We help seniors stay connected with ' +
        'friends and family online, and we teach how to recognize online scams along the way.',
      next: { intent: 'safety', prompt: 'Want to know how we keep people safe online?' },
      related: ['digital', 'join']
    },
    {
      id: 'oral_history',
      label: 'Storytelling circles',
      priority: 6,
      keywords: [
        'oral history', 'oral', 'story', 'storytell*', 'story telling',
        'story circle*', 'life story', 'history', 'heritage', 'legacy',
        'memory', 'memoir*', 'archive*', 'interview*', 'podcast*', 'preserv*',
        'local history', 'lived experience*', 'share my story',
        'share stories', 'wisdom', 'circle*', 'reminisc*', 'personal history'
      ],
      weak: ['record*'],
      answer:
        'Our Oral History Storytelling Circles capture and preserve the life stories, lessons, and personal legacies of our ' +
        'senior participants. Through structured, friendly conversational interviews and written archives, we keep local ' +
        'history and hard-won wisdom alive for future generations. Sharing your story is always your choice.',
      next: { intent: 'join', prompt: 'Interested in taking part? I can explain how to sign up.' },
      related: ['safety', 'seniors', 'youth']
    },
    {
      id: 'resources',
      label: 'Free guides',
      priority: 6,
      keywords: [
        'resource*', 'handout*', 'material*', 'tutorial*', 'worksheet*', 'pdf',
        'download*', 'cheat sheet*', 'manual*', 'digital resource*', 'take home'
      ],
      weak: ['guide'],
      answer:
        'Yes! Aśvattha provides digital resource guides, and like everything we offer they are 100% free. The Workshops ' +
        'page on our website is a good place to start, or you can ask the team through the Contact page.',
      related: ['digital', 'pricing'],
      actions: ['workshops', 'contact']
    },

    /* ------------------------------ People ------------------------------ */
    {
      id: 'eligibility',
      label: 'Who can join',
      priority: 6,
      keywords: [
        'who can join', 'who can attend', 'who can participate', 'who can come',
        'who is it for', 'who is this for', 'who are the participants',
        'who participates', 'who attends', 'who is eligible', 'target audience',
        'who do you serve', 'who do you help', 'age limit', 'age requirement*',
        'age group*', 'how old', 'minimum age', 'maximum age', 'eligib*',
        'anyone can join', 'open to everyone', 'open to all', 'everyone welcome',
        'seniors and youth', 'seniors and students', 'youth and seniors',
        'students and seniors', 'seniors only', 'only for seniors', 'only seniors',
        'youth only', 'students only', 'only for students', 'only for youth',
        'only students', 'only youth'
      ],
      weak: ['age', 'audience', 'restriction*', 'requirement*', 'qualif*'],
      answer:
        'Aśvattha welcomes two groups:\n' +
        '• Seniors (ages 60+) who want to feel less isolated, gain confidence with everyday technology, and share their life stories.\n' +
        '• Youth: high school and college students who want to give back, mentor seniors, practice active listening, and learn from older generations.\n' +
        'All of our programs are 100% free.',
      next: { intent: 'join', prompt: 'Would you like to know how to sign up?' },
      related: ['seniors', 'youth', 'pricing']
    },
    {
      id: 'seniors',
      label: 'For seniors',
      priority: 6,
      keywords: [
        'senior*', 'elder*', 'older adult*', 'older people', 'older person',
        'older generation*', 'old people', 'grandparent*', 'grandma*',
        'grandmother*', 'grandpa*', 'grandfather*', 'retiree*', 'retired',
        'pensioner*', 'my mom', 'my mum', 'my dad', 'my mother', 'my father',
        'my parents', 'my parent', '60', 'sixty', 'isolat*', 'lonel*'
      ],
      weak: ['citizen*', 'alone'],
      answer:
        'Our senior participants are older adults aged 60 and above. Many join us to feel less isolated, build confidence ' +
        'with everyday technology, and share their lived experiences and personal histories. If you or a loved one would ' +
        "like to take part, send us a message through the Contact page. It's completely free!",
      next: { intent: 'join', prompt: 'Would you like to know how to sign up?' },
      related: ['digital', 'oral_history', 'beginner'],
      actions: ['contact']
    },
    {
      id: 'youth',
      label: 'For youth',
      priority: 6,
      keywords: [
        'youth*', 'student*', 'teen*', 'high school*', 'highschool*', 'college*',
        'university', 'young people', 'young person', 'young adult*',
        'younger generation*', 'kids', 'mentor*', 'active listening',
        'listening skills', 'school kids'
      ],
      answer:
        'Our youth participants are high school and college students who want to give back to their community. As ' +
        'volunteers and mentors, they help seniors with everyday technology, practice active listening, and learn from the ' +
        'wisdom of older generations. Want to be part of it? Send us a message through the Contact page!',
      next: { intent: 'volunteer', prompt: 'Would you like to know how to volunteer?' },
      related: ['beginner', 'benefits'],
      actions: ['contact']
    },
    {
      id: 'beginner',
      label: 'No experience needed?',
      priority: 6,
      keywords: [
        'beginner*', 'no experience', 'no prior experience', 'prior experience',
        'experience needed', 'experience required', 'need experience',
        'never used', 'never touched', 'first time', 'complete beginner',
        'not tech savvy', 'not good with tech*', 'not good with computer*',
        'not good with phone*', 'bad with tech*', 'afraid of tech*',
        'scared of tech*', 'intimidated', 'intimidating', 'too old', 'too late',
        'zero knowledge', 'from scratch', 'novice', 'no knowledge', 'new to tech*'
      ],
      weak: ['nervous', 'anxious', 'overwhelmed', 'confused', 'clueless', 'basic'],
      answer:
        'No experience needed! Our workshops are hands-on and beginner-friendly, with patient youth volunteers guiding ' +
        "seniors step by step, and it's never too late to learn. Volunteers don't need teaching experience either, just " +
        'patience and a listening ear.',
      next: { intent: 'join', prompt: 'Would you like to know how to sign up?' },
      related: ['digital', 'volunteer']
    },

    /* ----------------------------- Taking part -------------------------- */
    {
      id: 'join',
      label: 'How to join',
      priority: 7,
      keywords: [
        'join*', 'sign up', 'signup', 'sign me up', 'register*', 'enroll*',
        'enrol*', 'apply*', 'application*', 'particip*', 'attend*', 'take part',
        'become a member', 'membership', 'how do i join', 'how to join',
        'how can i join', 'can i join', 'can i attend', 'i want to join',
        'want to join', 'get started', 'how to start', 'how do i start',
        'how do i get started', 'reserve', 'rsvp', 'book a spot', 'book a session'
      ],
      answer:
        'Joining is easy and free! Seniors can sign up to attend our workshops and storytelling circles, and students or ' +
        'community members can sign up to volunteer. Just send us a message through the contact form on our website, and ' +
        'our team will help you get started.',
      next: { intent: 'events', prompt: 'Want to know when sessions take place?' },
      related: ['pricing', 'beginner', 'location'],
      actions: ['contact']
    },
    {
      id: 'volunteer',
      label: 'Volunteer',
      priority: 7,
      keywords: [
        'volunteer*', 'get involved', 'how can i help', 'how can we help',
        'i want to help', 'want to help', 'help out', 'lend a hand', 'pitch in',
        'become a mentor', 'be a mentor', 'give my time', 'give back',
        'looking to help', 'make a difference', 'how to volunteer',
        'how do i volunteer', 'how can i volunteer', 'can i volunteer',
        'want to volunteer', 'like to volunteer', 'sign up to volunteer',
        'contribut*'
      ],
      weak: ['involved', 'involvement'],
      answer:
        'Volunteers are the heart of Aśvattha! Students and community members can mentor seniors in our Digital ' +
        'Literacy Workshops or take part in our Oral History Storytelling Circles as active listeners. No prior teaching ' +
        'experience is required, just patience and a listening ear. To sign up, send us a message through the contact form ' +
        'on our website.',
      next: { intent: 'beginner', prompt: 'Wondering whether you need any experience?' },
      related: ['youth', 'events', 'benefits'],
      actions: ['contact']
    },
    {
      id: 'pricing',
      label: 'Cost',
      priority: 8,
      keywords: [
        'free', 'for free', 'free of charge', 'is it free', 'are the workshops free',
        'are workshops free', 'cost*', 'fee', 'price*', 'pricing', 'pay',
        'paying', 'payment*', 'paid', 'charge*', 'afford*', 'expensive', 'cheap',
        'how much', 'no cost', 'no charge', 'zero cost', 'complimentary',
        'tuition', 'subscription', 'rupee*', 'dollar*', 'hidden cost*', 'hidden fee*', "paisa"
      ],
      weak: ['money', 'budget'],
      answer:
        "It's 100% free! All of our workshops, community sessions, and digital resource guides are provided at no charge, " +
        'so everyone in the community has equal access. There are no fees or hidden costs.',
      next: { intent: 'join', prompt: 'Would you like to know how to sign up?' },
      related: ['eligibility', 'programs']
    },
    {
      id: 'safety',
      label: 'Privacy and safety',
      priority: 8,
      keywords: [
        'safe*', 'secur*', 'privacy', 'confidential*', 'personal information',
        'personal details', 'personal data', 'scam*', 'fraud*', 'phishing',
        'hack*', 'password*', 'consent', 'background check*', 'vetted',
        'vetting', 'is it safe', 'can i trust', 'cyber*'
      ],
      weak: ['private', 'protect*', 'data', 'permission', 'trust*', 'trained'],
      answer:
        'Safety and privacy come first. In our workshops we teach seniors how to spot online scams and use technology ' +
        'safely, and our volunteers are trained to handle digital information carefully. Oral history stories are only ' +
        "recorded or archived with the participant's explicit consent. For specific questions about our safeguarding " +
        'practices, please reach out through the Contact page.',
      next: { intent: 'contact', prompt: 'Would you like to know how to reach the team?' },
      related: ['digital', 'oral_history'],
      actions: ['contact']
    },
    {
      id: 'accessibility',
      label: 'Accessibility',
      priority: 6,
      keywords: [
        'accessib*', 'wheelchair*', 'disabilit*', 'disabled', 'mobility',
        'hearing aid*', 'hearing impaired', 'hard of hearing', 'deaf',
        'low vision', 'vision impaired', 'visually impaired', 'blind',
        'impaired', 'special needs', 'accommodat*', 'assistive', 'ramp',
        'elevator', 'equitable', 'inclusive', 'inclusion'
      ],
      weak: ['transport*', 'pick up', 'pickup', 'bus', 'lift'],
      answer:
        'Equitable access is at the heart of Aśvattha, which is why all of our workshops, community sessions, and ' +
        'resources are 100% free. If you or someone you know has specific accessibility needs (such as mobility, hearing, ' +
        'vision, or transportation), please tell us through the Contact page so our team can do their best to accommodate you.',
      next: { intent: 'contact', prompt: 'Would you like to know how to reach the team?' },
      related: ['location', 'language'],
      actions: ['contact']
    },

    /* ------------------------ Where, when, and how ---------------------- */
    {
      id: 'events',
      label: 'Events',
      priority: 7,
      keywords: [
        'event*', 'schedule*', 'calendar', 'upcoming', 'next session',
        'next workshop', 'next event', 'next meeting', 'next circle', 'when is',
        'when are', 'when do', 'how often', 'frequency', 'biweekly', 'bi weekly',
        'weekly', 'monthly', 'every week', 'every two weeks', 'every other week',
        'twice a month', 'what day', 'which day', 'what time', 'weekend*',
        'weekday*', 'morning', 'afternoon', 'evening', 'this week', 'next week',
        'this month', 'next month', 'meetup*', 'gathering*', 'timing*', 'hours'
      ],
      weak: [
        'when', 'time', 'date', 'today', 'tomorrow', 'happening', 'meet', 'meeting*'
      ],
      answer:
        `Our workshops and community circles generally take place ${PROFILE.sessionFrequency}. For exact dates, times, and ` +
        'any upcoming special events, please check the Events page on our website, which always has the most up-to-date schedule.',
      next: { intent: 'location', prompt: 'Would you like to know where sessions are held?' },
      related: ['join', 'language'],
      actions: ['events']
    },
    {
      id: 'location',
      label: 'Locations',
      priority: 7,
      keywords: [
        'where is', 'where are', 'where are you', 'where do you meet',
        'where is it held', 'where are sessions held',
        'where do sessions take place', 'locat*', 'venue*', 'address*',
        'based in', 'directions', 'map', 'nearby', 'near me', 'nearest',
        'in my area', 'in my city', 'in my town', 'in my neighborhood',
        'in my neighbourhood', 'community center*', 'community centre*',
        'library', 'libraries', 'in person', 'onsite', 'on site',
        'headquarter*', 'office', 'branch*', 'chapter*'
      ],
      weak: [
        'where', 'where can', 'where do', 'where does', 'city', 'town', 'country',
        'neighborhood', 'neighbourhood', 'operate', 'operating', 'travel'
      ],
      answer:
        `We operate locally, hosting sessions at ${PROFILE.venues}. Check the Events page on our website for the exact ` +
        "venue of each upcoming meetup, or ask our team through the Contact page if you'd like help finding the session " +
        'nearest to you.',
      next: { intent: 'events', prompt: 'Want to know when sessions take place?' },
      related: ['accessibility', 'join'],
      actions: ['events', 'contact']
    },
    {
      id: 'language',
      label: 'Languages',
      priority: 7,
      keywords: [
        'language*', 'bilingual', 'multilingual', 'translat*', 'interpret*',
        'native language', 'mother tongue', 'non english', 'other languages',
        'english', 'spanish', 'hindi', 'marathi', 'french', 'german', 'arabic',
        'mandarin', 'chinese', 'tamil', 'gujarati', 'bengali', 'urdu',
        'kannada', 'telugu', 'punjabi'
      ],
      weak: ['speak', 'spoken'],
      answer:
        'We want our workshops to be welcoming to everyone. Many of our youth volunteers are bilingual, which lets us offer ' +
        'digital literacy support and capture stories in more than one language. If you need help in a particular language, ' +
        'let our team know through the Contact page so we can do our best to accommodate you.',
      next: { intent: 'contact', prompt: 'Would you like to know how to reach the team?' },
      related: ['accessibility', 'join'],
      actions: ['contact']
    },

    /* ----------------------------- Reaching us -------------------------- */
    {
      id: 'contact',
      label: 'Contact us',
      priority: 8,
      keywords: [
        'contact*', 'email*', 'e mail', 'mail', 'phone number', 'contact number',
        'telephone', 'call you', 'call us', 'ring you', 'reach*', 'get in touch',
        'in touch', 'message*', 'contact form', 'inbox', 'write to',
        'talk to someone', 'speak to someone', 'talk to a person',
        'speak to a person', 'talk to a human', 'speak to a human',
        'real person', 'real human', 'staff', 'facebook page', 'instagram page',
        'your facebook', 'your instagram', 'your twitter', 'on facebook',
        'on instagram', 'on twitter', 'on linkedin', 'on youtube',
        'youtube channel', 'linkedin', 'follow us', 'follow you',
        'social media page*', 'social media account*', 'social media handle*',
        'social handle*', 'respond*', 'response time', 'get back to me',
        'inquiry', 'enquiry', 'feedback', 'complaint*', 'suggestion*'
      ],
      weak: ['form', 'website', 'reply'],
      answer:
        'You can reach the Aśvattha team through the Contact page on this website by sending us a message through the ' +
        `form. We try to respond within ${PROFILE.replyTime}! Whether you'd like to join a workshop, volunteer, share your ` +
        "story, or partner with us, we'd love to hear from you.",
      related: ['join', 'volunteer', 'partnerships'],
      actions: ['contact']
    },
    {
      id: 'partnerships',
      label: 'Partnerships',
      priority: 7,
      keywords: [
        'partner*', 'sponsor*', 'collaborat*', 'work with you', 'work together',
        'team up', 'join forces', 'cooperate', 'donat*', 'grant*', 'invest*',
        'support you', 'support your mission', 'support the project',
        'support asvattha', 'support ashvattha', 'support ashwattha',
        'give money', 'csr', 'corporate', 'fund*'
      ],
      weak: ['business*', 'company', 'companies'],
      answer:
        'We love collaborating with local businesses, schools, and civic organizations! If your organization would like to ' +
        'partner with, sponsor, or otherwise support Aśvattha, please drop us a message via the Contact page and our ' +
        'team will be glad to talk.',
      next: { intent: 'contact', prompt: 'Would you like to know how to reach the team?' },
      related: ['mission', 'volunteer'],
      actions: ['contact']
    }
  ];

  /* =========================================================================
     3. LANGUAGE ENGINE
     ========================================================================= */

  const WEAK_FACTOR = 0.4;      // weight of one word in a "weak" keyword
  const MIN_CORRECT_LEN = 6;    // shorter words are never spell-corrected
  const NON_LATIN = /[\u0370-\u03FF\u0400-\u04FF\u0590-\u06FF\u0900-\u0DFF\u0E00-\u0EFF\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/;

  // Ordinary words that must never be "corrected" into a keyword.
  const COMMON_WORDS = new Set([
    'please', 'people', 'person', 'should', 'really', 'anyone', 'someone',
    'before', 'during', 'another', 'through', 'because', 'between', 'without',
    'around', 'whether', 'things', 'something', 'anything', 'everything',
    'nothing', 'interested', 'available', 'possible', 'information', 'question',
    'answer', 'looking', 'thinking', 'wanting', 'wondering', 'tonight',
    'yesterday', 'together', 'anybody', 'everyone', 'family', 'friend',
    'brother', 'sister', 'school', 'special', 'general', 'simple', 'public'
  ]);

  const STEM_KEEP = new Set([
    'yes', 'was', 'has', 'does', 'goes', 'this', 'his', 'its', 'news',
    'always', 'perhaps', 'thanks'
  ]);

  function normalize(text) {
    return String(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2018\u2019\u02bc]/g, "'")
      .replace(/&/g, ' and ')
      .replace(/\bcan't\b/g, 'can not')
      .replace(/\bwon't\b/g, 'will not')
      .replace(/n't\b/g, ' not')
      .replace(/'s\b/g, ' is')
      .replace(/'m\b/g, ' am')
      .replace(/'re\b/g, ' are')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Light plural stemming so "workshops", "stories" and "classes" match their
  // singular keywords. Applied identically to keywords and visitor text.
  function stem(word) {
    if (word.length <= 3 || STEM_KEEP.has(word)) return word;
    if (/(ss|us|is|ous)$/.test(word)) return word;
    if (word.length > 4 && /ies$/.test(word)) return word.slice(0, -3) + 'y';
    if (/sses$/.test(word)) return word.slice(0, -2);
    if (/s$/.test(word)) return word.slice(0, -1);
    return word;
  }

  // Damerau-Levenshtein (adjacent swaps count as one edit), with early exit.
  function editDistance(a, b, max) {
    if (a === b) return 0;
    const la = a.length;
    const lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;

    let prev2 = null;
    let prev = [];
    for (let j = 0; j <= lb; j += 1) prev.push(j);

    for (let i = 1; i <= la; i += 1) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= lb; j += 1) {
        const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        let value = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (
          i > 1 && j > 1 &&
          a.charAt(i - 1) === b.charAt(j - 2) &&
          a.charAt(i - 2) === b.charAt(j - 1)
        ) {
          value = Math.min(value, prev2[j - 2] + 1);
        }
        cur[j] = value;
        if (value < rowMin) rowMin = value;
      }
      if (rowMin > max) return max + 1;
      prev2 = prev;
      prev = cur;
    }
    return prev[lb];
  }

  /* ---- Compiling the knowledge base ----------------------------------- */

  function compileKeyword(raw, weak) {
    const isPrefix = raw.charAt(raw.length - 1) === '*';
    const base = (isPrefix ? raw.slice(0, -1) : raw).trim().toLowerCase();

    if (!/^[a-z0-9 ]+$/.test(base)) {
      console.warn('[AshBot] This keyword can never match: "' + raw + '"');
    }

    const parts = base.split(/\s+/);
    const words = parts.map(function (word, index) {
      const isLastPrefix = isPrefix && index === parts.length - 1;
      return isLastPrefix ? word : stem(word);
    });

    return {
      words: words,
      prefix: isPrefix,
      weak: !!weak,
      weight: words.length * (weak ? WEAK_FACTOR : 1)
    };
  }

  function compileIntent(def) {
    if (!def || typeof def.id !== 'string' || !def.id) {
      throw new Error('[AshBot] Every intent needs a string "id".');
    }
    if (def.answer === undefined) {
      throw new Error('[AshBot] Intent "' + def.id + '" needs an "answer".');
    }

    const intent = Object.assign(
      {
        label: def.id,
        priority: 5,
        smallTalk: false,
        maxTokens: Infinity,
        keywords: [],
        weak: [],
        patterns: [],
        related: [],
        actions: []
      },
      def
    );

    intent.matchers = intent.keywords
      .map(function (k) { return compileKeyword(String(k), false); })
      .concat(intent.weak.map(function (k) { return compileKeyword(String(k), true); }));

    intent.patternList = intent.patterns.map(function (p) {
      return p instanceof RegExp ? { re: p, w: 3 } : { re: p.re, w: p.w || 3 };
    });

    return intent;
  }

  let COMPILED = [];
  const BY_ID = Object.create(null);
  let KNOWN_WORDS = new Set();
  let PREFIX_STEMS = [];
  let CORRECTION_TARGETS = [];

  function rebuildIndex() {
    Object.keys(BY_ID).forEach(function (key) { delete BY_ID[key]; });
    COMPILED.forEach(function (intent) { BY_ID[intent.id] = intent; });

    KNOWN_WORDS = new Set();
    PREFIX_STEMS = [];
    const targets = Object.create(null);

    COMPILED.forEach(function (intent) {
      intent.matchers.forEach(function (matcher) {
        matcher.words.forEach(function (word, index) {
          const isLastPrefix = matcher.prefix && index === matcher.words.length - 1;
          if (isLastPrefix) PREFIX_STEMS.push(word);
          else KNOWN_WORDS.add(word);

          if (word.length >= MIN_CORRECT_LEN && !/\d/.test(word)) {
            targets[word + '|' + (isLastPrefix ? 'p' : 'e')] = { word: word, prefix: isLastPrefix };
          }
        });
      });
    });

    CORRECTION_TARGETS = Object.keys(targets).map(function (key) { return targets[key]; });
  }

  function registerIntents(defs) {
    (Array.isArray(defs) ? defs : [defs]).forEach(function (def) {
      const compiled = compileIntent(def);
      const existing = COMPILED.findIndex(function (i) { return i.id === compiled.id; });
      if (existing >= 0) COMPILED[existing] = compiled;
      else COMPILED.push(compiled);
    });
    rebuildIndex();
  }

  /* ---- Reading a visitor message -------------------------------------- */

  function isKnownWord(token) {
    if (KNOWN_WORDS.has(token) || COMMON_WORDS.has(token)) return true;
    for (let i = 0; i < PREFIX_STEMS.length; i += 1) {
      if (token.indexOf(PREFIX_STEMS[i]) === 0) return true;
    }
    return false;
  }

  // Fixes likely typos by snapping an unknown word to a keyword word that is
  // one or two edits away. Conservative on purpose: same first letter, 6+
  // letters, and never touches ordinary words or words already understood.
  function correctToken(token) {
    if (!CONFIG.spellCorrection) return token;
    if (token.length < MIN_CORRECT_LEN || /\d/.test(token) || isKnownWord(token)) return token;

    let best = null;
    let bestDistance = Infinity;

    CORRECTION_TARGETS.forEach(function (target) {
      if (target.word.charAt(0) !== token.charAt(0)) return;

      let distance;
      if (target.prefix) {
        // Compare against the same-length head of the word, +/- one letter,
        // so "volunterring" still reaches "volunteer*".
        distance = Infinity;
        for (let delta = -1; delta <= 1; delta += 1) {
          const head = token.slice(0, target.word.length + delta);
          distance = Math.min(distance, editDistance(head, target.word, 1));
        }
        if (distance > 1) return;
      } else {
        const limit = token.length >= 9 ? 2 : 1;
        distance = editDistance(token, target.word, limit);
        if (distance > limit) return;
      }

      if (distance < bestDistance) {
        best = target.word;
        bestDistance = distance;
      }
    });

    return best || token;
  }

  function analyze(rawInput) {
    const raw = String(rawInput == null ? '' : rawInput).slice(0, CONFIG.maxInputLength);
    const normalized = normalize(raw);
    const stems = normalized
      ? normalized.split(' ').map(function (word) { return correctToken(stem(word)); })
      : [];
    return { raw: raw, normalized: normalized, stems: stems, query: stems.join(' ') };
  }

  function matchIndex(stems, matcher) {
    const length = matcher.words.length;
    for (let i = 0; i + length <= stems.length; i += 1) {
      let ok = true;
      for (let j = 0; j < length; j += 1) {
        const word = matcher.words[j];
        const token = stems[i + j];
        const hit =
          j === length - 1 && matcher.prefix ? token.indexOf(word) === 0 : token === word;
        if (!hit) { ok = false; break; }
      }
      if (ok) return i;
    }
    return -1;
  }

  function tokenIndexAt(query, charIndex) {
    return query.slice(0, charIndex).split(' ').length - 1;
  }

  // Scores every intent. Within one intent, longer phrases are counted first
  // and each word of the message can only count once, so "how do i volunteer"
  // is not double-scored by "volunteer*" as well.
  function rankIntents(analysis) {
    const stems = analysis.stems;
    const ranked = [];

    COMPILED.forEach(function (intent, order) {
      if (stems.length > intent.maxTokens) return;

      const found = [];
      intent.matchers.forEach(function (matcher) {
        const start = matchIndex(stems, matcher);
        if (start >= 0) {
          found.push({
            start: start,
            end: start + matcher.words.length,
            weight: matcher.weight,
            weak: matcher.weak
          });
        }
      });

      found.sort(function (a, b) {
        return b.weight - a.weight || (b.end - b.start) - (a.end - a.start) || a.start - b.start;
      });

      const used = [];
      let score = 0;
      let strong = 0;
      let position = Infinity;

      found.forEach(function (hit) {
        for (let i = hit.start; i < hit.end; i += 1) if (used[i]) return;
        for (let i = hit.start; i < hit.end; i += 1) used[i] = true;
        score += hit.weight;
        if (!hit.weak) strong += 1;
        position = Math.min(position, hit.start);
      });

      intent.patternList.forEach(function (pattern) {
        const hit = pattern.re.exec(analysis.query);
        if (hit) {
          score += pattern.w;
          strong += 1;
          position = Math.min(position, tokenIndexAt(analysis.query, hit.index));
        }
      });

      if (score > 0) {
        ranked.push({
          intent: intent,
          score: score,
          strong: strong,
          position: position === Infinity ? 0 : position,
          order: order
        });
      }
    });

    ranked.sort(function (a, b) {
      return (
        b.score - a.score ||
        b.intent.priority - a.intent.priority ||
        a.order - b.order
      );
    });

    return ranked;
  }

  /* =========================================================================
     4. CONVERSATION
     ========================================================================= */

  function freshSession() {
    return { lastIntent: null, seen: [], offer: null, misses: 0, name: '', variants: {} };
  }

  let session = freshSession();

  function pickVariant(intent) {
    if (!Array.isArray(intent.answer)) return intent.answer;
    if (intent.answer.length === 1) return intent.answer[0];
    // Never repeat the same variant twice in a row.
    let index = Math.floor(Math.random() * intent.answer.length);
    if (index === session.variants[intent.id]) index = (index + 1) % intent.answer.length;
    session.variants[intent.id] = index;
    return intent.answer[index];
  }

  function fillTemplate(text) {
    return text
      .replace(/\{,name\}/g, session.name ? ', ' + session.name : '')
      .replace(/\{name\}/g, session.name || 'there');
  }

  function hasSeen(id) {
    return session.seen.indexOf(id) !== -1;
  }

  function chipsFor(intent) {
    const ids = [];
    if (intent.next && intent.next.intent) ids.push(intent.next.intent);
    (intent.related || []).forEach(function (id) { ids.push(id); });

    const unique = [];
    ids.forEach(function (id) {
      if (id !== intent.id && BY_ID[id] && unique.indexOf(id) === -1) unique.push(id);
    });

    // Offer topics the visitor has not explored yet first (the sort is stable).
    unique.sort(function (a, b) { return Number(hasSeen(a)) - Number(hasSeen(b)); });

    return unique.slice(0, intent.chipLimit || 4).map(function (id) {
      return { label: BY_ID[id].label, intent: id };
    });
  }

  function quickStartChips() {
    return QUICK_START.filter(function (id) { return BY_ID[id]; }).map(function (id) {
      return { label: BY_ID[id].label, intent: id };
    });
  }

  function uniqueActions(list) {
    const out = [];
    list.forEach(function (intent) {
      (intent.actions || []).forEach(function (page) {
        if (PAGES[page] && out.indexOf(page) === -1) out.push(page);
      });
    });
    return out.slice(0, 2).map(function (page) { return { page: page }; });
  }

  // Turns one or more matched intents into the reply shown to the visitor, and
  // updates what the bot remembers about the conversation.
  function compose(intents, options) {
    const opts = options || {};
    const last = intents[intents.length - 1];

    let text = intents.map(function (i) { return fillTemplate(pickVariant(i)); }).join('\n\n');
    if (opts.prefix) text = opts.prefix + '\n\n' + text;
    if (last.next && last.next.prompt) text += '\n\n' + last.next.prompt;

    intents.forEach(function (i) {
      if (!i.smallTalk && !hasSeen(i.id)) session.seen.push(i.id);
    });

    const topics = intents.filter(function (i) { return !i.smallTalk; });
    if (topics.length) session.lastIntent = topics[topics.length - 1].id;
    session.offer = topics.length && last.next ? last.next.intent : null;

    let chips = chipsFor(last);
    if (!chips.length) chips = last.smallTalk && last.id !== 'goodbye' && last.id !== 'thanks' && last.id !== 'negate'
      ? quickStartChips()
      : [];

    return {
      text: text,
      chips: chips,
      actions: uniqueActions(intents),
      intents: intents.map(function (i) { return i.id; }),
      confidence: 'high'
    };
  }

  function buildFallback() {
    session.misses += 1;
    session.offer = null;

    if (session.misses >= 3) {
      session.misses = 0;
      return {
        text:
          "I'm having trouble finding the right answer for that. Our team would be happy to help you directly, " +
          'and they usually reply within ' + PROFILE.replyTime + '.',
        chips: quickStartChips(),
        actions: [{ page: 'contact' }],
        intents: [],
        confidence: 'none'
      };
    }

    if (session.misses === 2) {
      return {
        text: "Sorry, I'm still not sure about that one. Here are the topics I know best:",
        chips: chipsFor(BY_ID.help),
        actions: [{ page: 'contact' }],
        intents: [],
        confidence: 'none'
      };
    }

    const replies = [
      "Hmm, I don't have an answer for that yet. I can tell you about our workshops, storytelling circles, " +
        'who can join, or how to get involved. You can also ask our team directly through the Contact page.',
      "That's a good question, but I don't have the details just yet. Try asking about our programs, " +
        'founders, cost, or how to volunteer, or message the team through the Contact page and they will be happy to help.'
    ];

    return {
      text: replies[Math.floor(Math.random() * replies.length)],
      chips: quickStartChips(),
      actions: [],
      intents: [],
      confidence: 'none'
    };
  }

  function buildClarification(ranked) {
    const candidates = ranked
      .filter(function (r) { return !r.intent.smallTalk; })
      .slice(0, 3);

    if (!candidates.length) return buildFallback();

    session.offer = null;
    return {
      text: "I'm not completely sure what you're asking. Did you mean one of these?",
      chips: candidates.map(function (r) { return { label: r.intent.label, intent: r.intent.id }; }),
      actions: [],
      intents: [],
      confidence: 'low'
    };
  }

  // "tell me more": move to the next related topic the visitor has not seen.
  function resolveMore() {
    const current = session.lastIntent && BY_ID[session.lastIntent];
    if (!current) return null;

    const queue = [];
    if (current.next && current.next.intent) queue.push(current.next.intent);
    (current.related || []).forEach(function (id) { queue.push(id); });

    for (let i = 0; i < queue.length; i += 1) {
      if (BY_ID[queue[i]] && !hasSeen(queue[i])) return BY_ID[queue[i]];
    }
    return null;
  }

  const NAME_INTRO = /\bmy name is ([a-z]{2,20})\b/;
  const NAME_BLOCKLIST = ['not', 'also', 'still', 'very', 'too', 'here', 'on', 'in'];

  function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  function emit(type, detail) {
    if (!CONFIG.emitEvents || typeof window.CustomEvent !== 'function') return;
    try {
      window.dispatchEvent(
        new CustomEvent('ashbot:chatbot', {
          detail: Object.assign({ type: type }, detail || {})
        })
      );
    } catch (e) { /* analytics must never break the chat */ }
  }

  function chooseIntents(ranked, analysis, rawInput) {
    let primary = ranked[0];

    // Context helpers ("yes", "tell me more") defer to any real topic match.
    if (primary.intent.yields) {
      const topic = ranked.find(function (r) { return !r.intent.smallTalk && r.score >= 1; });
      if (topic) primary = topic;
    }

    const chosen = [primary];

    if (!primary.intent.smallTalk) {
      const isCompound =
        /\b(and|also|plus)\b/.test(analysis.normalized) ||
        (String(rawInput).match(/\?/g) || []).length > 1;
      const minScore = isCompound ? 1 : 2;
      const minRatio = isCompound ? 0.5 : 0.6;

      const secondary = ranked.find(function (r) {
        return (
          r !== primary &&
          !r.intent.smallTalk &&
          r.score >= minScore &&
          r.score >= primary.score * minRatio
        );
      });
      if (secondary) chosen.push(secondary);
    }

    chosen.sort(function (a, b) { return a.position - b.position; });
    return chosen;
  }

  // The brain: message in, structured reply out.
  function reply(rawInput) {
    const analysis = analyze(rawInput);
    let result;

    if (!analysis.stems.length) {
      result = {
        text: NON_LATIN.test(String(rawInput))
          ? "I can only chat in English right now, but we'd love to help in your language. Many of our youth volunteers " +
            'are bilingual, so please let our team know through the Contact page.'
          : "I didn't quite catch that. Could you type your question again?",
        chips: quickStartChips(),
        actions: NON_LATIN.test(String(rawInput)) ? [{ page: 'contact' }] : [],
        intents: [],
        confidence: 'none'
      };
      emit('reply', { intents: [], confidence: 'none' });
      return result;
    }

    // Visitor introduces themselves.
    const intro = NAME_INTRO.exec(analysis.normalized);
    if (intro && analysis.stems.length <= 6 && NAME_BLOCKLIST.indexOf(intro[1]) === -1) {
      session.name = capitalize(intro[1]);
      session.offer = null;
      result = {
        text: 'Nice to meet you, ' + session.name + '! 🌱 What would you like to know about Aśvattha?',
        chips: quickStartChips(),
        actions: [],
        intents: [],
        confidence: 'high'
      };
      emit('reply', { intents: [], confidence: 'high' });
      return result;
    }

    const ranked = rankIntents(analysis);
    const top = ranked[0];

    if (!top) {
      result = buildFallback();
    } else if (top.score < 1 && analysis.stems.length > 3) {
      // Only faint, generic hints in a long message. Two or more hints are worth
      // a "did you mean"; a single stray word is treated as not understood.
      result = top.score >= 0.8 ? buildClarification(ranked) : buildFallback();
    } else {
      session.misses = 0;
      const chosen = chooseIntents(ranked, analysis, rawInput);
      const lead = chosen[0];

      if (lead.intent.redirect === 'offer' && session.offer && BY_ID[session.offer]) {
        result = compose([BY_ID[session.offer]]);
      } else if (lead.intent.redirect === 'more') {
        const next = resolveMore();
        if (next) {
          result = compose([next], { prefix: "Here's something else you might find helpful:" });
        } else if (session.lastIntent) {
          result = {
            text:
              "That's everything I have on that topic. For anything more specific, our team can help you directly " +
              'through the Contact page.',
            chips: chipsFor(BY_ID[session.lastIntent]),
            actions: [{ page: 'contact' }],
            intents: [],
            confidence: 'high'
          };
          session.offer = null;
        } else {
          result = compose([lead.intent]);
        }
      } else {
        result = compose(chosen.map(function (r) { return r.intent; }));
      }
    }

    const detail = { intents: result.intents, confidence: result.confidence };
    if (CONFIG.includeQueryInEvents) detail.query = analysis.raw;
    emit('reply', detail);
    return result;
  }

  // Answer a tapped quick reply directly, without re-reading text.
  function respondToIntent(id) {
    const intent = BY_ID[id];
    if (!intent) return buildFallback();
    session.misses = 0;
    const result = compose([intent]);
    emit('chip', { intents: [id], confidence: 'high' });
    return result;
  }

  function debug(rawInput) {
    const analysis = analyze(rawInput);
    return rankIntents(analysis).map(function (r) {
      return {
        topic: r.intent.id,
        score: Math.round(r.score * 100) / 100,
        priority: r.intent.priority,
        position: r.position,
        weakOnly: r.strong === 0
      };
    });
  }

  registerIntents(INTENTS);

  /* =========================================================================
     5. INTERFACE
     ========================================================================= */

  const ICON_ATTRS =
    'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';

  const ICONS = {
    chat:
      '<svg class="chatbot-icon chatbot-icon-chat" ' + ICON_ATTRS + '><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    chevron:
      '<svg class="chatbot-icon chatbot-icon-close" ' + ICON_ATTRS + '><polyline points="6 9 12 15 18 9"/></svg>',
    reset:
      '<svg class="chatbot-icon" ' + ICON_ATTRS + '><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    send:
      '<svg class="chatbot-icon" ' + ICON_ATTRS + '><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'
  };

  function init() {
    let container = document.getElementById('ngo-chatbot-container');

    if (!container) {
      container = document.createElement('div');
      container.id = 'ngo-chatbot-container';
      container.innerHTML =
        '<button type="button" id="chatbot-toggle-btn" aria-label="Open Chat" aria-expanded="false" aria-controls="chatbot-window">' +
          ICONS.chat + ICONS.chevron +
          '<span class="chatbot-toggle-label">Chat with AshBot</span>' +
        '</button>' +
        '<div id="chatbot-window" class="chatbot-hidden" role="dialog" aria-label="Aśvattha chat assistant">' +
          '<div class="chatbot-header">' +
            '<div class="chatbot-avatar" aria-hidden="true">🌱</div>' +
            '<div class="chatbot-heading">' +
              '<h3>AshBot</h3>' +
              '<div class="chatbot-status"><span class="chatbot-status-dot" aria-hidden="true"></span><span class="chatbot-status-text"></span></div>' +
            '</div>' +
            '<button type="button" id="chatbot-reset-btn" class="chatbot-header-btn" aria-label="Start a new conversation" title="New conversation">' + ICONS.reset + '</button>' +
            '<button type="button" id="chatbot-close-btn" class="chatbot-header-btn" aria-label="Close Chat">&times;</button>' +
          '</div>' +
          '<div class="chatbot-messages" id="chatbot-messages" role="log" aria-live="polite" aria-relevant="additions"></div>' +
          '<div class="chatbot-input-area">' +
            '<input type="text" id="chatbot-input" aria-label="Type your question" maxlength="' + CONFIG.maxInputLength + '" autocomplete="off" />' +
            '<button type="button" id="chatbot-send-btn" aria-label="Send message" disabled>' + ICONS.send + '</button>' +
          '</div>' +
          '<div class="chatbot-footnote"><span class="chatbot-footnote-text"></span><span class="chatbot-counter" id="chatbot-counter" aria-hidden="true"></span></div>' +
        '</div>';

      container.querySelector('#chatbot-input').placeholder = CONFIG.inputPlaceholder;
      container.querySelector('.chatbot-status-text').textContent = CONFIG.statusText;
      container.querySelector('.chatbot-footnote-text').textContent = CONFIG.footnote;
      document.body.appendChild(container);
    }

    const toggleBtn = document.getElementById('chatbot-toggle-btn');
    const closeBtn = document.getElementById('chatbot-close-btn');
    const resetBtn = document.getElementById('chatbot-reset-btn');
    const chatWindow = document.getElementById('chatbot-window');
    const sendBtn = document.getElementById('chatbot-send-btn');
    const inputField = document.getElementById('chatbot-input');
    const messagesArea = document.getElementById('chatbot-messages');
    const counter = document.getElementById('chatbot-counter');

    if (!chatWindow || !messagesArea || !inputField) return;

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---- State and storage ------------------------------------------- */

    let messages = [];      // { role: 'bot' | 'user', text, chips?, actions? }
    let isOpen = false;
    let epoch = 0;          // bumps on reset so stale timers do nothing
    let busy = false;
    const queue = [];
    let historyIndex = -1;

    function readStorage() {
      if (!CONFIG.persist) return null;
      try {
        const raw = window.sessionStorage.getItem(CONFIG.storageKey);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return data && data.v === 2 && Array.isArray(data.messages) ? data : null;
      } catch (e) {
        return null;
      }
    }

    function writeStorage() {
      if (!CONFIG.persist) return;
      try {
        window.sessionStorage.setItem(
          CONFIG.storageKey,
          JSON.stringify({
            v: 2,
            open: isOpen,
            messages: messages.slice(-CONFIG.maxStoredMessages),
            session: session
          })
        );
      } catch (e) { /* storage can be blocked; the chat still works */ }
    }

    function clearStorage() {
      try { window.sessionStorage.removeItem(CONFIG.storageKey); } catch (e) { /* ignore */ }
    }

    // Stored data is untrusted: rebuild each message from known-safe fields.
    function sanitizeMessage(m) {
      if (!m || (m.role !== 'bot' && m.role !== 'user') || typeof m.text !== 'string') return null;
      const clean = { role: m.role, text: m.text.slice(0, 1200) };
      if (Array.isArray(m.chips)) {
        clean.chips = m.chips
          .filter(function (c) { return c && typeof c.label === 'string' && BY_ID[c.intent]; })
          .slice(0, 8)
          .map(function (c) { return { label: c.label.slice(0, 60), intent: c.intent }; });
      }
      if (Array.isArray(m.actions)) {
        clean.actions = m.actions
          .filter(function (a) { return a && PAGES[a.page]; })
          .slice(0, 2)
          .map(function (a) { return { page: a.page }; });
      }
      return clean;
    }

    function restoreSession(saved) {
      if (!saved || typeof saved !== 'object') return;
      const fresh = freshSession();
      session = {
        lastIntent: BY_ID[saved.lastIntent] ? saved.lastIntent : null,
        seen: Array.isArray(saved.seen) ? saved.seen.filter(function (id) { return BY_ID[id]; }) : [],
        offer: BY_ID[saved.offer] ? saved.offer : null,
        misses: Number(saved.misses) > 0 ? Math.min(Number(saved.misses), 2) : 0,
        name: typeof saved.name === 'string' ? saved.name.replace(/[^A-Za-z]/g, '').slice(0, 20) : '',
        variants: fresh.variants
      };
    }

    /* ---- Rendering ---------------------------------------------------- */

    function scrollToBottom() {
      if (typeof messagesArea.scrollTo === 'function') {
        messagesArea.scrollTo({ top: messagesArea.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' });
      } else {
        messagesArea.scrollTop = messagesArea.scrollHeight;
      }
    }

    // Renders plain text with simple structure (bullets, numbered lists, paragraphs).
    // Everything is inserted with textContent, never as HTML.
    function renderRichText(target, text) {
      let list = null;
      let listKind = null;
      let gap = false;

      String(text).split('\n').forEach(function (line) {
        if (!line.trim()) { list = null; listKind = null; gap = true; return; }

        const bullet = /^\s*[•\-*]\s+(.*)$/.exec(line);
        const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);

        if (bullet || numbered) {
          const kind = bullet ? 'ul' : 'ol';
          if (!list || listKind !== kind) {
            list = document.createElement(kind);
            list.className = 'chatbot-list';
            if (gap) list.classList.add('chatbot-break');
            target.appendChild(list);
            listKind = kind;
          }
          const item = document.createElement('li');
          item.textContent = (bullet || numbered)[1];
          list.appendChild(item);
        } else {
          const block = document.createElement('div');
          block.className = 'chatbot-line' + (gap ? ' chatbot-break' : '');
          block.textContent = line.trim();
          target.appendChild(block);
          list = null;
          listKind = null;
        }
        gap = false;
      });
    }

    function buildActions(actions) {
      const links = (actions || [])
        .map(function (action) {
          const url = resolvePage(action.page);
          return url ? { url: url, label: PAGES[action.page].label, page: action.page } : null;
        })
        .filter(Boolean);

      if (!links.length) return null;

      const wrap = document.createElement('div');
      wrap.className = 'chatbot-actions';
      links.forEach(function (link) {
        const a = document.createElement('a');
        a.className = 'chatbot-action';
        a.href = link.url;
        a.textContent = link.label;
        a.addEventListener('click', function () { emit('action', { page: link.page }); });
        wrap.appendChild(a);
      });
      return wrap;
    }

    function buildRow(message) {
      const isUser = message.role === 'user';
      const row = document.createElement('div');
      row.className = 'chatbot-row ' + (isUser ? 'is-user' : 'is-bot');

      const bubble = document.createElement('div');
      bubble.className = isUser ? 'user-message' : 'bot-message';

      if (isUser) {
        bubble.textContent = message.text;
        row.appendChild(bubble);
        return row;
      }

      const avatar = document.createElement('div');
      avatar.className = 'chatbot-avatar-sm';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = '🌱';

      const stack = document.createElement('div');
      stack.className = 'chatbot-stack';

      renderRichText(bubble, message.text);
      stack.appendChild(bubble);

      const actions = buildActions(message.actions);
      if (actions) stack.appendChild(actions);

      row.appendChild(avatar);
      row.appendChild(stack);
      return row;
    }

    function clearChips() {
      const old = messagesArea.querySelectorAll('.chatbot-chips');
      for (let i = 0; i < old.length; i += 1) old[i].remove();
    }

    function renderChips(chips) {
      clearChips();
      if (!chips || !chips.length) return;

      const wrap = document.createElement('div');
      wrap.className = 'chatbot-chips';
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-label', 'Suggested questions');

      chips.forEach(function (chip) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chatbot-chip';
        button.textContent = chip.label;
        button.setAttribute('data-intent', chip.intent);
        wrap.appendChild(button);
      });

      messagesArea.appendChild(wrap);
    }

    function showTyping() {
      const row = document.createElement('div');
      row.className = 'chatbot-row is-bot is-typing';
      row.setAttribute('aria-hidden', 'true');

      const avatar = document.createElement('div');
      avatar.className = 'chatbot-avatar-sm';
      avatar.textContent = '🌱';

      const bubble = document.createElement('div');
      bubble.className = 'bot-message chatbot-typing';
      for (let i = 0; i < 3; i += 1) bubble.appendChild(document.createElement('span'));

      row.appendChild(avatar);
      row.appendChild(bubble);
      messagesArea.appendChild(row);
      scrollToBottom();
      return row;
    }

    function pushMessage(message, options) {
      const opts = options || {};
      messages.push(message);
      const row = buildRow(message);

      if (opts.replace && opts.replace.parentNode) opts.replace.replaceWith(row);
      else messagesArea.appendChild(row);

      return row;
    }

    function renderAll(list) {
      messagesArea.textContent = '';
      messagesArea.classList.add('is-restoring');
      list.forEach(function (message) { messagesArea.appendChild(buildRow(message)); });

      const last = list[list.length - 1];
      if (last && last.role === 'bot') renderChips(last.chips);

      scrollToBottomInstant();
      // Re-enable entrance animation for new messages on the next frame.
      window.setTimeout(function () { messagesArea.classList.remove('is-restoring'); }, 50);
    }

    function scrollToBottomInstant() {
      messagesArea.scrollTop = messagesArea.scrollHeight;
    }

    /* ---- Sending messages --------------------------------------------- */

    function runQueue() {
      if (busy) return;
      const task = queue.shift();
      if (!task) return;
      busy = true;
      task(function done() { busy = false; runQueue(); });
    }

    function respond(compute) {
      const myEpoch = epoch;

      queue.push(function (done) {
        if (myEpoch !== epoch) { done(); return; }

        const typing = showTyping();
        let result;

        try {
          result = compute();
        } catch (error) {
          console.error('[AshBot]', error);
          result = {
            text: CONFIG.errorMessage,
            chips: [],
            actions: [{ page: 'contact' }],
            intents: [],
            confidence: 'none'
          };
        }

        const delay =
          CONFIG.minThinkingMs +
          Math.min(result.text.length * CONFIG.msPerCharacter, CONFIG.maxExtraThinkingMs);

        window.setTimeout(function () {
          if (myEpoch !== epoch) { done(); return; }

          const message = { role: 'bot', text: result.text, chips: result.chips, actions: result.actions };
          pushMessage(message, { replace: typing });

          // Only the newest answer gets suggestions.
          if (queue.length === 0) renderChips(result.chips);

          writeStorage();
          scrollToBottom();
          done();
        }, delay);
      });

      runQueue();
    }

    function sendText(text) {
      const clean = String(text).trim().slice(0, CONFIG.maxInputLength);
      if (!clean) return;

      clearChips();
      pushMessage({ role: 'user', text: clean });
      writeStorage();
      scrollToBottom();
      historyIndex = -1;

      respond(function () { return reply(clean); });
    }

    function sendIntent(id, label) {
      clearChips();
      pushMessage({ role: 'user', text: label });
      writeStorage();
      scrollToBottom();

      respond(function () { return respondToIntent(id); });
    }

    function handleUserMessage() {
      const text = inputField.value.trim();
      if (!text) return;

      inputField.value = '';
      updateInputState();
      inputField.focus();
      sendText(text);
    }

    function updateInputState() {
      const length = inputField.value.length;
      if (sendBtn) sendBtn.disabled = !inputField.value.trim();

      if (counter) {
        const near = length >= CONFIG.maxInputLength * 0.8;
        counter.textContent = near ? length + '/' + CONFIG.maxInputLength : '';
        counter.classList.toggle('is-limit', length >= CONFIG.maxInputLength);
      }
    }

    /* ---- Open, close, reset ------------------------------------------- */

    function openChat(options) {
      const opts = options || {};
      chatWindow.classList.remove('chatbot-hidden');
      container.classList.add('chatbot-is-open');
      isOpen = true;

      if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.setAttribute('aria-label', 'Close Chat');
      }
      if (opts.focus !== false) inputField.focus();

      scrollToBottomInstant();
      writeStorage();
      if (opts.silent !== true) emit('open');
    }

    function closeChat(returnFocus) {
      chatWindow.classList.add('chatbot-hidden');
      container.classList.remove('chatbot-is-open');
      isOpen = false;

      if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.setAttribute('aria-label', 'Open Chat');
        if (returnFocus) toggleBtn.focus();
      }
      writeStorage();
      emit('close');
    }

    function welcomeMessage() {
      return { role: 'bot', text: CONFIG.welcomeMessage, chips: quickStartChips(), actions: [] };
    }

    function resetChat() {
      epoch += 1;
      queue.length = 0;
      busy = false;
      session = freshSession();
      messages = [welcomeMessage()];
      renderAll(messages);
      writeStorage();
      emit('reset');
      inputField.focus();
    }

    /* ---- Wire up events ------------------------------------------------ */

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        if (chatWindow.classList.contains('chatbot-hidden')) openChat();
        else closeChat(false);
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', function () { closeChat(true); });
    if (resetBtn) resetBtn.addEventListener('click', resetChat);

    chatWindow.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeChat(true);
    });

    messagesArea.addEventListener('click', function (event) {
      const chip = event.target.closest ? event.target.closest('.chatbot-chip') : null;
      if (!chip) return;
      const id = chip.getAttribute('data-intent');
      if (BY_ID[id]) sendIntent(id, chip.textContent);
    });

    if (sendBtn) sendBtn.addEventListener('click', handleUserMessage);

    inputField.addEventListener('input', updateInputState);

    inputField.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        handleUserMessage();
        return;
      }

      // Up / Down arrows recall earlier questions, like a terminal.
      if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && !event.isComposing) {
        const sent = messages
          .filter(function (m) { return m.role === 'user'; })
          .map(function (m) { return m.text; });
        if (!sent.length) return;
        if (inputField.value && historyIndex === -1) return;

        event.preventDefault();
        if (event.key === 'ArrowUp') historyIndex = Math.min(historyIndex + 1, sent.length - 1);
        else historyIndex = Math.max(historyIndex - 1, -1);

        inputField.value = historyIndex === -1 ? '' : sent[sent.length - 1 - historyIndex];
        updateInputState();
      }
    });

    /* ---- First paint --------------------------------------------------- */

    const saved = readStorage();
    let wasOpen = false;

    if (saved) {
      messages = saved.messages.map(sanitizeMessage).filter(Boolean).slice(-CONFIG.maxStoredMessages);
      restoreSession(saved.session);
      wasOpen = !!saved.open && CONFIG.restoreOpenState;
    }
    if (!messages.length) messages = [welcomeMessage()];

    renderAll(messages);
    updateInputState();
    if (wasOpen) openChat({ focus: false, silent: true });

    // Expose UI controls to the public API.
    api.open = function () { openChat(); };
    api.close = function () { closeChat(false); };
    api.reset = resetChat;
    api.isOpen = function () { return isOpen; };
  }

  /* =========================================================================
     6. PUBLIC API
     ========================================================================= */

  const api = {
    version: VERSION,
    // Backwards compatible: returns the answer text only.
    ask: function (query) { return reply(query).text; },
    // Full structured reply: { text, chips, actions, intents, confidence }.
    reply: reply,
    debug: debug,
    registerIntent: registerIntents,
    intents: function () { return COMPILED.map(function (i) { return i.id; }); },
    getSession: function () { return JSON.parse(JSON.stringify(session)); },
    // Replaced with real controls once the widget has been built.
    open: function () {},
    close: function () {},
    reset: function () { session = freshSession(); },
    isOpen: function () { return false; }
  };

  window.AshBot = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();