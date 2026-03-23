import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { doc, setDoc, onSnapshot, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

const GAMES = [
  { id: "wyr",      icon: "💭", label: "Would You Rather",       desc: "Pick between two options — see what your partner chooses", levels: ["Mild", "Spicy", "Extreme"] },
  { id: "tod",      icon: "🎯", label: "Truth or Dare",           desc: "Sweet, bold or daring — you decide",                      levels: ["Sweet", "Bold", "Daring"] },
  { id: "hwyknm",   icon: "💑", label: "How Well Do You Know Me", desc: "Answer questions about each other",                        levels: ["Easy", "Medium", "Hard"] },
  { id: "emoji",    icon: "🧩", label: "Emoji Puzzle",            desc: "Decode the emoji phrase before your partner",             levels: ["Easy", "Medium", "Hard"] },
  { id: "scramble", icon: "🔤", label: "Word Scramble",           desc: "Unscramble the hidden word",                              levels: ["Easy", "Medium", "Hard"] },
  { id: "story",    icon: "📖", label: "Story Builder",           desc: "Take turns adding to a romantic story",                   levels: ["Fun", "Dramatic", "Wild"] },
  { id: "trivia",   icon: "🧠", label: "Couple's Trivia",         desc: "Test your knowledge together",                            levels: ["Easy", "Medium", "Hard"] },
  { id: "finish",   icon: "💌", label: "Finish the Sentence",     desc: "Complete romantic prompts your own way",                  levels: ["Sweet", "Deep", "Funny"] },
];

const LEVEL_COLORS = {
  Mild: "bg-green-50 text-green-600 border-green-200",
  Easy: "bg-green-50 text-green-600 border-green-200",
  Fun: "bg-green-50 text-green-600 border-green-200",
  Sweet: "bg-green-50 text-green-600 border-green-200",
  Spicy: "bg-amber-50 text-amber-600 border-amber-200",
  Medium: "bg-amber-50 text-amber-600 border-amber-200",
  Bold: "bg-amber-50 text-amber-600 border-amber-200",
  Dramatic: "bg-amber-50 text-amber-600 border-amber-200",
  Deep: "bg-amber-50 text-amber-600 border-amber-200",
  Extreme: "bg-red-50 text-red-500 border-red-200",
  Hard: "bg-red-50 text-red-500 border-red-200",
  Daring: "bg-red-50 text-red-500 border-red-200",
  Wild: "bg-red-50 text-red-500 border-red-200",
  Funny: "bg-red-50 text-red-500 border-red-200",
};

// ── Massive Question Bank ─────────────────────────────────────────────────────
const BANK = {
  wyr: {
    Mild: [
      { a: "Live far apart but talk every day", b: "Live close but barely talk" },
      { a: "Cook a meal together", b: "Order from your partner's favourite place" },
      { a: "Watch movies all night", b: "Talk on call until sunrise" },
      { a: "Go on a surprise trip", b: "Plan every detail of a perfect trip" },
      { a: "Receive love letters weekly", b: "Get surprise visits randomly" },
      { a: "Always text first", b: "Always call first" },
      { a: "Morning person together", b: "Night owl together" },
      { a: "Know what your partner is thinking", b: "They always know what you're thinking" },
      { a: "Have a picnic in the park", b: "Have a candlelit dinner at home" },
      { a: "Go stargazing together", b: "Stay in and watch the rain together" },
      { a: "Travel to a new city every month", b: "Have a perfect cozy home base" },
      { a: "Spend weekends on adventures", b: "Spend weekends resting at home" },
      { a: "Write each other handwritten notes", b: "Send voice messages every day" },
      { a: "Have a shared hobby you both love", b: "Keep your individual hobbies separate" },
      { a: "Celebrate every small milestone", b: "Have one big celebration a year" },
      { a: "Learn a new language together", b: "Learn to cook a new cuisine together" },
      { a: "Have matching outfits sometimes", b: "Always have completely different styles" },
      { a: "Go to bed at the same time", b: "Wake up at the same time" },
      { a: "Have a secret handshake", b: "Have a secret nickname for each other" },
      { a: "Dance in the kitchen randomly", b: "Sing in the car together" },
    ],
    Spicy: [
      { a: "Never fight but have boring conversations", b: "Fight often but have deep conversations" },
      { a: "Date someone very attractive but boring", b: "Date someone average but exciting" },
      { a: "Fall in love first", b: "Be loved first" },
      { a: "Your partner is always brutally honest", b: "They always say what you want to hear" },
      { a: "Your partner forgets your birthday", b: "You forget theirs" },
      { a: "Know every person your partner loved before", b: "They know every person you loved" },
      { a: "Your partner earns much more than you", b: "You earn much more than your partner" },
      { a: "Be in a relationship where you love more", b: "Be in one where you're loved more" },
      { a: "Your partner reads your diary", b: "You read their diary" },
      { a: "Have an argument in public", b: "Have an argument in front of family" },
      { a: "Your partner's ex is now your close friend", b: "Your ex is your partner's close friend" },
      { a: "Give up your best friend for love", b: "Give up your dream city for love" },
      { a: "Your partner never says 'I love you' aloud", b: "They say it but never show it in actions" },
      { a: "Always be the one who apologizes first", b: "Never be the one who apologizes first" },
      { a: "Know the exact moment your partner doubted you", b: "Never know and always wonder" },
    ],
    Extreme: [
      { a: "Give up social media forever for love", b: "Give up your dream job for love" },
      { a: "Move to another country for your partner", b: "They move for you" },
      { a: "Perfect love with no passion", b: "Intense passion with imperfect love" },
      { a: "Love someone who will leave in 5 years", b: "Be with someone forever but never truly happy" },
      { a: "Your partner knows your biggest secret", b: "You know their biggest secret" },
      { a: "Give up your career to support their dream", b: "They give up their career for yours" },
      { a: "Know the exact day you'll die and share it with your partner", b: "Never know and neither does your partner" },
      { a: "Have a perfect relationship that nobody believes in", b: "Have an imperfect relationship everyone admires" },
      { a: "Lose all your memories of your partner", b: "Your partner loses all their memories of you" },
      { a: "Be deeply loved but never understood", b: "Be deeply understood but never loved the way you need" },
    ],
  },

  tod: {
    Sweet: [
      { type: "truth", content: "What's your favourite memory of us?" },
      { type: "truth", content: "What was your first impression of me?" },
      { type: "truth", content: "What song reminds you of me?" },
      { type: "truth", content: "What made you fall for me?" },
      { type: "truth", content: "What's the most romantic thing I've ever done?" },
      { type: "truth", content: "What's something you've always wanted to tell me?" },
      { type: "truth", content: "What's your favourite thing we do together?" },
      { type: "truth", content: "What's one thing you love most about our relationship?" },
      { type: "truth", content: "What did you think the first time you saw my photo?" },
      { type: "truth", content: "What's a small thing I do that makes you happy?" },
      { type: "dare", content: "Send me the most recent photo on your camera roll" },
      { type: "dare", content: "Write a 3-line poem about me right now" },
      { type: "dare", content: "Tell me 5 things you love about me" },
      { type: "dare", content: "Sing me the first line of our favourite song" },
      { type: "dare", content: "Send me a voice note saying something sweet" },
      { type: "dare", content: "Draw a quick portrait of me and send it" },
      { type: "dare", content: "Tell me your favourite memory of us in detail" },
      { type: "dare", content: "Send me a good morning / good night message right now even if it's not the right time" },
      { type: "dare", content: "Send me a heart made out of emojis" },
      { type: "dare", content: "Say three things you're grateful for about me" },
    ],
    Bold: [
      { type: "truth", content: "What's your biggest insecurity you've never told me?" },
      { type: "truth", content: "What's one thing I do that secretly annoys you?" },
      { type: "truth", content: "What's the biggest lie you've ever told me?" },
      { type: "truth", content: "What's something you're afraid to ask me?" },
      { type: "truth", content: "Have you ever been jealous of someone in my life?" },
      { type: "truth", content: "What's one habit you wish I would change?" },
      { type: "truth", content: "What's something you want in our relationship that you haven't asked for?" },
      { type: "truth", content: "Have you ever stalked my social media before we were together?" },
      { type: "truth", content: "What's the most embarrassing thing you've done because of me?" },
      { type: "truth", content: "What's one argument we had that still bothers you?" },
      { type: "dare", content: "Send me a screenshot of your most recent search history" },
      { type: "dare", content: "Rate our relationship out of 10 and explain every point" },
      { type: "dare", content: "Tell me one thing you'd change about yourself for us" },
      { type: "dare", content: "Screenshot your most embarrassing photo and send it" },
      { type: "dare", content: "Do your best impression of me on a voice note" },
      { type: "dare", content: "Send me your most unflattering selfie" },
      { type: "dare", content: "Tell me a bad habit you have that I don't know about" },
    ],
    Daring: [
      { type: "truth", content: "What's your biggest fear about us?" },
      { type: "truth", content: "Have you ever thought about breaking up with me? When?" },
      { type: "truth", content: "What would you do if we broke up tomorrow?" },
      { type: "truth", content: "What's one secret you've kept from me until now?" },
      { type: "truth", content: "What's the most vulnerable you've ever felt with me?" },
      { type: "truth", content: "What's something you've done that you're not proud of?" },
      { type: "truth", content: "If you could change one thing about our relationship what would it be?" },
      { type: "truth", content: "What's the wildest thought you've had about our future?" },
      { type: "truth", content: "What's the hardest thing about being in love with me?" },
      { type: "truth", content: "What would you regret most if we ended things?" },
      { type: "dare", content: "Confess something you've been holding back for a while" },
      { type: "dare", content: "Write your honest feelings about me in a paragraph and send it" },
      { type: "dare", content: "Tell me your deepest fear out loud on a voice note" },
      { type: "dare", content: "Call me right now and say what you love about me without stopping for 60 seconds" },
      { type: "dare", content: "Send me the last screenshot you took and explain it" },
    ],
  },

  hwyknm: {
    Easy: [
      { question: "What's my favourite colour?" },
      { question: "What's my favourite food?" },
      { question: "What's my go-to comfort food?" },
      { question: "Am I a morning or night person?" },
      { question: "What's my favourite season?" },
      { question: "What's my favourite type of music?" },
      { question: "What's my favourite animal?" },
      { question: "What's my favourite movie genre?" },
      { question: "What's my dream travel destination?" },
      { question: "What's my favourite day of the week?" },
      { question: "Tea or coffee — which do I prefer?" },
      { question: "What's my favourite sport or physical activity?" },
      { question: "What's my favourite dessert?" },
      { question: "What's my favourite type of weather?" },
      { question: "What's the first thing I do when I wake up?" },
      { question: "What's my favourite app on my phone?" },
      { question: "What's my go-to weekend activity?" },
      { question: "What's my favourite childhood cartoon?" },
      { question: "What kind of music do I listen to when I'm sad?" },
      { question: "What's my favourite fast food order?" },
    ],
    Medium: [
      { question: "What's my biggest fear?" },
      { question: "What's my dream job?" },
      { question: "What's something I'm really proud of?" },
      { question: "What's the one thing that always cheers me up?" },
      { question: "What's my love language?" },
      { question: "What's a goal I haven't told many people about?" },
      { question: "What's the last thing that made me cry?" },
      { question: "What's something I want to learn someday?" },
      { question: "What's my most used phrase or word?" },
      { question: "What's something that always stresses me out?" },
      { question: "What's one thing I do when nobody is watching?" },
      { question: "What's my relationship with my family like?" },
      { question: "What kind of friend am I?" },
      { question: "What's the one thing I can't sleep without?" },
      { question: "What's my biggest pet peeve?" },
      { question: "What type of person am I at a party?" },
      { question: "What's a movie or book that changed my perspective?" },
      { question: "What makes me feel most loved?" },
      { question: "What's something I'm surprisingly good at?" },
      { question: "What's one thing I deeply believe in?" },
    ],
    Hard: [
      { question: "What's my deepest insecurity?" },
      { question: "What's something I'm secretly passionate about?" },
      { question: "What does home mean to me?" },
      { question: "What's something I want people to remember me by?" },
      { question: "What's a belief I've changed my mind about?" },
      { question: "What's the hardest thing I've ever gone through?" },
      { question: "What's one regret I carry with me?" },
      { question: "What's my biggest dream that scares me?" },
      { question: "What kind of old person do I want to be?" },
      { question: "What's something I've never forgiven myself for?" },
      { question: "What's one thing I need but find hard to ask for?" },
      { question: "What does success mean to me personally?" },
      { question: "What's the version of myself I'm working toward?" },
      { question: "What's a part of my childhood that shaped who I am?" },
      { question: "What do I think my biggest flaw is?" },
    ],
  },

  emoji: {
    Easy: [
      { emoji: "🌹❤️", answer: "Rose Love", hint: "A flower and a feeling" },
      { emoji: "🎬🍿", answer: "Movie Night", hint: "Stay-in date" },
      { emoji: "☕❤️", answer: "Coffee Date", hint: "Warm drinks together" },
      { emoji: "💌📮", answer: "Love Letter", hint: "Old-school romance" },
      { emoji: "🌙⭐", answer: "Starry Night", hint: "Van Gogh painting" },
      { emoji: "🎵❤️", answer: "Love Song", hint: "Musical romance" },
      { emoji: "🌅🏖️", answer: "Sunrise Beach", hint: "Morning at the sea" },
      { emoji: "🍕❤️", answer: "Pizza Love", hint: "Everyone's favourite food date" },
      { emoji: "🤝❤️", answer: "Holding Hands", hint: "A sweet gesture" },
      { emoji: "🏠❤️", answer: "Home is You", hint: "Where the heart is" },
      { emoji: "🌻😊", answer: "Sunflower Smile", hint: "Bright and happy" },
      { emoji: "🎂🕯️", answer: "Birthday Wish", hint: "Make a wish" },
      { emoji: "🌈☀️", answer: "After the Rain", hint: "Hope and colour" },
      { emoji: "💃🕺", answer: "Dancing Together", hint: "Move with me" },
      { emoji: "🛌💤❤️", answer: "Dreaming of You", hint: "Thoughts at night" },
    ],
    Medium: [
      { emoji: "👫🌍✈️", answer: "Travel Together", hint: "Adventure for two" },
      { emoji: "🌧️🤝☂️", answer: "Sharing Umbrella", hint: "Romantic in the rain" },
      { emoji: "📱💬😴", answer: "Late Night Texts", hint: "Can't stop talking" },
      { emoji: "🎂🕯️🎊", answer: "Birthday Surprise", hint: "Special celebration" },
      { emoji: "📸🌸😊", answer: "Photo Together", hint: "Capturing memories" },
      { emoji: "🎸🎤❤️", answer: "Love Concert", hint: "Music and feelings" },
      { emoji: "🌮🍷🕯️", answer: "Romantic Dinner", hint: "A special night out" },
      { emoji: "🤫❤️🔐", answer: "Our Little Secret", hint: "Just between us" },
      { emoji: "🏔️👫🌅", answer: "Mountain Sunrise", hint: "High up together" },
      { emoji: "📖☕🛋️", answer: "Cozy Reading Day", hint: "Quiet day together" },
      { emoji: "🎪🎡❤️", answer: "Carnival Date", hint: "Rides and fun" },
      { emoji: "🌙🍜❤️", answer: "Late Night Noodles", hint: "Midnight snack date" },
    ],
    Hard: [
      { emoji: "⏳💔→❤️🔥", answer: "Long Distance Love", hint: "Time and patience" },
      { emoji: "🔑💛🔓❤️", answer: "Key to My Heart", hint: "You unlocked something" },
      { emoji: "🌱💧☀️→🌳", answer: "Growing Together", hint: "Relationship metaphor" },
      { emoji: "🧩❤️🧩", answer: "Perfect Match", hint: "Two pieces fit" },
      { emoji: "🌊🏄‍♂️❤️🏄‍♀️", answer: "Ride the Wave Together", hint: "Life metaphor" },
      { emoji: "🎭😂→😭→❤️", answer: "Emotional Rollercoaster", hint: "The full journey of love" },
      { emoji: "🪞👫😍", answer: "Mirror Soulmates", hint: "You reflect each other" },
      { emoji: "🌑→🌕❤️", answer: "You Are My Moon", hint: "Going through phases together" },
      { emoji: "🧵🪡❤️🧵", answer: "Woven Together", hint: "Threads of life intertwined" },
      { emoji: "⚓❤️🌊", answer: "You Are My Anchor", hint: "Keeping me grounded" },
    ],
  },

  scramble: {
    Easy: [
      { scrambled: "ELOV", answer: "LOVE", hint: "The deepest feeling" },
      { scrambled: "KSSI", answer: "KISS", hint: "Lip contact" },
      { scrambled: "ADET", answer: "DATE", hint: "Romantic outing" },
      { scrambled: "RCAE", answer: "CARE", hint: "You show this every day" },
      { scrambled: "UHSG", answer: "HUGS", hint: "A warm embrace" },
      { scrambled: "TRHE", answer: "HERO", hint: "My person" },
      { scrambled: "WEETS", answer: "SWEET", hint: "Like you" },
      { scrambled: "AIMLS", answer: "SMILE", hint: "What you give me" },
      { scrambled: "RUTHS", answer: "TRUST", hint: "The foundation" },
      { scrambled: "RFEIN", answer: "FRIEND", hint: "Also a lover" },
    ],
    Medium: [
      { scrambled: "EOMTION", answer: "EMOTION", hint: "What you feel inside" },
      { scrambled: "OMANRCE", answer: "ROMANCE", hint: "What couples share" },
      { scrambled: "MPOSIRE", answer: "PROMISE", hint: "A vow to keep" },
      { scrambled: "YDSTNEI", answer: "DESTINY", hint: "It was meant to be" },
      { scrambled: "PAOINSS", answer: "PASSION", hint: "Burning feelings" },
      { scrambled: "EIPANCT", answer: "PATIENCE", hint: "Waiting for you" },
      { scrambled: "DRMEYAS", answer: "DAYDREAM", hint: "Thinking of you" },
      { scrambled: "ROPFECT", answer: "PERFECT", hint: "That's what you are" },
      { scrambled: "YOTLALY", answer: "LOYALTY", hint: "Staying through it all" },
      { scrambled: "DMIRACE", answer: "MIRACLE", hint: "Finding you was this" },
    ],
    Hard: [
      { scrambled: "IOVOTNDE", answer: "DEVOTION", hint: "Complete loyalty" },
      { scrambled: "BKAEHETRR", answer: "HEARTBREAK", hint: "The painful kind of love" },
      { scrambled: "NPPEHISAS", answer: "HAPPINESS", hint: "What love brings" },
      { scrambled: "TIRNEDET", answer: "INTERTWINED", hint: "Wrapped around each other" },
      { scrambled: "ROFGIVNSE", answer: "FORGIVING", hint: "Letting go for love" },
      { scrambled: "IUQNELPA", answer: "UNEQUAL", hint: "Sometimes love feels this way" },
      { scrambled: "LEBTESSDB", answer: "BLESSINGS", hint: "What you are to me" },
      { scrambled: "RNEADNTDSU", answer: "UNDERSTAND", hint: "To truly know someone" },
      { scrambled: "SSHAEDOW", answer: "SHADOWS", hint: "We face these together" },
      { scrambled: "CNOEINNCT", answer: "CONNECTION", hint: "What we have" },
    ],
  },

  story: {
    Fun: [
      { starter: "It was our first trip together and nothing was going according to plan — but somehow that made it perfect." },
      { starter: "We were stuck in an elevator for two hours, and by the time it started moving, everything had changed." },
      { starter: "The recipe said 30 minutes. Three hours later the kitchen was a disaster and we were laughing so hard we couldn't breathe." },
      { starter: "We both reached for the last umbrella at the store at the exact same second." },
      { starter: "I accidentally sent the most embarrassing text of my life to the wrong person — and that's how we started talking." },
      { starter: "We bet each other that neither of us could go a full week without texting first. Neither of us lasted a day." },
      { starter: "I was trying to cook a fancy dinner to impress you and the smoke alarm went off three times." },
      { starter: "We got completely lost in a city we'd never been to before, and it turned out to be the best day of the trip." },
    ],
    Dramatic: [
      { starter: "The last text I sent you before the phone died was three words, and I had no idea if you'd ever read it." },
      { starter: "Standing at the airport, I realized I had exactly five minutes to decide if I was going to stay or go." },
      { starter: "We hadn't spoken in 47 days when your name appeared on my screen and everything came rushing back." },
      { starter: "I had written the letter three times. Each time I thought it was too much. The fourth time, I sent it." },
      { starter: "I kept the voicemail for two years. On the night I finally decided to delete it, you called." },
      { starter: "Everyone said it wouldn't work. We didn't argue. We just kept going anyway." },
      { starter: "There are things I never said out loud. But you always seemed to know them anyway." },
      { starter: "The night everything fell apart was also the night I realized you were the only person I wanted to call." },
    ],
    Wild: [
      { starter: "The fortune teller said we were destined to meet, and then she pointed directly at the stranger sitting next to me." },
      { starter: "It started as a bet — fake date for one evening — but nobody told us the rules about what happens when feelings get real." },
      { starter: "We accidentally booked the same tiny cabin in the mountains for the same week, and the owner said there was only one solution." },
      { starter: "We were both cast as love interests in a local play neither of us wanted to be in." },
      { starter: "The GPS sent us both to the same completely wrong location, in the middle of nowhere, at the same time." },
      { starter: "We were seated next to each other on a 14-hour flight and both claimed the middle armrest at the exact same second." },
      { starter: "I found a note in a secondhand book — and realized the handwriting matched yours exactly." },
      { starter: "We started as rivals in a cooking competition. By round three, something had shifted." },
    ],
  },

  trivia: {
    Easy: [
      { question: "What is the most popular wedding anniversary gift for the 1st year?", answer: "Paper", options: ["Paper", "Gold", "Silver", "Diamond"] },
      { question: "In which city is the Eiffel Tower located — known as the most romantic city?", answer: "Paris", options: ["Rome", "Paris", "Venice", "Barcelona"] },
      { question: "What flower is most associated with love and romance?", answer: "Rose", options: ["Lily", "Tulip", "Rose", "Daisy"] },
      { question: "What does XOXO stand for?", answer: "Hugs and Kisses", options: ["Love and Peace", "Hugs and Kisses", "Hello and Goodbye", "Yes and No"] },
      { question: "Which month is Valentine's Day celebrated in?", answer: "February", options: ["January", "February", "March", "April"] },
      { question: "What colour is most associated with love?", answer: "Red", options: ["Pink", "Red", "Purple", "White"] },
      { question: "What is the traditional gift for a 25th wedding anniversary?", answer: "Silver", options: ["Gold", "Silver", "Ruby", "Pearl"] },
      { question: "In which Shakespeare play do Romeo and Juliet appear?", answer: "Romeo and Juliet", options: ["Othello", "Romeo and Juliet", "Hamlet", "Macbeth"] },
    ],
    Medium: [
      { question: "Which neurotransmitter is most associated with feelings of romantic attachment?", answer: "Oxytocin", options: ["Serotonin", "Dopamine", "Oxytocin", "Adrenaline"] },
      { question: "What is the term for the honeymoon phase of a relationship?", answer: "Limerence", options: ["Infatuation", "Limerence", "Passion", "Attraction"] },
      { question: "In the movie 'The Notebook', what are the names of the two leads?", answer: "Noah and Allie", options: ["Jack and Rose", "Noah and Allie", "Ryan and Rachel", "Edward and Bella"] },
      { question: "What is the name of the Disney movie where the couple communicates through a notebook?", answer: "The Notebook is not Disney — what 1998 Disney film has a love story?", answer: "Mulan", options: ["Mulan", "Tarzan", "Pocahontas", "Hercules"] },
      { question: "Which country celebrates Valentine's Day by giving chocolate from women to men?", answer: "Japan", options: ["France", "Japan", "Brazil", "Italy"] },
      { question: "What is the record for the longest marriage in history (approximate years)?", answer: "86 years", options: ["62 years", "74 years", "86 years", "91 years"] },
      { question: "Which sense is most strongly linked to romantic memory?", answer: "Smell", options: ["Touch", "Sight", "Smell", "Sound"] },
      { question: "What is 'sternberg's triangular theory of love' based on?", answer: "Intimacy, Passion, Commitment", options: ["Trust, Loyalty, Honesty", "Intimacy, Passion, Commitment", "Love, Care, Respect", "Friendship, Romance, Devotion"] },
    ],
    Hard: [
      { question: "What psychological phenomenon makes people more attracted to others who are hard to get?", answer: "Playing hard to get effect", options: ["Mere exposure effect", "Playing hard to get effect", "Halo effect", "Contrast effect"] },
      { question: "What term describes falling in love with someone who resembles a parent figure?", answer: "Imago theory", options: ["Attachment theory", "Imago theory", "Projection", "Transference"] },
      { question: "Which study found that staring into someone's eyes for 4 minutes can make you fall in love?", answer: "Arthur Aron's study", options: ["Sternberg's study", "Arthur Aron's study", "Bowlby's study", "Harlow's study"] },
      { question: "What is 'passionate love' eventually replaced by according to researchers?", answer: "Companionate love", options: ["Romantic love", "Companionate love", "Fatuous love", "Consummate love"] },
      { question: "In psychology, what is 'attachment theory' primarily about?", answer: "How early bonds shape adult relationships", options: ["How trauma affects love", "How early bonds shape adult relationships", "How personality affects dating", "How culture influences marriage"] },
      { question: "What brain region is most active during early romantic love?", answer: "Ventral tegmental area", options: ["Prefrontal cortex", "Ventral tegmental area", "Hippocampus", "Amygdala"] },
    ],
  },

  finish: {
    Sweet: [
      { prompt: "The moment I knew I liked you was when you ..." },
      { prompt: "Being with you feels like ..." },
      { prompt: "My favourite thing about us is ..." },
      { prompt: "When I think about our future, I imagine ..." },
      { prompt: "You make the ordinary feel special because ..." },
      { prompt: "The thing that surprised me most about falling for you was ..." },
      { prompt: "If I could describe you in three words they would be ..." },
      { prompt: "I feel most loved by you when ..." },
      { prompt: "The best part of my day is always ..." },
      { prompt: "Loving you has taught me ..." },
      { prompt: "I didn't know I needed you until ..." },
      { prompt: "You feel like home because ..." },
    ],
    Deep: [
      { prompt: "The thing I'm most afraid to lose about us is ..." },
      { prompt: "I've never told you this but ..." },
      { prompt: "What our relationship has taught me about myself is ..." },
      { prompt: "The version of me that loves you is ..." },
      { prompt: "The hardest thing about missing you is ..." },
      { prompt: "What I want us to build together is ..." },
      { prompt: "I know you're the right person for me because ..." },
      { prompt: "If I could protect you from one thing it would be ..." },
      { prompt: "The question I've been afraid to ask you is ..." },
      { prompt: "When I imagine growing old, I always see ..." },
      { prompt: "There's a part of me I only show you — it's ..." },
      { prompt: "Before you, I thought love was ..." },
    ],
    Funny: [
      { prompt: "If our relationship was a movie it would be called ..." },
      { prompt: "The most embarrassing thing I've done to impress you was ..." },
      { prompt: "Our future kids will definitely inherit my habit of ..." },
      { prompt: "If I could change one weird thing about you it would be ..." },
      { prompt: "The weirdest thing I find attractive about you is ..." },
      { prompt: "If our love story had a theme song it would be ..." },
      { prompt: "The funniest misunderstanding we've ever had was ..." },
      { prompt: "If you were a food you'd definitely be ..." },
      { prompt: "My most irrational thought about you is ..." },
      { prompt: "If we were both animals we'd be ..." },
      { prompt: "The most dramatic thing I've done for you is ..." },
      { prompt: "Our relationship could be described as ..." },
    ],
  },
};

// ── Track used questions to avoid repeats ─────────────────────────────────────
const usedIndexes = {};

const generateQuestion = (gameId, level) => {
  const pool = BANK[gameId]?.[level];
  if (!pool || pool.length === 0) throw new Error("No questions for this game/level.");

  const key = `${gameId}_${level}`;
  if (!usedIndexes[key]) usedIndexes[key] = [];

  // If all used, reset
  if (usedIndexes[key].length >= pool.length) usedIndexes[key] = [];

  // Pick random unused index
  let idx;
  do { idx = Math.floor(Math.random() * pool.length); }
  while (usedIndexes[key].includes(idx));

  usedIndexes[key].push(idx);
  return pool[idx];
};

// ── Game Components ───────────────────────────────────────────────────────────
const Spinner = ({ label }) => (
  <div className="text-center py-10">
    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className="text-4xl inline-block mb-3">⚙️</motion.div>
    <p className="text-sm text-softdark/40">{label || "Loading..."}</p>
  </div>
);

const ResultBox = ({ partnerAnswer, partnerName, children }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    className="bg-rose/10 rounded-2xl p-4 border border-rose/20 space-y-1.5">
    {children}
    {!partnerAnswer && <p className="text-xs text-softdark/40 italic">Waiting for {partnerName}...</p>}
  </motion.div>
);

const WYRGame = ({ question, myAnswer, partnerAnswer, onAnswer, partnerName, loading }) => (
  <div className="space-y-4">
    {loading ? <Spinner label="Loading question..." /> : question ? (
      <>
        <p className="text-xs uppercase tracking-widest text-plum/40 text-center">Would you rather...</p>
        {["a", "b"].map(opt => (
          <motion.button key={opt} whileTap={{ scale: 0.98 }} onClick={() => !myAnswer && onAnswer(opt)}
            className={`w-full p-4 rounded-2xl border-2 text-sm font-medium text-left transition-all ${
              myAnswer === opt ? "bg-plum text-white border-plum shadow-plum"
              : myAnswer ? "bg-white/40 text-softdark/40 border-rose/10 cursor-default"
              : "bg-white/70 text-softdark border-rose/20 hover:border-plum/30"}`}>
            <span className="opacity-40 font-bold mr-2 text-xs">{opt.toUpperCase()}</span>{question[opt]}
          </motion.button>
        ))}
        {myAnswer && (
          <ResultBox partnerAnswer={partnerAnswer} partnerName={partnerName}>
            <p className="text-xs text-softdark/50">You: <span className="font-medium text-plum">{question[myAnswer]}</span></p>
            {partnerAnswer && <p className="text-xs text-softdark/50">{partnerName}: <span className="font-medium text-plum">{question[partnerAnswer]}</span></p>}
            {partnerAnswer && <p className="text-sm font-medium text-center text-plum pt-1">{myAnswer === partnerAnswer ? "🎉 You both agree!" : "💭 You see it differently!"}</p>}
          </ResultBox>
        )}
      </>
    ) : null}
  </div>
);

const TODGame = ({ question, myAnswer, onAnswer, partnerAnswer, partnerName, loading }) => (
  <div className="space-y-4">
    {loading ? <Spinner /> : question ? (
      <>
        <div className={`rounded-2xl p-5 border-2 text-center ${question.type === "truth" ? "bg-blue-50 border-blue-200" : "bg-orange-50 border-orange-200"}`}>
          <p className={`text-xs uppercase tracking-widest font-bold mb-3 ${question.type === "truth" ? "text-blue-500" : "text-orange-500"}`}>
            {question.type === "truth" ? "❓ Truth" : "🎯 Dare"}
          </p>
          <p className="font-serif text-lg text-softdark">{question.content}</p>
        </div>
        {!myAnswer ? (
          <div className="flex gap-3">
            <button onClick={() => onAnswer("done")} className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-plum to-plum-light text-white text-sm font-medium shadow-plum">✓ Done!</button>
            <button onClick={() => onAnswer("skip")} className="px-5 py-3 rounded-2xl bg-rose/10 text-plum/60 text-sm border border-rose/20">Skip</button>
          </div>
        ) : (
          <ResultBox partnerAnswer={partnerAnswer} partnerName={partnerName}>
            <p className="text-xs text-softdark/50">You: <span className="font-medium text-plum">{myAnswer === "done" ? "✓ Done!" : "Skipped"}</span></p>
            {partnerAnswer && <p className="text-xs text-softdark/50">{partnerName}: <span className="font-medium text-plum">{partnerAnswer === "done" ? "✓ Done!" : "Skipped"}</span></p>}
          </ResultBox>
        )}
      </>
    ) : null}
  </div>
);

const TextInputGame = ({ label, placeholder, inputId, myAnswer, onSubmit, partnerAnswer, partnerName, loading }) => (
  <div className="space-y-4">
    {loading ? <Spinner /> : label ? (
      <>
        <div className="bg-rose/10 rounded-2xl p-5 border border-rose/20 text-center">
          <p className="font-serif text-lg text-softdark">{label}</p>
        </div>
        {!myAnswer ? (
          <div className="space-y-3">
            <input id={inputId} placeholder={placeholder}
              className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark"
              onKeyDown={e => e.key === "Enter" && onSubmit(document.getElementById(inputId)?.value)} />
            <button onClick={() => onSubmit(document.getElementById(inputId)?.value)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-plum to-plum-light text-white text-sm font-medium shadow-plum">Submit ♥</button>
          </div>
        ) : (
          <ResultBox partnerAnswer={partnerAnswer} partnerName={partnerName}>
            <p className="text-xs text-softdark/50">You: <span className="font-medium text-plum">"{myAnswer}"</span></p>
            {partnerAnswer && <p className="text-xs text-softdark/50">{partnerName}: <span className="font-medium text-plum">"{partnerAnswer}"</span></p>}
          </ResultBox>
        )}
      </>
    ) : null}
  </div>
);

const EmojiGame = ({ question, myAnswer, onSubmit, partnerAnswer, partnerName, loading }) => (
  <div className="space-y-4">
    {loading ? <Spinner label="Loading puzzle..." /> : question ? (
      <>
        <div className="bg-rose/10 rounded-2xl p-6 border border-rose/20 text-center space-y-2">
          <p className="text-5xl tracking-widest">{question.emoji}</p>
          <p className="text-xs text-softdark/40 italic">Hint: {question.hint}</p>
        </div>
        {!myAnswer ? (
          <div className="space-y-3">
            <input id="emoji-input" placeholder="What does this mean?"
              className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark"
              onKeyDown={e => e.key === "Enter" && onSubmit(document.getElementById("emoji-input")?.value)} />
            <button onClick={() => onSubmit(document.getElementById("emoji-input")?.value)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-plum to-plum-light text-white text-sm font-medium shadow-plum">Submit</button>
          </div>
        ) : (
          <div className="space-y-3">
            <ResultBox partnerAnswer={partnerAnswer} partnerName={partnerName}>
              <p className="text-xs text-softdark/50">You: <span className="font-medium text-plum">{myAnswer}</span></p>
              {partnerAnswer && <p className="text-xs text-softdark/50">{partnerName}: <span className="font-medium text-plum">{partnerAnswer}</span></p>}
            </ResultBox>
            {partnerAnswer && <div className="bg-green-50 rounded-2xl p-3 border border-green-200 text-center"><p className="text-xs text-green-600 font-medium">✓ Answer: {question.answer}</p></div>}
          </div>
        )}
      </>
    ) : null}
  </div>
);

const ScrambleGame = ({ question, myAnswer, onSubmit, partnerAnswer, partnerName, loading }) => (
  <div className="space-y-4">
    {loading ? <Spinner label="Loading scramble..." /> : question ? (
      <>
        <div className="bg-rose/10 rounded-2xl p-6 border border-rose/20 text-center space-y-3">
          <p className="text-xs text-softdark/40 uppercase tracking-widest">Unscramble this word</p>
          <div className="flex justify-center gap-2 flex-wrap">
            {question.scrambled.split("").map((l, i) => (
              <span key={i} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border-2 border-plum/20 font-mono font-bold text-plum text-lg shadow-soft">{l}</span>
            ))}
          </div>
          <p className="text-xs text-softdark/40 italic">Hint: {question.hint}</p>
        </div>
        {!myAnswer ? (
          <div className="space-y-3">
            <input id="scramble-input" placeholder="Type the word..."
              className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark uppercase tracking-widest text-center font-mono"
              onKeyDown={e => e.key === "Enter" && onSubmit(document.getElementById("scramble-input")?.value)} />
            <button onClick={() => onSubmit(document.getElementById("scramble-input")?.value)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-plum to-plum-light text-white text-sm font-medium shadow-plum">Submit</button>
          </div>
        ) : (
          <div className="space-y-3">
            <ResultBox partnerAnswer={partnerAnswer} partnerName={partnerName}>
              <p className="text-xs text-softdark/50">You: <span className="font-mono font-bold text-plum">{myAnswer.toUpperCase()}</span></p>
              {partnerAnswer && <p className="text-xs text-softdark/50">{partnerName}: <span className="font-mono font-bold text-plum">{partnerAnswer.toUpperCase()}</span></p>}
            </ResultBox>
            {partnerAnswer && (
              <div className={`rounded-2xl p-3 border text-center ${myAnswer.toUpperCase() === question.answer ? "bg-green-50 border-green-200" : "bg-red-50 border-red-100"}`}>
                <p className={`text-xs font-medium ${myAnswer.toUpperCase() === question.answer ? "text-green-600" : "text-red-500"}`}>
                  {myAnswer.toUpperCase() === question.answer ? "✓ Correct!" : `✗ Answer: ${question.answer}`}
                </p>
              </div>
            )}
          </div>
        )}
      </>
    ) : null}
  </div>
);

const StoryGame = ({ question, myAnswer, onSubmit, allParts, partnerName, loading }) => {
  const [input, setInput] = useState("");
  return (
    <div className="space-y-4">
      {loading ? <Spinner label="Starting story..." /> : question ? (
        <>
          <div className="bg-rose/10 rounded-2xl p-5 border border-rose/20">
            <p className="text-xs uppercase tracking-widest text-plum/40 mb-3">Your story so far...</p>
            <p className="font-serif text-softdark leading-relaxed">
              {question.starter}{(allParts || []).map((p, i) => <span key={i}> {p.text}</span>)}
            </p>
          </div>
          {!myAnswer ? (
            <div className="space-y-3">
              <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Add the next sentence..." rows={2}
                className="w-full bg-white border border-rose/30 rounded-2xl px-4 py-3 text-sm text-softdark resize-none" />
              <button onClick={() => { onSubmit(input); setInput(""); }} disabled={!input.trim()}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-plum to-plum-light text-white text-sm font-medium shadow-plum disabled:opacity-40">
                Add to Story ✍️
              </button>
            </div>
          ) : (
            <div className="bg-rose/10 rounded-2xl p-4 border border-rose/20 text-center">
              <p className="text-xs text-softdark/50">Added! Waiting for {partnerName} to continue...</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

const TriviaGame = ({ question, myAnswer, onAnswer, partnerAnswer, partnerName, loading }) => (
  <div className="space-y-4">
    {loading ? <Spinner label="Loading trivia..." /> : question ? (
      <>
        <div className="bg-rose/10 rounded-2xl p-5 border border-rose/20 text-center">
          <p className="font-serif text-lg text-softdark">{question.question}</p>
        </div>
        <div className="space-y-2">
          {(question.options || []).map((opt, i) => (
            <motion.button key={i} whileTap={{ scale: 0.98 }} onClick={() => !myAnswer && onAnswer(opt)}
              className={`w-full p-3 rounded-2xl border text-sm text-left transition-all ${
                myAnswer === opt ? opt === question.answer ? "bg-green-100 border-green-300 text-green-700" : "bg-red-50 border-red-200 text-red-500"
                : myAnswer && opt === question.answer ? "bg-green-100 border-green-300 text-green-700"
                : myAnswer ? "bg-white/40 text-softdark/40 border-rose/10 cursor-default"
                : "bg-white/70 text-softdark border-rose/20 hover:border-plum/30"}`}>
              <span className="font-bold mr-2 text-xs opacity-40">{["A","B","C","D"][i]}</span>{opt}
            </motion.button>
          ))}
        </div>
        {myAnswer && (
          <ResultBox partnerAnswer={partnerAnswer} partnerName={partnerName}>
            {partnerAnswer && <p className="text-xs text-softdark/50">{partnerName}: <span className="font-medium text-plum">{partnerAnswer}</span></p>}
            {partnerAnswer && <p className="text-xs text-green-600 font-medium">✓ Answer: {question.answer}</p>}
          </ResultBox>
        )}
      </>
    ) : null}
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Games() {
  const { user, userData, coupleData } = useAuth();
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [myAnswer, setMyAnswer] = useState(null);
  const [partnerAnswer, setPartnerAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [storyParts, setStoryParts] = useState([]);
  const [partner, setPartner] = useState(null);

  const coupleId = coupleData?.id;
  const gameRef = coupleId ? doc(db, "couples", coupleId, "gameState", "current") : null;
  const isFirst = user.uid === coupleData?.members?.[0];
  const myKey = isFirst ? "answer1" : "answer2";
  const partnerKey = isFirst ? "answer2" : "answer1";

  useEffect(() => {
    if (!coupleData?.members || coupleData.members.length < 2) return;
    const partnerUid = coupleData.members.find(id => id !== user.uid);
    if (!partnerUid) return;
    getDoc(doc(db, "users", partnerUid)).then(snap => { if (snap.exists()) setPartner(snap.data()); });
  }, [coupleData, user]);

  useEffect(() => {
    if (!gameRef) return;
    const unsub = onSnapshot(gameRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setGameState(data);
      setMyAnswer(data[myKey] ?? null);
      setPartnerAnswer(data[partnerKey] ?? null);
      if (data.storyParts) setStoryParts(data.storyParts);
    });
    return () => unsub();
  }, [coupleId, myKey, partnerKey]);

  const startGame = async (game, level) => {
    setSelectedGame(game);
    setSelectedLevel(level);
    setMyAnswer(null);
    setPartnerAnswer(null);
    setError("");
    setLoading(true);
    try {
      const question = generateQuestion(game.id, level);
      await setDoc(gameRef, { gameId: game.id, level, question, answer1: null, answer2: null, storyParts: [], updatedAt: serverTimestamp() });
    } catch (err) { setError(err.message); setSelectedGame(null); }
    finally { setLoading(false); }
  };

  const submitAnswer = async (answer) => {
    if (!answer?.trim() || !gameRef) return;
    await setDoc(gameRef, { [myKey]: answer.trim() }, { merge: true });
  };

  const nextQuestion = async () => {
    if (!selectedGame || !selectedLevel) return;
    setMyAnswer(null);
    setPartnerAnswer(null);
    setError("");
    setLoading(true);
    try {
      const question = generateQuestion(selectedGame.id, selectedLevel);
      await setDoc(gameRef, { gameId: selectedGame.id, level: selectedLevel, question, answer1: null, answer2: null, storyParts: gameState?.storyParts || [], updatedAt: serverTimestamp() });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const addStoryPart = async (text) => {
    if (!text?.trim() || !gameRef) return;
    const newParts = [...(gameState?.storyParts || []), { text, by: userData.displayName }];
    await setDoc(gameRef, { [myKey]: text, storyParts: newParts }, { merge: true });
    setTimeout(async () => { await setDoc(gameRef, { answer1: null, answer2: null }, { merge: true }); }, 3000);
  };

  const renderGame = () => {
    if (!gameState || gameState.gameId !== selectedGame?.id) return null;
    const q = gameState.question;
    const pName = partner?.displayName || "Partner";
    switch (selectedGame.id) {
      case "wyr":      return <WYRGame question={q} myAnswer={myAnswer} partnerAnswer={partnerAnswer} onAnswer={submitAnswer} partnerName={pName} loading={loading} />;
      case "tod":      return <TODGame question={q} myAnswer={myAnswer} onAnswer={submitAnswer} partnerAnswer={partnerAnswer} partnerName={pName} loading={loading} />;
      case "hwyknm":   return <TextInputGame label={q?.question} placeholder="Your answer..." inputId="hwyknm-input" myAnswer={myAnswer} onSubmit={submitAnswer} partnerAnswer={partnerAnswer} partnerName={pName} loading={loading} />;
      case "emoji":    return <EmojiGame question={q} myAnswer={myAnswer} onSubmit={submitAnswer} partnerAnswer={partnerAnswer} partnerName={pName} loading={loading} />;
      case "scramble": return <ScrambleGame question={q} myAnswer={myAnswer} onSubmit={submitAnswer} partnerAnswer={partnerAnswer} partnerName={pName} loading={loading} />;
      case "story":    return <StoryGame question={q} myAnswer={myAnswer} onSubmit={addStoryPart} allParts={storyParts} partnerName={pName} loading={loading} />;
      case "trivia":   return <TriviaGame question={q} myAnswer={myAnswer} onAnswer={submitAnswer} partnerAnswer={partnerAnswer} partnerName={pName} loading={loading} />;
      case "finish":   return <TextInputGame label={q?.prompt} placeholder="Complete the sentence..." inputId="finish-input" myAnswer={myAnswer} onSubmit={submitAnswer} partnerAnswer={partnerAnswer} partnerName={pName} loading={loading} />;
      default:         return null;
    }
  };

  return (
    <div className="page-enter min-h-screen bg-petal">
      <div className="bg-white/60 backdrop-blur-md border-b border-rose/20 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-plum/50 hover:text-plum bg-white/50 rounded-2xl px-3 py-2 border border-rose/20 transition-colors text-sm">← Back</Link>
            <div>
              <h1 className="font-serif text-2xl text-softdark">Games 🎮</h1>
              <p className="text-xs text-softdark/40">Play together ♥</p>
            </div>
          </div>
          {selectedGame && (
            <button onClick={() => { setSelectedGame(null); setSelectedLevel(null); setMyAnswer(null); setPartnerAnswer(null); setError(""); }}
              className="text-xs text-plum/50 hover:text-plum bg-white/50 rounded-2xl px-3 py-2 border border-rose/20 transition-colors">
              ← Games
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
            <p className="text-sm text-red-500">{error}</p>
            <button onClick={() => setError("")} className="text-xs text-red-400 mt-1 underline">Dismiss</button>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {!selectedGame && (
            <motion.div key="selection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {GAMES.map(game => (
                <motion.div key={game.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white/70 backdrop-blur-sm rounded-3xl border border-white/80 shadow-soft p-5">
                  <div className="flex items-start gap-4 mb-4">
                    <span className="text-3xl">{game.icon}</span>
                    <div className="flex-1">
                      <p className="font-serif text-lg text-softdark">{game.label}</p>
                      <p className="text-xs text-softdark/40 mt-0.5">{game.desc}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {game.levels.map(level => (
                      <button key={level} onClick={() => startGame(game, level)}
                        className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all hover:-translate-y-0.5 ${LEVEL_COLORS[level]}`}>
                        {level}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {selectedGame && (
            <motion.div key="game" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="bg-white/70 backdrop-blur-sm rounded-3xl border border-white/80 shadow-soft p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{selectedGame.icon}</span>
                  <div>
                    <p className="font-medium text-softdark text-sm">{selectedGame.label}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${LEVEL_COLORS[selectedLevel]}`}>{selectedLevel}</span>
                  </div>
                </div>
                <button onClick={nextQuestion} disabled={loading}
                  className="text-xs bg-rose/10 text-plum border border-rose/20 rounded-2xl px-3 py-2 hover:bg-rose/20 transition-colors disabled:opacity-40">
                  Next ↻
                </button>
              </div>

              <div className="bg-white/70 backdrop-blur-sm rounded-3xl border border-white/80 shadow-soft p-5">
                {renderGame()}
              </div>

              {myAnswer && partnerAnswer && selectedGame.id !== "story" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <button onClick={nextQuestion} disabled={loading}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-plum to-plum-light text-white text-sm font-medium shadow-plum hover:-translate-y-0.5 transition-all disabled:opacity-40">
                    {loading ? "Loading..." : "Next Question ↻"}
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}