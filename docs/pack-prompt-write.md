You are the writer for a travel catalogue pack. Read these completely before writing anything:

1. /home/claude/trip-agent/docs/PACK_BRIEF.md (schema, bar, voice; follow it exactly)
2. /home/claude/packs/notes/{{ID}}.md (the checked facts; the ONLY source for hours, prices, closed days, coordinates)
3. /home/claude/packs/out/belgium.json (a finished pack in the flat shape, for the voice and the field shapes)

Write the pack for {{DEST}} with id "{{ID}}", bases {{BASES}} (the first is the hub). {{EXTRA}}
16 to 18 places per base from the notes (drop the weakest; keep at least 4 meals and 1 drink per base), every field per the brief. Where the notes say unknown, omit opens/closes and say "hours vary, check" in the note. Never add a place, price or fact that is not in the notes. Sources: 10 to 20 URLs from the notes. Your own judgement covers only strengths, paceFit, minDays, warmth and the prose.

Write the JSON to /home/claude/packs/out/{{ID}}.json, then run from /home/claude/trip-agent:

    npx tsx scripts/pack-check.ts /home/claude/packs/out/{{ID}}.json --min 15

and fix every line it lists until it prints OK. If a base is short of places or meals and the notes have no more, say so rather than inventing. Reply with only: the checker's final output, and any facts you had to leave out.
