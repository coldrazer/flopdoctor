// SAMPLE DATA — a fictional fitness creator for demos with no network.
import type { Diagnosis } from "../../supabase/functions/_shared/types.ts";
import { buildPosts, roastOf, type FixtureScan, type RawRow } from "./types.ts";

const rows: RawRow[] = [
  ["Push day, full session", -1.2, 140, 6, "Okay so today is push day, let's warm up.", 2.1],
  ["You're doing lat pulldowns wrong", 1.7, 27, 0, "Why are your lat pulldowns all arms? Watch my elbows.", 6.1],
  ["Gym bag essentials", -0.3, 44, 1, "Here's what's in my gym bag this month.", 3.5],
  ["Why your squat stalls at 225", 2.0, 31, 0, "Why does your squat stall at two twenty-five?", 6.6],
  ["Morning routine 5am", -1.0, 95, 4, "So my alarm goes off at five.", 2.4],
  ["Fix your deadlift lockout", 1.3, 24, 0, "Is your deadlift lockout this ugly?", 5.5],
  ["Leg day vlog", -1.4, 160, 7, "Today is leg day, let's go.", 1.9],
  ["Protein oats, 3 ways", 0.2, 38, 1, "Three protein oat bowls I actually like.", 3.8],
  ["Stop ego lifting on bench", 1.5, 22, 0, "Why are you still ego lifting on bench?", 5.9],
  ["Supplement haul", -0.9, 102, 3, "Okay so I got a bunch of supplements.", 2.6],
  ["Cable fly form check", 0.1, 35, 1, "Cable fly form check, three cues.", 3.6],
  ["Rest day stretches", -0.2, 41, 1, "Rest day stretches I do every single week.", 6.8],
  ["Is cardio killing your gains?", 1.1, 29, 0, "Is cardio killing your gains?", 5.3],
  ["Full week of meals", -1.1, 118, 5, "This week I'm eating three thousand calories a day.", 2.3],
  ["Hip thrust setup", 0.3, 33, 1, "Hip thrust setup in thirty seconds.", 3.9],
  ["Grip strength test", -0.5, 37, 1, "Testing my grip strength against a dynamometer.", 3.4],
  ["Why your shoulders hurt on bench", 1.8, 26, 0, "Why do your shoulders hurt when you bench?", 6.3],
  ["Gym tour", -1.3, 87, 4, "Welcome to my new gym.", 2.2],
  ["Pull-up progression", 0.4, 39, 1, "Pull-up progression from zero reps.", 4.0],
  ["Creatine myths", 0.0, 42, 1, "Creatine doesn't do what you think.", 3.8],
  ["Deload week explained", -0.4, 40, 1, "Deload weeks, explained simply.", 3.7],
  ["Back day, full session", -1.0, 132, 6, "Okay back day.", 2.2],
  ["Dumbbell-only arm day", 0.2, 36, 1, "Dumbbell only arm day, no excuses.", 3.9],
  ["Can you build muscle at home?", 1.2, 30, 0, "Can you actually build muscle at home?", 5.6],
];

const trending = buildPosts("tr_lf", "formcheck.demo", "tiktok", 90000, "2026-10-29T00:00:00Z", 1, [
  ["The one squat cue nobody tells you", 0.7, 25, 0, "Why does nobody tell you this squat cue?", 6.0],
  ["Bench pain? Check your elbows", 0.3, 28, 0, "Do your shoulders hurt on bench?", 5.2],
  ["30-second form fixes", 0.0, 30, 0, "Three form fixes in thirty seconds.", 4.9],
]).map((p, i) => ({ ...p, handle: ["formcheck.demo", "benchdoc.demo", "cuecard.demo"][i] }));

const diagnosis: Diagnosis = {
  verdict: "Your 30-second fixes pull 3× your median. Your full-session vlogs pull less than half.",
  patterns: [
    {
      title: "Lead with the mistake",
      winnersDo: "Name a mistake the viewer is making in the very first line.",
      flopsDo: "Open on you walking into the gym or warming up.",
      confidence: "high",
      evidence: [
        { postId: "lf_02", observation: "Names the mistake in line one" },
        { postId: "lf_17", observation: "Pain point in the first 2 s" },
        { postId: "lf_07", observation: "Walks in, warms up, 7 s of nothing" },
      ],
    },
    {
      title: "Stay under 30 seconds",
      winnersDo: "Average length 27 s — one cue, one fix, done.",
      flopsDo: "Average length 2:02. Full sessions with no single takeaway.",
      confidence: "high",
      evidence: [
        { postId: "lf_09", observation: "0:22, one cue" },
        { postId: "lf_01", observation: "2:20 push day" },
      ],
    },
    {
      title: "Face to camera, not voiceover",
      winnersDo: "You talk straight to camera from 0:00.",
      flopsDo: "Voiceover over gym footage; your face shows up late or never.",
      confidence: "high",
      evidence: [
        { postId: "lf_04", observation: "Face + question at 0:00" },
        { postId: "lf_14", observation: "Voiceover over meal shots" },
      ],
    },
    {
      title: "Fixes beat routines",
      winnersDo: "Solve one specific problem: a stalled squat, sore shoulders.",
      flopsDo: "Show your routine: 5 a.m. alarm, meals, hauls.",
      confidence: "medium",
      evidence: [
        { postId: "lf_06", observation: "Deadlift lockout fix" },
        { postId: "lf_05", observation: "5 a.m. routine" },
      ],
    },
  ],
};

export const liftfolio: FixtureScan = {
  handle: "liftfolio",
  platform: "tiktok",
  nowISO: "2026-11-05T12:00:00Z",
  creator: {
    id: "prf_sample_liftfolio",
    platform: "tiktok",
    handle: "liftfolio",
    displayName: "Liftfolio",
    followers: 31500,
    postsCount: 164,
    profileUrl: "https://www.tiktok.com/@liftfolio",
  },
  posts: buildPosts("lf", "liftfolio", "tiktok", 8200, "2026-09-06T00:00:00Z", 2, rows),
  niche: { label: "strength training", keywords: ["squat", "bench", "form", "gym"] },
  trending,
  diagnosis,
  roastDiagnosis: roastOf(diagnosis, "Nobody wants to watch you rack weights for two minutes and twenty seconds.", [
    "Nobody needs to see you walk in",
    "Your vlogs are longer than your rest periods",
    "The camera wants your face, not your shoes",
    "Nobody is copying your 5 a.m. alarm",
  ]),
  prescriptions: [
    {
      title: "The 225 wall",
      format: "Talking head · ~25 s",
      hook: "Why does everyone's squat stall at 225? It's your breathing.",
      beats: [
        { t: "0:00", text: "Face to camera, bar in the background. Ask it." },
        { t: "0:03", text: "The cue: brace before you unrack, not at the bottom." },
        { t: "0:10", text: "Side by side: no brace vs brace, same weight." },
        { t: "0:20", text: "“Try it Monday. Tell me what happens.”" },
      ],
      why: "A sequel to your biggest winner with the same question shape. Single-cue squat fixes are trending in strength training this week.",
      patternRef: "Lead with the mistake",
      proofPostIds: ["lf_04", "tr_lf_01"],
    },
    {
      title: "Shoulder pain, part two",
      format: "Form fix · ~26 s",
      hook: "Still hurting on bench? Look at where your elbows go.",
      beats: [
        { t: "0:00", text: "Face first, hand on shoulder." },
        { t: "0:04", text: "Show the flared-elbow rep." },
        { t: "0:12", text: "Show the tucked rep. Same weight." },
        { t: "0:21", text: "One line cue on screen. Done." },
      ],
      why: "Follows up “Why your shoulders hurt on bench”, your second-best video. Under 30 seconds, one fix.",
      patternRef: "Stay under 30 seconds",
      proofPostIds: ["lf_17", "tr_lf_02"],
    },
    {
      title: "Leg day, re-cut",
      format: "Remake · ~28 s",
      hook: "Are you wasting your first ten minutes of leg day?",
      beats: [
        { t: "0:00", text: "Face to camera, ask the question." },
        { t: "0:03", text: "Cut the 2:40 vlog down to the one warm-up mistake." },
        { t: "0:24", text: "End on the fix, hold 2 s." },
      ],
      why: "Your leg day vlog was your worst video. Same footage, a mistake-first hook and a tenth of the length.",
      patternRef: "Lead with the mistake",
      proofPostIds: ["lf_07"],
    },
  ],
};
