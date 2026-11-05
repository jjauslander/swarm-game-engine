# Guided game workshop

This is the conversation workflow for Claude and other repository-aware coding assistants. The assistant facilitates and operates the tools; the user supplies creative direction. There is no embedded AI chatbot in the browser game.

## Opening

For a new, unspecific session offer only:
1. Play the existing games.
2. Adapt an existing game.
3. Create your own game.

If the user has already expressed an intent, follow it immediately. Do not repeat the menu during ongoing work, a bug report or a specific implementation request. Do not automatically install anything before the user chooses a route.

The user can say "What can I make?" Offer a few grounded examples: a capture-the-base game, a resource race, a territory game, or a cooperative hex-board challenge. Existing games demonstrate the parts available now; new mechanics can be implemented in trusted source. Keep the first prototype small. Do not promise every imaginable mechanic is already a setting.

## 1. Play the existing games

Say: "I’m installing what the games need and starting them. I’ll give you the play link when they’re ready."

Run npm start -- --background from the repository root. It installs dependencies when needed, builds and starts one server for both the game and its API. No separate frontend server, browser-test installation or MCP setup is needed to play. Read the result and logs. Confirm the actual game page and package catalogue respond.

If the environment requires a fixed port, pass --port with the assigned value. For a cloud workspace use --cloud; then obtain the environment's forwarded/preview URL rather than presenting its loopback URL as the user's play link.

Give one clickable, verified link and one sentence: "Choose a game and press Play locally." Default player two is already a bot. Do not ask for a board design, turn budget or other game-making decisions on this route.

If they ask which game:
- Swarm Basic Prototype: collect pollen and use it to produce pieces at Queens.
- Garden Cycle: the same prototype with periodic flooding.
- Outpost Capture: move Scouts, manage fuel and claim the opposing base.

Use npm run play:stop to stop only the launcher-owned server. Never kill every Node process or replace an unrelated service. Starting again reuses the matching server; after source changes it rebuilds and restarts its own server with saved match files preserved.

## 2. Adapt an existing game

If the game is unspecified, offer the three games above in a short sentence each. Start/open the chosen game so the user can see it, and explain its objective and turn in a few sentences.

Ask: "What would you like to change?" Give examples only if useful: the theme, board layout, pieces, movement, resources or winning condition. Do not make the user classify a change as data versus code.

Create a named copy for their game; preserve the shipped examples unless the user explicitly wants to change one. Put lasting work under mods/<name> and, if new rules are needed, games/<name>. The .runtime workspace is for previews, not the only copy of their work.

For a simple request such as "give everyone more fuel", implement it, validate it and reopen the changed game. Do not require a design interview or another approval.

For a broad change, ask the one question that most affects the next playable version. If they want help deciding rules, propose a small coherent set and label the choices as suggestions. Use the conversation as authorization when they ask you to proceed.

Summarize the changed behaviour, build it, run focused checks, start the preview and point to one thing to try. Ask what felt right or wrong after their playtest. Carry their answer into the next iteration.

## 3. Create your own game

Start naturally: "What would you like your game to be about? A rough idea is enough."

Then establish how much design help they want, unless their first answer already tells you:
- "I have rules I want you to follow."
- "I have a general feel; help me invent the rules."
- "Let’s work it out together."

Ask one question at a time, reusing information they already gave. Cover these only as needed:
- **Point of the game:** what are players trying to achieve?
- **Board:** compact or sprawling, islands/corridors, starting areas, theme. Offer a sensible small hex layout if they do not care.
- **A turn:** the main action, what limits it, and how players interact.
- **First test:** the smallest useful experience to make playable now.

If the user supplies a complete rulebook, use it rather than re-asking its answers. If they give you freedom, make reasonable choices and explain them briefly. Do not stall waiting for specifications they asked you to invent.

Before building, state the small prototype you are about to make in ordinary language: objective, one-turn example and first test. This is a progress update, not an automatic extra confirmation gate. Ask only when a genuinely necessary rule is unresolved; continue independent work while waiting.

Use an existing rule module for a close variant, or the source starter for different rules. Handle registration, identity generation, tests, browser catalogue and rebuild internally. Read docs/Module_API.md and docs/Modding_Guide.md for technical implementation. Do not ask the user to edit JSON or install MCP.

Build a real playable slice, not only a design document or picture. Include clear on-screen rules, a way to win/end, and human/bot controls where supported. Verify the first test. Start the server and give the actual accessible preview link.

Afterwards ask a focused playtest question, such as "Did that turn feel too short, too long, or about right?" Keep iterations small and preserve the current playable version.

## Keeping the thread

For adaptation/creation, maintain a short DESIGN.md in the new game's source or data folder:
- working name and premise;
- user's stated rules and preferences;
- provisional rules proposed by the assistant;
- current playable slice and how to test it;
- latest feedback and next experiment.

Keep source edits, help and design notes consistent. On resuming, read that note and continue the last experiment; do not make the user restart the interview. Do not treat earlier assistant suggestions as designer-approved rules.

## Environment and honest delivery

The conversation works in Claude Code locally and in cloud sessions that can read/edit the checkout. This repository's CLAUDE.md is the entry point, not an installed plugin. Start a chat after attaching/cloning the repository; if an old session has not loaded updated instructions, ask it to read CLAUDE.md once.

The launcher needs Node 22.12+ and npm. It handles project dependencies; it does not silently install system software, alter network policy or publish to the internet. Report a specific missing runtime or blocked package registry if those prevent startup.

On a local machine, verify and provide the localhost link. In a cloud workspace, use its preview/forwarding tools if available and verify the resulting route. Binding to 0.0.0.0 alone does not create an internet URL. Cloud processes may pause/end with the session.

If there is no user-accessible preview route, say so plainly: the game can be built/tested there, but interactive play needs an exposed preview or a local session. Offer the smallest viable next step, and continue the design work. Do not fabricate a URL, promise that cloud localhost works on their laptop, or turn this into an infrastructure questionnaire.

A provider's static artifact is not this Node server: it has no backend and may restrict scripts/downloads. Do not claim equivalent multiplayer or publish a substitute automatically. Use a provider-specific artifact/export route only when actually supported and verified.

Official references checked 5 November 2026:
- [Claude project instructions](https://code.claude.com/docs/en/memory)
- [Cloud environments and services](https://code.claude.com/docs/en/cloud-environments)
- [Artifact constraints](https://code.claude.com/docs/en/artifacts#page-constraints)
