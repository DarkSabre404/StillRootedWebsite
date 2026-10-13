(function () {
  'use strict';

  if (window.__stillRootedChatbotLoaded) return;
  window.__stillRootedChatbotLoaded = true;

  // CONFIG
  const CONFIG = {
    minThinkingMs: 450,
    msPerCharacter: 3,
    maxExtraThinkingMs: 500,
    maxInputLength: 300,
    thinkingText: 'Thinking...',
    inputPlaceholder: 'Ask about our project...',
    welcomeMessage:
      "Hello! 🌱 I'm the virtual assistant for Still Rooted. Ask me about our workshops, " +
      'storytelling circles, who can join, or how to get involved!',
    errorMessage:
      'Something went wrong while preparing that answer. Please try again, or reach out ' +
      'to our team through the Contact page.'
  };

  // PROFILE
  const PROFILE = {
    founders: 'Mudita Agrawal and Yutika Solanki',
    sessionFrequency: 'biweekly',
    venues: 'partner community centers, libraries, and schools',
    replyTime: '24-48 hours'
  };

  const TOPIC_MENU =
    'Here are some things you can ask me about:\n' +
    '• Our mission and co-founders\n' +
    '• Digital Literacy Workshops\n' +
    '• Oral History Storytelling Circles\n' +
    '• Who can join (seniors 60+ and youth volunteers)\n' +
    '• How to sign up or volunteer\n' +
    "• Cost (spoiler: it's free!)\n" +
    '• Events, locations, and languages\n' +
    '• Privacy and scam safety\n' +
    '• Contact and partnerships';

  const FALLBACK_REPLIES = [
    "Hmm, I don't have an answer for that yet. I can tell you about our workshops, storytelling circles, " +
      'who can join, or how to get involved. You can also ask our team directly through the Contact page.',
    "That's a good question, but I don't have the details just yet. Try asking about our programs, " +
      'founders, cost, or how to volunteer, or message the team through the Contact page and they will be happy to help.'
  ];

  // INTENTS
  const INTENTS = [
    {
      id: 'greeting',
      smallTalk: true,
      priority: 2,
      keywords: [
        'hi', 'hii*', 'hello*', 'hey*', 'hiya', 'howdy', 'greetings', 'sup', 'yo', 'namaste',
        'good morning', 'good afternoon', 'good evening', 'what is up', 'nice to meet you'
      ],
      answer: [
        'Hello there! Welcome to Still Rooted. What would you like to know about our intergenerational project today?',
        "Hi! 🌱 I'm the Still Rooted assistant. Ask me about our workshops, storytelling circles, or how to get involved!",
        "Hey there! It's great to have you here. How can I help you learn more about Still Rooted?"
      ]
    },
    {
      id: 'how_are_you',
      smallTalk: true,
      priority: 2,
      keywords: [
        'how are you', 'how do you do', 'how is it going', 'how are things',
        'how have you been', 'how is your day'
      ],
      answer: [
        "I'm doing great, thanks for asking! I'm here and ready to answer any questions you have about Still Rooted.",
        'Wonderful, thank you! 🌱 How can I help you today?'
      ]
    },
    {
      id: 'thanks',
      smallTalk: true,
      priority: 2,
      keywords: [
        'thank*', 'thx', 'ty', 'appreciate*', 'grateful', 'cheers', 'much obliged',
        'that helps', 'that was helpful', 'very helpful'
      ],
      answer: [
        "You're very welcome! Let me know if there's anything else I can help you with.",
        'Happy to help! Feel free to ask me anything else about Still Rooted. 🌱',
        "Anytime! If you think of more questions, I'm right here."
      ]
    },
    {
      id: 'goodbye',
      smallTalk: true,
      priority: 2,
      keywords: [
        'bye*', 'goodbye', 'good bye', 'see you', 'see ya', 'take care',
        'talk later', 'farewell', 'have a good day', 'have a nice day',
        'that is all', 'nothing else', 'no thanks', 'cya', 'gotta go'
      ],
      answer: [
        'Goodbye! Thanks for stopping by. We hope to see you at a Still Rooted session soon. 🌱',
        'Take care! Come back anytime if you have more questions.'
      ]
    },
    {
      id: 'acknowledge',
      smallTalk: true,
      priority: 1,
      keywords: [
        'ok', 'okay', 'cool', 'great', 'nice', 'awesome', 'got it', 'alright',
        'sounds good', 'i see', 'wonderful', 'amazing', 'perfect', 'good',
        'fine', 'interesting'
      ],
      answer: [
        "Glad to hear it! Is there anything else you'd like to know about Still Rooted?",
        "Great! Just ask if you'd like to know more about our workshops, storytelling circles, or how to get involved."
      ]
    },
    {
      id: 'joke',
      smallTalk: true,
      priority: 2,
      keywords: [
        'joke*', 'funny', 'laugh*', 'make me laugh', 'humor',
        'humour', 'pun', 'puns'
      ],
      answer: [
        'Why did the smartphone need glasses? It lost all its contacts! ...Okay, maybe I should stick to answering questions about our NGO.',
        'Why did the tree join a video call? To stay in touch with its roots! 🌳',
        'Why was the computer cold? It left its Windows open!'
      ]
    },
    {
      id: 'bot_identity',
      smallTalk: true,
      priority: 4,
      keywords: [
        'your name', 'what is your name', 'who are you', 'what are you',
        'are you a robot', 'are you a bot', 'are you an ai', 'are you ai',
        'are you human', 'are you real', 'are you a real person',
        'are you a person', 'is this a bot', 'is this a robot', 'is this ai',
        'talking to a bot', 'talking to a human', 'chatbot', 'who made you',
        'who built you', 'who created you', 'who programmed you'
      ],
      answer:
        "I'm the Still Rooted Assistant, a chatbot built into this website (not a person!). Still Rooted is an " +
        'intergenerational community school project that connects seniors and youth, and I can tell you about our ' +
        'programs and how to get involved. If you would like to talk to a human, our team is a message away on the Contact page.'
    },
    {
      id: 'help',
      smallTalk: true,
      priority: 1,
      keywords: [
        'help', 'what can you do', 'what can you help with', 'what can i ask',
        'what do you know', 'what should i ask', 'topics', 'menu', 'options',
        'faq*', 'assist*', 'more info', 'more information', 'tell me more',
        'what else', 'anything else', 'i have a question', 'i have questions',
        'quick question', 'can i ask', 'may i ask'
      ],
      answer:
        TOPIC_MENU + '\n\nTry asking: "Who founded Still Rooted?" or "How do I volunteer?"'
    },

    {
      id: 'about',
      priority: 3,
      keywords: [
        'what is still rooted', 'what is this', 'what is this site',
        'what is this website', 'what is this project', 'what is this about',
        'what do you do', 'what does still rooted do',
        'what does your organization do', 'what does your ngo do',
        'about us', 'about still rooted', 'about the project',
        'about your organization', 'about your ngo', 'tell me about still rooted',
        'tell me about your organization', 'tell me about your ngo',
        'ngo', 'nonprofit', 'non profit', 'charity', 'organization',
        'organisation', 'initiative', 'project', 'intergenerational',
        'generation gap', 'generational gap', 'across generations',
        'bridge*', 'concept', 'overview', 'explain', 'stand for',
        'stands for', 'how does it work', 'how does this work',
        'how does still rooted work'
      ],
      answer:
        'Still Rooted is an intergenerational community school project dedicated to bridging the generation gap between ' +
        'senior citizens and youth. Through Digital Literacy Workshops and Oral History Storytelling Circles, we help build ' +
        'meaningful relationships, digital confidence, and a lasting record of local history.'
    },

    {
      id: 'mission',
      priority: 5,
      keywords: [
        'mission', 'goal*', 'purpose', 'vision', 'aim*', 'objective*',
        'values', 'value', 'why do you exist', 'why does still rooted exist',
        'why was still rooted created', 'why did you start',
        'why did you create', 'why do you do this',
        'what are you trying to do', 'what do you hope', 'impact',
        'achieve*', 'believe*', 'philosophy', 'motivation',
        'inspired', 'inspiration'
      ],
      answer:
        'Our mission is to foster meaningful relationships, build digital confidence, and preserve local history through ' +
        'shared human connection and community engagement. Seniors share their lived experiences and wisdom, youth ' +
        'volunteers share their time and tech know-how, and both generations come away more connected.'
    },

    {
      id: 'founders',
      priority: 8,
      keywords: [
        'founder*', 'cofounder*', 'co founder*', 'founded', 'founding',
        'who founded', 'who started', 'who created', 'who made', 'who runs',
        'who leads', 'who manages', 'who is behind', 'who is in charge',
        'who owns', 'behind still rooted', 'started by', 'created by',
        'founded by', 'run by', 'led by', 'mudita', 'yutika', 'agrawal',
        'solanki', 'leader*', 'team', 'ceo', 'director', 'president',
        'organizer*', 'organiser*', 'creator*', 'how did it start',
        'how did you start', 'how did still rooted start',
        'how did this start', 'how did it begin', 'origin*',
        'history of still rooted', 'why was still rooted started'
      ],
      answer:
        `Still Rooted was co-founded by ${PROFILE.founders}. They lead this intergenerational community school project, ` +
        'working alongside student volunteers and community members to bridge the generation gap.'
    },

    {
      id: 'programs',
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
        "2. Oral History Storytelling Circles: structured conversations that capture seniors' life stories, lessons, and legacies in written archives."
    },

    {
      id: 'digital',
      priority: 5,
      keywords: [
        'digital*', 'literacy', 'tech*', 'workshop*', 'class', 'classes',
        'lesson*', 'learn*', 'teach*', 'taught', 'training', 'course*',
        'session*', 'computer*', 'laptop*', 'phone*', 'smartphone*',
        'iphone*', 'android', 'mobile*', 'tablet*', 'ipad*', 'internet',
        'online', 'wifi', 'wi fi', 'app', 'apps', 'device*', 'gadget*',
        'hands on', 'tech support', 'tech help', 'one on one'
      ],
      answer:
        'Our Digital Literacy Workshops are hands-on, beginner-friendly sessions where friendly youth volunteers guide seniors ' +
        'step by step. We help with navigating smartphones, making video calls to stay close to distant family, using social ' +
        'media safely, and spotting online scams. All workshops are 100% free!'
    },

    {
      id: 'video_calls',
      priority: 6,
      keywords: [
        'video call*', 'video chat*', 'videocall*', 'facetime', 'skype',
        'zoom', 'google meet', 'whatsapp', 'call my family', 'call family',
        'connect with family', 'distant family', 'family far away',
        'family abroad', 'long distance', 'see my family'
      ],
      answer:
        'Yes! Video calling is a key part of our Digital Literacy Workshops. Our volunteers guide seniors step by step ' +
        'through making video calls, so they can see and talk with distant family members and friends. If you have a ' +
        'particular app in mind, mention it when you contact us and the team can tell you how they can help.'
    },

    {
      id: 'social_media',
      priority: 6,
      keywords: [
        'social media', 'facebook', 'instagram', 'twitter',
        'tiktok', 'snapchat', 'social network*'
      ],
      answer:
        'Yes, using social media safely is part of our Digital Literacy Workshops. We help seniors stay connected with ' +
        'friends and family online, and we teach how to recognize online scams along the way.'
    },

    {
      id: 'oral_history',
      priority: 6,
      keywords: [
        'oral history', 'oral histories', 'oral', 'story', 'stories',
        'storytell*', 'story telling', 'story circle*', 'life story',
        'life stories', 'history', 'histories', 'heritage', 'legacy',
        'legacies', 'memory', 'memories', 'memoir*', 'archive*',
        'interview*', 'record*', 'podcast*', 'preserv*', 'local history',
        'lived experience*', 'share my story', 'share my stories',
        'share stories', 'wisdom', 'circle*', 'reminisc*',
        'personal history', 'personal histories'
      ],
      answer:
        'Our Oral History Storytelling Circles capture and preserve the life stories, lessons, and personal legacies of our ' +
        'senior participants. Through structured, friendly conversational interviews and written archives, we keep local ' +
        'history and hard-won wisdom alive for future generations. Sharing your story is always your choice.'
    },

    {
      id: 'resources',
      priority: 6,
      keywords: [
        'guide', 'guides', 'resource*', 'handout*', 'material*',
        'tutorial*', 'worksheet*', 'pdf', 'download*', 'cheat sheet*',
        'manual*', 'digital resource*', 'take home'
      ],
      answer:
        'Yes! Still Rooted provides digital resource guides, and like everything we offer they are 100% free. The Workshops ' +
        'page on our website is a good place to start, or you can ask the team through the Contact page.'
    },

    {
      id: 'eligibility',
      priority: 6,
      keywords: [
        'who can join', 'who can attend', 'who can participate',
        'who can come', 'who is it for', 'who is this for',
        'who are the participants', 'who participates', 'who attends',
        'who is eligible', 'target audience', 'audience', 'who do you serve',
        'who do you help', 'age limit', 'age requirement*', 'age group*',
        'how old', 'minimum age', 'maximum age', 'age', 'ages',
        'restriction*', 'eligib*', 'requirement*', 'qualif*',
        'anyone can join', 'open to everyone', 'open to all',
        'everyone welcome', 'seniors and youth', 'seniors and students',
        'youth and seniors', 'students and seniors', 'seniors only',
        'only for seniors', 'only seniors', 'youth only', 'students only',
        'only for students', 'only for youth', 'only students', 'only youth'
      ],
      answer:
        'Still Rooted welcomes two groups:\n' +
        '• Seniors (ages 60+) who want to feel less isolated, gain confidence with everyday technology, and share their life stories.\n' +
        '• Youth: high school and college students who want to give back, mentor seniors, practice active listening, and learn from older generations.\n' +
        'All of our programs are 100% free.'
    },

    {
      id: 'seniors',
      priority: 6,
      keywords: [
        'senior*', 'elder*', 'older adult*', 'older people',
        'older person', 'older generation*', 'old people', 'grandparent*',
        'grandma*', 'grandmother*', 'grandpa*', 'grandfather*',
        'retiree*', 'retired', 'pensioner*', 'citizen*', 'my mom',
        'my mum', 'my dad', 'my mother', 'my father', 'my parents',
        'my parent', '60', 'sixty', 'isolat*', 'lonely', 'loneliness', 'alone'
      ],
      answer:
        'Our senior participants are older adults aged 60 and above. Many join us to feel less isolated, build confidence ' +
        'with everyday technology, and share their lived experiences and personal histories. If you or a loved one would ' +
        "like to take part, send us a message through the Contact page. It's completely free!"
    },

    {
      id: 'youth',
      priority: 6,
      keywords: [
        'youth*', 'student*', 'teen*', 'high school*', 'highschool*',
        'college*', 'university', 'universities', 'young people',
        'young person', 'young adult*', 'younger generation*', 'kids',
        'mentor*', 'active listening', 'listening skills', 'school kids'
      ],
      answer:
        'Our youth participants are high school and college students who want to give back to their community. As ' +
        'volunteers and mentors, they help seniors with everyday technology, practice active listening, and learn from the ' +
        'wisdom of older generations. Want to be part of it? Send us a message through the Contact page!'
    },

    {
      id: 'join',
      priority: 7,
      keywords: [
        'join*', 'sign up', 'signup', 'sign me up', 'register*',
        'enroll*', 'enrol*', 'apply*', 'application*', 'particip*',
        'attend*', 'take part', 'become a member', 'membership',
        'how do i join', 'how to join', 'how can i join', 'can i join',
        'i want to join', 'want to join', 'get started', 'how to start',
        'how do i start', 'how do i get started', 'reserve', 'rsvp',
        'book a spot', 'book a session'
      ],
      answer:
        'Joining is easy and free! Seniors can sign up to attend our workshops and storytelling circles, and students or ' +
        'community members can sign up to volunteer. Just send us a message through the contact form on our website, and ' +
        'our team will help you get started.'
    },

    {
      id: 'volunteer',
      priority: 7,
      keywords: [
        'volunteer*', 'get involved', 'involved', 'involvement',
        'how can i help', 'how can we help', 'i want to help',
        'want to help', 'help out', 'lend a hand', 'pitch in', 'contribut*',
        'become a mentor', 'be a mentor', 'give my time', 'give back',
        'looking to help', 'make a difference', 'how to volunteer',
        'how do i volunteer', 'how can i volunteer', 'can i volunteer',
        'want to volunteer', 'like to volunteer', 'sign up to volunteer'
      ],
      answer:
        'Volunteers are the heart of Still Rooted! Students and community members can mentor seniors in our Digital ' +
        'Literacy Workshops or take part in our Oral History Storytelling Circles as active listeners. No prior teaching ' +
        'experience is required, just patience and a listening ear. To sign up, send us a message through the contact form ' +
        'on our website.'
    },

    {
      id: 'beginner',
      priority: 6,
      keywords: [
        'beginner*', 'no experience', 'no prior experience', 'prior experience',
        'experience needed', 'experience required', 'need experience',
        'never used', 'never touched', 'first time', 'complete beginner',
        'not tech savvy', 'not good with tech*', 'bad with tech*',
        'afraid of tech*', 'scared of tech*', 'nervous', 'anxious',
        'intimidated', 'intimidating', 'overwhelmed', 'confused',
        'clueless', 'too old', 'too late', 'zero knowledge',
        'from scratch', 'basics', 'basic', 'novice', 'no knowledge',
        'new to tech*'
      ],
      answer:
        'No experience needed! Our workshops are hands-on and beginner-friendly, with patient youth volunteers guiding ' +
        "seniors step by step, and it's never too late to learn. Volunteers don't need teaching experience either, just " +
        'patience and a listening ear.'
    },

    {
      id: 'pricing',
      priority: 8,
      keywords: [
        'free', 'for free', 'free of charge', 'is it free',
        'are the workshops free', 'are workshops free', 'cost*', 'fee',
        'fees', 'price*', 'pricing', 'pay', 'paying', 'payment*', 'paid',
        'charge*', 'money', 'afford*', 'expensive', 'cheap', 'how much',
        'no cost', 'no charge', 'zero cost', 'complimentary', 'tuition',
        'subscription', 'rupee*', 'dollar*', 'budget', 'hidden cost*',
        'hidden fee*'
      ],
      answer:
        "It's 100% free! All of our workshops, community sessions, and digital resource guides are provided at no charge, " +
        'so everyone in the community has equal access. There are no fees or hidden costs.'
    },

    {
      id: 'safety',
      priority: 8,
      keywords: [
        'safe*', 'secur*', 'privacy', 'private', 'confidential*',
        'protect*', 'data', 'personal information', 'personal details',
        'personal data', 'scam*', 'fraud*', 'phishing', 'hack*',
        'password*', 'consent', 'permission', 'trust*', 'trained',
        'background check*', 'vetted', 'vetting', 'is it safe',
        'can i trust', 'cyber*'
      ],
      answer:
        'Safety and privacy come first. In our workshops we teach seniors how to spot online scams and use technology ' +
        'safely, and our volunteers are trained to handle digital information carefully. Oral history stories are only ' +
        "recorded or archived with the participant's explicit consent. For specific questions about our safeguarding " +
        'practices, please reach out through the Contact page.'
    },

    {
      id: 'accessibility',
      priority: 6,
      keywords: [
        'accessib*', 'wheelchair*', 'disabilit*', 'disabled', 'mobility',
        'hearing aid*', 'hearing impaired', 'hard of hearing', 'deaf',
        'low vision', 'vision impaired', 'visually impaired', 'blind',
        'impaired', 'special needs', 'accommodat*', 'assistive', 'ramp',
        'elevator', 'lift', 'transport*', 'pick up', 'pickup', 'bus',
        'equitable', 'inclusive', 'inclusion'
      ],
      answer:
        'Equitable access is at the heart of Still Rooted, which is why all of our workshops, community sessions, and ' +
        'resources are 100% free. If you or someone you know has specific accessibility needs (such as mobility, hearing, ' +
        'vision, or transportation), please tell us through the Contact page so our team can do their best to accommodate you.'
    },

    {
      id: 'events',
      priority: 7,
      keywords: [
        'event*', 'schedule*', 'when', 'timing*', 'time', 'times',
        'calendar', 'date', 'dates', 'upcoming', 'next session',
        'next workshop', 'next event', 'next meeting', 'next circle',
        'when is', 'when are', 'when do', 'how often', 'frequency',
        'biweekly', 'bi weekly', 'weekly', 'monthly', 'every week',
        'every two weeks', 'every other week', 'twice a month',
        'what day', 'which day', 'what time', 'weekend*', 'weekday*',
        'morning', 'afternoon', 'evening', 'today', 'tomorrow',
        'this week', 'next week', 'this month', 'next month',
        'happening', 'meet', 'meetup*', 'meeting*', 'gathering*', 'hours'
      ],
      answer:
        `Our workshops and community circles generally take place ${PROFILE.sessionFrequency}. For exact dates, times, and ` +
        'any upcoming special events, please check the Events page on our website, which always has the most up-to-date schedule.'
    },

    {
      id: 'location',
      priority: 7,
      keywords: [
        'where', 'where are you', 'where do you meet', 'where is it held',
        'where are sessions held', 'where do sessions take place',
        'locat*', 'venue*', 'address*', 'city', 'town', 'country',
        'based in', 'directions', 'map', 'nearby', 'near me', 'nearest',
        'in my area', 'in my city', 'in my town', 'in my neighborhood',
        'in my neighbourhood', 'neighborhood', 'neighbourhood',
        'community center*', 'community centre*', 'library', 'libraries',
        'in person', 'onsite', 'on site', 'headquarter*', 'office',
        'branch*', 'chapter*', 'operate', 'operating', 'travel'
      ],
      answer:
        `We operate locally, hosting sessions at ${PROFILE.venues}. Check the Events page on our website for the exact ` +
        "venue of each upcoming meetup, or ask our team through the Contact page if you'd like help finding the session " +
        'nearest to you.'
    },

    {
      id: 'language',
      priority: 7,
      keywords: [
        'language*', 'bilingual', 'multilingual', 'translat*', 'interpret*',
        'speak', 'speaks', 'spoken', 'english', 'spanish', 'hindi',
        'marathi', 'french', 'german', 'arabic', 'mandarin', 'chinese',
        'tamil', 'gujarati', 'bengali', 'urdu', 'native language',
        'mother tongue', 'non english', 'other languages'
      ],
      answer:
        'We want our workshops to be welcoming to everyone. Many of our youth volunteers are bilingual, which lets us offer ' +
        'digital literacy support and capture stories in more than one language. If you need help in a particular language, ' +
        'let our team know through the Contact page so we can do our best to accommodate you.'
    },

    {
      id: 'contact',
      priority: 8,
      keywords: [
        'contact*', 'email*', 'e mail', 'mail', 'phone number',
        'contact number', 'telephone', 'call you', 'call us', 'ring you',
        'reach*', 'get in touch', 'in touch', 'message*', 'contact form',
        'form', 'inbox', 'write to', 'talk to someone', 'speak to someone',
        'talk to a person', 'speak to a person', 'talk to a human',
        'speak to a human', 'real person', 'real human', 'staff',
        'facebook page', 'instagram page', 'your facebook', 'your instagram',
        'your twitter', 'on facebook', 'on instagram', 'on twitter',
        'on linkedin', 'on youtube', 'youtube channel', 'linkedin',
        'follow us', 'follow you', 'social media page*',
        'social media account*', 'social media handle*', 'social handle*',
        'website', 'respond*', 'response time', 'reply', 'get back to me',
        'inquiry', 'enquiry', 'feedback', 'complaint*', 'suggestion*'
      ],
      answer:
        'You can reach the Still Rooted team through the Contact page on this website by sending us a message through the ' +
        `form. We try to respond within ${PROFILE.replyTime}! Whether you'd like to join a workshop, volunteer, share your ` +
        "story, or partner with us, we'd love to hear from you."
    },

    {
      id: 'partnerships',
      priority: 7,
      keywords: [
        'partner*', 'business*', 'corporate', 'company', 'companies',
        'collaborat*', 'sponsor*', 'work with you', 'work together',
        'team up', 'join forces', 'cooperate', 'donat*', 'fund*', 'grant*',
        'invest*', 'support you', 'support your mission',
        'support the project', 'support still rooted', 'give money', 'csr'
      ],
      answer:
        'We love collaborating with local businesses, schools, and civic organizations! If your organization would like to ' +
        'partner with, sponsor, or otherwise support Still Rooted, please drop us a message via the Contact page and our ' +
        'team will be glad to talk.'
    }
  ];

  // ENGINE
  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function compileKeyword(keyword) {
    if (!/^[a-z0-9 ]+\*?$/.test(keyword)) {
      console.warn(
        '[Still Rooted chatbot] This keyword can never match: "' + keyword + '"'
      );
    }

    const isPrefix = keyword.charAt(keyword.length - 1) === '*';
    const words = (isPrefix ? keyword.slice(0, -1) : keyword).trim().split(/\s+/);
    const pattern =
      '\\b' +
      words.map(escapeRegExp).join('\\s+') +
      (isPrefix ? '' : '\\b');

    return {
      regex: new RegExp(pattern),
      weight: words.length
    };
  }

  INTENTS.forEach(function (intent) {
    intent.matchers = intent.keywords.map(compileKeyword);
    intent.priority = typeof intent.priority === 'number' ? intent.priority : 5;
  });

  function normalize(text) {
    return String(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2018\u2019\u02bc]/g, "'")
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

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function resolveAnswer(intent) {
    return Array.isArray(intent.answer)
      ? pick(intent.answer)
      : intent.answer;
  }

  function rankIntents(query) {
    const ranked = [];

    INTENTS.forEach(function (intent, order) {
      let score = 0;
      let position = Infinity;

      intent.matchers.forEach(function (matcher) {
        const hit = matcher.regex.exec(query);

        if (hit) {
          score += matcher.weight;
          position = Math.min(position, hit.index);
        }
      });

      if (score > 0) {
        ranked.push({
          intent: intent,
          score: score,
          position: position,
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

  let consecutiveMisses = 0;

  function buildFallback() {
    consecutiveMisses += 1;

    if (consecutiveMisses >= 2) {
      consecutiveMisses = 0;

      return (
        "Sorry, I'm still not sure about that one.\n\n" +
        TOPIC_MENU +
        '\n\nFor anything else, our team would love to hear from you through the Contact page.'
      );
    }

    return pick(FALLBACK_REPLIES);
  }

  function generateSmartResponse(rawQuery) {
    const query = normalize(rawQuery).slice(0, CONFIG.maxInputLength);
    const ranked = rankIntents(query);

    if (ranked.length === 0) return buildFallback();

    consecutiveMisses = 0;

    const primary = ranked[0];
    const chosen = [primary];

    if (!primary.intent.smallTalk) {
      const isCompound =
        /\b(and|also|plus)\b/.test(query) ||
        (String(rawQuery).match(/\?/g) || []).length > 1;

      const minScore = isCompound ? 1 : 2;
      const minRatio = isCompound ? 0.5 : 0.6;

      const secondary = ranked.slice(1).find(function (r) {
        return (
          !r.intent.smallTalk &&
          r.score >= minScore &&
          r.score >= primary.score * minRatio
        );
      });

      if (secondary) chosen.push(secondary);
    }

    chosen.sort(function (a, b) {
      return a.position - b.position;
    });

    return chosen
      .map(function (r) {
        return resolveAnswer(r.intent);
      })
      .join('\n\n');
  }

  function debug(rawQuery) {
    return rankIntents(normalize(rawQuery)).map(function (r) {
      return {
        topic: r.intent.id,
        score: r.score,
        priority: r.intent.priority
      };
    });
  }

  window.StillRootedChatbot = {
    ask: generateSmartResponse,
    debug: debug
  };

  // UI
  function init() {
    if (!document.getElementById('ngo-chatbot-container')) {
      const chatbotContainer = document.createElement('div');
      chatbotContainer.id = 'ngo-chatbot-container';

      chatbotContainer.innerHTML = `
        <button type="button" id="chatbot-toggle-btn" aria-label="Open Chat" aria-expanded="false" aria-controls="chatbot-window">💬 Chat with Rooted Bot</button>
        <div id="chatbot-window" class="chatbot-hidden" role="dialog" aria-label="Still Rooted chat assistant">
          <div class="chatbot-header">
            <h3>🌱 Still Rooted Assistant</h3>
            <button type="button" id="chatbot-close-btn" aria-label="Close Chat">&times;</button>
          </div>
          <div class="chatbot-messages" id="chatbot-messages" role="log" aria-live="polite">
            <div class="bot-message"></div>
          </div>
          <div class="chatbot-input-area">
            <input type="text" id="chatbot-input" aria-label="Type your question" maxlength="${CONFIG.maxInputLength}" autocomplete="off" />
            <button type="button" id="chatbot-send-btn">Send</button>
          </div>
        </div>
      `;

      chatbotContainer.querySelector('.bot-message').textContent =
        CONFIG.welcomeMessage;

      chatbotContainer.querySelector('#chatbot-input').placeholder =
        CONFIG.inputPlaceholder;

      document.body.appendChild(chatbotContainer);
    }

    const toggleBtn = document.getElementById('chatbot-toggle-btn');
    const closeBtn = document.getElementById('chatbot-close-btn');
    const chatWindow = document.getElementById('chatbot-window');
    const sendBtn = document.getElementById('chatbot-send-btn');
    const inputField = document.getElementById('chatbot-input');
    const messagesArea = document.getElementById('chatbot-messages');

    function scrollToBottom() {
      if (!messagesArea) return;

      if (typeof messagesArea.scrollTo === 'function') {
        messagesArea.scrollTo({
          top: messagesArea.scrollHeight,
          behavior: 'smooth'
        });
      } else {
        messagesArea.scrollTop = messagesArea.scrollHeight;
      }
    }

    function openChat() {
      chatWindow.classList.remove('chatbot-hidden');

      if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', 'true');
      }

      if (inputField) inputField.focus();

      scrollToBottom();
    }

    function closeChat(returnFocus) {
      chatWindow.classList.add('chatbot-hidden');

      if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', 'false');

        if (returnFocus) toggleBtn.focus();
      }
    }

    if (toggleBtn && chatWindow) {
      toggleBtn.addEventListener('click', function () {
        if (chatWindow.classList.contains('chatbot-hidden')) {
          openChat();
        } else {
          closeChat(false);
        }
      });
    }

    if (closeBtn && chatWindow) {
      closeBtn.addEventListener('click', function () {
        closeChat(true);
      });
    }

    if (chatWindow) {
      chatWindow.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeChat(true);
      });
    }

    function addMessage(text, sender) {
      const bubble = document.createElement('div');

      bubble.className =
        sender === 'user' ? 'user-message' : 'bot-message';

      bubble.textContent = text;

      if (sender !== 'user') {
        bubble.style.whiteSpace = 'pre-line';
      }

      messagesArea.appendChild(bubble);
      scrollToBottom();

      return bubble;
    }

    function handleUserMessage() {
      if (!inputField || !messagesArea) return;

      const text = inputField.value.trim();

      if (!text) return;

      addMessage(text, 'user');

      inputField.value = '';
      inputField.focus();

      const thinkingBubble = addMessage(CONFIG.thinkingText, 'bot');

      let reply;

      try {
        reply = generateSmartResponse(text);
      } catch (error) {
        console.error('[Still Rooted chatbot]', error);
        reply = CONFIG.errorMessage;
      }

      const delay =
        CONFIG.minThinkingMs +
        Math.min(
          reply.length * CONFIG.msPerCharacter,
          CONFIG.maxExtraThinkingMs
        );

      setTimeout(function () {
        thinkingBubble.remove();
        addMessage(reply, 'bot');
      }, delay);
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', handleUserMessage);
    }

    if (inputField) {
      inputField.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.isComposing) {
          event.preventDefault();
          handleUserMessage();
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
