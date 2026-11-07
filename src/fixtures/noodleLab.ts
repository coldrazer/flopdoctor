// SAMPLE DATA — a fictional cooking creator for demos with no network.
import type { Diagnosis } from "../../supabase/functions/_shared/types.ts";
import { buildPosts, roastOf, type FixtureScan, type RawRow } from "./types.ts";

const rows: RawRow[] = [
  ["Chili oil, three ways", 0.2, 41, 1, "Chili oil is the best thing in my fridge, and here are three ways I use it.", 4.1],
  ["Freezer dumplings, crispy", -0.4, 45, 1, "Freezer dumplings, but crispy, with a lace skirt on the bottom.", 6.9],
  ["Why does my wok smoke? Real answer", 1.6, 35, 0, "Why does your wok smoke like that? It's not the oil.", 5.6],
  ["Weekend project: hand-pulled noodles", -1.1, 96, 5, "This weekend I'm pulling noodles by hand, so let's get into it.", 2.9],
  ["Rice cooker hacks", 0.1, 39, 1, "Your rice cooker can do way more than rice.", 4.0],
  ["Knife skills: scallions", -0.3, 36, 1, "Here's how I cut scallions for every dish.", 3.8],
  ["Why your fried rice is mushy (it's the rice)", 2.1, 28, 0, "Why is your fried rice always mushy? It's the rice, not you.", 6.2],
  ["Lunar New Year menu planning", -0.9, 98, 3, "Okay so let's plan the whole menu together.", 2.7],
  ["Leftover rice, 3 ways", 0.4, 47, 1, "Three things to do with leftover rice tonight.", 4.3],
  ["Slow-mo garlic + chili crisp ASMR", -1.4, 58, 8, "", 2.4],
  ["Wok hei at home? Kind of.", 0.0, 44, 1, "You can get wok hei at home. Sort of.", 4.0],
  ["Ever wonder why takeout lo mein is shiny?", 1.2, 33, 0, "Ever wonder why takeout lo mein is so shiny?", 5.4],
  ["Dumpling folds ranked", -0.2, 49, 1, "Ranking every dumpling fold I know, worst to best.", 3.9],
  ["Today I'm making scallion pancakes", -1.0, 81, 4, "Today I'm making scallion pancakes.", 2.8],
  ["Cheap cleaver vs expensive", 0.3, 52, 1, "I bought a cheap cleaver and an expensive one.", 4.2],
  ["Stop buying stir-fry sauce. Do this.", 1.8, 24, 0, "Why are you still buying stir-fry sauce?", 6.0],
  ["Bok choy, 2 minutes", -0.6, 31, 1, "Bok choy in two minutes, start to finish.", 7.2],
  ["Today I'm making dan dan noodles", -1.3, 75, 4, "Today I'm making dan dan noodles.", 2.6],
  ["Tofu that isn't sad", 0.5, 38, 1, "Tofu that isn't sad, finally.", 4.4],
  ["Garlic peeling trick", -0.1, 29, 1, "Peel a whole head of garlic in ten seconds.", 4.1],
  ["The 4-minute egg drop soup", 1.4, 29, 0, "Can you make soup in four minutes? Watch.", 5.8],
  ["Sunday meal prep: 5 noodle bowls", -1.6, 102, 6, "So this Sunday I'm prepping five bowls for the week.", 2.9],
  ["Sesame noodles for one", 0.2, 41, 1, "Sesame noodles for one, no leftovers.", 4.2],
  ["Pantry tour 2026", -1.2, 124, 5, "Okay so welcome to my pantry.", 2.5],
  ["Is restaurant garlic noodles a scam?", 1.9, 31, 0, "Is restaurant garlic noodles a scam? Let's find out.", 6.4],
  ["Black vinegar, explained", 0.6, 40, 1, "Black vinegar is underrated. Here's why.", 4.6],
  ["My knife collection", -0.9, 88, 3, "Okay so a lot of you asked about my knives.", 2.8],
  ["Crispy chili eggs", 1.1, 34, 0, "Have you ever fried an egg in chili oil?", 5.2],
  ["Cold noodle salad", -0.5, 43, 1, "Cold noodle salad for hot days.", 3.9],
  ["Steamed fish, weeknight version", 0.3, 46, 1, "Steamed fish on a Tuesday. Easy.", 4.2],
];

const trending = buildPosts("tr_nl", "ricelab.demo", "tiktok", 120000, "2026-10-28T00:00:00Z", 1, [
  ["The real reason restaurant rice tastes better", 0.9, 32, 0, "Why does restaurant rice taste better than yours?", 5.1],
  ["Day-old rice myth, tested", 0.2, 38, 0, "Does fried rice really need day-old rice?", 4.4],
  ["One sauce, five dinners", 0.0, 29, 0, "Stop buying five sauces.", 4.8],
]).map((p, i) => ({ ...p, handle: ["ricelab.demo", "weeknightwok.demo", "saucebook.demo"][i] }));

const diagnosis: Diagnosis = {
  verdict: "Your face in the first second is worth 3× views. You keep hiding it behind B-roll.",
  patterns: [
    {
      title: "Face first, food second",
      winnersDo: "Open on your face talking to camera within the first second (7 of 7).",
      flopsDo: "Open on B-roll — sizzling pans, slow-mo garlic — under a text overlay.",
      confidence: "high",
      evidence: [
        { postId: "nl_07", observation: "Face + question at 0:00" },
        { postId: "nl_16", observation: "Points at camera, 0:00" },
        { postId: "nl_10", observation: "8 s of garlic before you appear" },
      ],
    },
    {
      title: "Ask a question, don't announce",
      winnersDo: "Hook is a question or a myth to bust: “Why…”, “Is… a scam?”",
      flopsDo: "Hook announces the plan: “Today I'm making…”, “Okay so…”",
      confidence: "high",
      evidence: [
        { postId: "nl_25", observation: "“Is restaurant garlic noodles a scam?”" },
        { postId: "nl_18", observation: "“Today I'm making dan dan…”" },
        { postId: "nl_24", observation: "“Okay so welcome to my pantry”" },
      ],
    },
    {
      title: "Stay under 40 seconds",
      winnersDo: "Average length 31 s. Every winner runs under 40 s.",
      flopsDo: "Average length 1:30. Seven of eight run past a minute.",
      confidence: "high",
      evidence: [
        { postId: "nl_16", observation: "0:24, no wasted beat" },
        { postId: "nl_24", observation: "2:04 pantry tour" },
      ],
    },
    {
      title: "Weeknight fixes beat weekend projects",
      winnersDo: "Solve a problem people have tonight: mushy rice, a smoking wok.",
      flopsDo: "Ambitious projects: hand-pulled noodles, five-bowl meal prep.",
      confidence: "medium",
      evidence: [
        { postId: "nl_07", observation: "Mushy rice fix" },
        { postId: "nl_04", observation: "Hand-pulled noodles" },
      ],
    },
  ],
};

export const noodleLab: FixtureScan = {
  handle: "noodle.lab",
  platform: "tiktok",
  nowISO: "2026-11-05T12:00:00Z",
  creator: {
    id: "prf_sample_noodlelab",
    platform: "tiktok",
    handle: "noodle.lab",
    displayName: "Noodle Lab",
    followers: 48200,
    postsCount: 212,
    profileUrl: "https://www.tiktok.com/@noodle.lab",
  },
  posts: buildPosts("nl", "noodle.lab", "tiktok", 12400, "2026-09-02T00:00:00Z", 2, rows),
  niche: { label: "weeknight cooking", keywords: ["fried rice", "stir fry", "noodles", "wok"] },
  trending,
  diagnosis,
  roastDiagnosis: roastOf(diagnosis, "Your face triples your views and you keep covering it with slow-mo garlic.", [
    "Your garlic is not the star. You are.",
    "“Today I'm making…” is a sleep aid",
    "Nobody asked for the director's cut",
    "Nobody hand-pulls noodles on a Tuesday",
  ]),
  prescriptions: [
    {
      title: "The takeout question",
      format: "Talking head · ~28 s",
      hook: "Why does takeout fried rice beat yours? It's not the wok.",
      beats: [
        { t: "0:00", text: "Face to camera. Ask the question." },
        { t: "0:03", text: "The answer: day-old rice, and why it fries instead of steams." },
        { t: "0:10", text: "Side by side in the pan: fresh rice vs day-old." },
        { t: "0:22", text: "“Save this for Thursday.”" },
      ],
      why: "Stacks your two strongest patterns: your face in the first second and a question hook. Rice myth-busting is running hot in weeknight cooking this week.",
      patternRef: "Face first, food second",
      proofPostIds: ["tr_nl_01", "tr_nl_02"],
    },
    {
      title: "One jar, three dinners",
      format: "List · ~30 s",
      hook: "Stop buying three sauces. This one jar does all of them.",
      beats: [
        { t: "0:00", text: "Hold up the jar, face in frame." },
        { t: "0:04", text: "Sauce 1: stir-fry. One splash." },
        { t: "0:12", text: "Sauce 2: noodles. Add sesame." },
        { t: "0:20", text: "Sauce 3: dumpling dip. Add vinegar." },
        { t: "0:27", text: "Recipe in the comments." },
      ],
      why: "A sequel to “Stop buying stir-fry sauce”, one of your biggest winners. Sequels inherit the original's audience. Kept under 40 seconds on purpose.",
      patternRef: "Stay under 40 seconds",
      proofPostIds: ["nl_16", "tr_nl_03"],
    },
    {
      title: "Dan dan noodles, re-hooked",
      format: "Remake · ~30 s",
      hook: "Is dan dan the easiest noodle you've never made? Twelve minutes.",
      beats: [
        { t: "0:00", text: "Face first. Ask the question." },
        { t: "0:04", text: "Cut the original 1:15 down to its best 25 seconds." },
        { t: "0:28", text: "End on the finished bowl, hold 2 s." },
      ],
      why: "The original flopped with an announcement hook and a B-roll open. Same dish, fixed hook, a third of the length: a clean test of the diagnosis.",
      patternRef: "Ask a question, don't announce",
      proofPostIds: ["nl_18"],
    },
  ],
};

