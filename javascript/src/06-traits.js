	/* 原版特质静态表（v1.8.0 自本体 traits widget 提取） */
var VANILLA_TRAITS_RAW = [
    {"cat":"General Traits","name":"Virgin","has":"$player.virginity.vaginal is true and $player.virginity.penile is true","text":"Your purity recovers faster. Your virginity might be worth something."},
  {"cat":"General Traits","name":"Chastity Vow","has":"$player.virginity.temple is true","text":"Lost when your penis/vagina is penetrated. The temple will know."},
  {"cat":"General Traits","name":"Broken Vow","has":"$player.virginity.temple isnot true and $temple_rank isnot \"prospective\" and $temple_rank isnot undefined","text":"The temple will know."},
  {"cat":"General Traits","name":"Rite of Promise: $templePromised","has":"$templePromised isnot \"\" and $player.virginity.temple is true","text":"You've been bound to another member of the temple."},
  {"cat":"General Traits","name":"Broken Promise: $templePromised","has":"$templePromised isnot \"\" and $player.virginity.temple isnot true","text":"The temple will know."},
  {"cat":"General Traits","name":"Temple Burden: $temple_burden%","has":"$temple_burden gte 1","text":"You are carrying part of the world's corruption within yourself."},
  {"cat":"General Traits","name":"Purity Boost","has":"$featsPurityBoost gt 0","text":"You are gaining purity daily."},
  {"cat":"General Traits","name":"Impurity Boost","has":"$featsPurityBoost lt 0","text":"You are losing purity daily."},
  {"cat":"General Traits","name":"Crossdresser","has":"$backgroundTraits.includes(\"crossdresser\")","text":"Stress decays faster when you look like the opposite gender."},
  {"cat":"General Traits","name":"Lustful","has":"$backgroundTraits.includes(\"lustful\")","text":"Arousal increases over time and needs to be managed."},
  {"cat":"General Traits","name":"Green Thumb","has":"$backgroundTraits.includes(\"greenthumb\")","text":"More bountiful crops and no decay when using fertiliser."},
  {"cat":"General Traits","name":"Dendrophile／Plant Lover","has":"$backgroundTraits.includes(\"plantlover\")","text":"Plants are everything to you."},
  {"cat":"General Traits","name":"Nectar Addict","has":"$backgroundTraits.includes(\"plantlover\")","text":"You're more vulnerable to aphrodisiacs and alcohol."},
  {"cat":"General Traits","name":"Ear slime focus: $earSlime.focus","has":"$earSlime.focus and $earSlime.focus isnot \"none\"","text":"You chose a path for the ear slime."},
  {"cat":"General Traits","name":"Pregnant","has":"playerIsPregnant() and playerAwareTheyArePregnant()","text":"You are with child."},
  {"cat":"General Traits","name":"First Time Mother","has":"playerNormalPregnancyTotal() is 1","text":"You have given birth to your first child."},
  {"cat":"General Traits","name":"Second Time Mother","has":"playerNormalPregnancyTotal() is 2","text":"You have given birth to children two times now."},
  {"cat":"General Traits","name":"Mother","has":"between(playerNormalPregnancyTotal(), 3, 7)","text":"You have some good experiences of being a mother."},
  {"cat":"General Traits","name":"Broodmother","has":"between(playerNormalPregnancyTotal(), 8, 19)","text":"You have given birth to many, many children."},
  {"cat":"General Traits","name":"Gaia","has":"playerNormalPregnancyTotal() gte 20","text":"You have given birth to a veritable dynasty of children."},
  {"cat":"General Traits","name":"Parasite Broodmother","has":"$sexStats.anus.pregnancy.motherStatus is 2 or $sexStats.vagina.pregnancy.motherStatus is 2","text":"You've become host to an endless number of little critters."},
  {"cat":"General Traits","name":"Parasite Mother","has":"($sexStats.anus.pregnancy.motherStatus is 1 or $sexStats.vagina.pregnancy.motherStatus is 1) and !($sexStats.anus.pregnancy.motherStatus is 2 or $sexStats.vagina.pregnancy.motherStatus is 2)","text":"You have given birth to little critters."},
  {"cat":"General Traits","name":"Lactating","has":"$lactating gte 1 and $settings.breastFeedingEnabled","text":"Your breasts are ready to be milked."},
  {"cat":"General Traits","name":"Milk Factory","has":"$lactating gte 1 and $settings.breastFeedingEnabled and $milk_volume gte 1000","text":"Your breasts are able to hold a tremendous amount of milk."},
  {"cat":"General Traits","name":"Sperm Bank","has":"$semen_volume gte 1000 and $player.penisExist","text":"You carry a tremendous amount of semen."},
  {"cat":"General Traits","name":"Possessed","has":"$possessed","text":"Your body is not your own."},
  {"cat":"General Traits","name":"Wolf","has":"$wolfgirl gte 6","text":"The spirit of the wild lives within you."},
  {"cat":"General Traits","name":"Cat","has":"$cat gte 6","text":"You have an urge to lap up cream."},
  {"cat":"General Traits","name":"Bull／Cow","has":"$cow gte 6","text":"You yearn to be milked."},
  {"cat":"General Traits","name":"Harpy／Bird","has":"$harpy gte 6","text":"The skies call."},
  {"cat":"General Traits","name":"Fox／Vixen","has":"$fox gte 6","text":"You have the urge to keep what's not yours."},
  {"cat":"General Traits","name":"Fangs","has":"![\"disabled\", \"hidden\"].includes($transformationParts.traits.fangs)","text":"Biting is twice as effective."},
  {"cat":"General Traits","name":"Sharp Eyes","has":"![\"disabled\", \"hidden\"].includes($transformationParts.traits.sharpEyes)","text":"Little escapes your notice. +5% skulduggery."},
  {"cat":"General Traits","name":"Heterochromia","has":"$heterochromia is 1","text":"Your eyes are two different colours."},
  {"cat":"General Traits","name":"Sturdy Horns","has":"$cow gte 2 and $demon lt 2","text":"Headbutts no longer hurt you."},
  {"cat":"General Traits","name":"Mate For Life","has":"![\"disabled\", \"hidden\"].includes($transformationParts.traits.mateForLife)","text":"Gain bonuses when sleeping or copulating with your Love Interest."},
  {"cat":"General Traits","name":"Thrill of the Chase","has":"![\"disabled\", \"hidden\"].includes($transformationParts.traits.chase)","text":"Gain a bonus to athletics and unlocks the ambush action."},
  {"cat":"General Traits","name":"Fallen Angel","has":"$fallenangel gte 4","text":"The world is so cruel. Unlocks the disparage action."},
  {"cat":"General Traits","name":"Iron Will","has":"$fallenangel is 4","text":"Willpower no longer decays."},
  {"cat":"General Traits","name":"Angel","has":"$angel gte 6","text":"You radiate purity. Unlocks the forgive action."},
  {"cat":"General Traits","name":"Incubus／Succubus","has":"$demon gte 6","text":"You're devoid of purity."},
  {"cat":"General Traits","name":"Radiant","has":"$angel gte 4","text":"You are pure. Unlocks the banish action."},
  {"cat":"General Traits","name":"Dark Horns","has":"$cow lt 2 and $demon gte 2","text":"Headbutts deal twice as much damage."},
  {"cat":"General Traits","name":"Compound Horns","has":"$cow gte 2 and $demon gte 2","text":"Your headbutts are vicious."},
  {"cat":"General Traits","name":"Strong Wings／Thoroughly Preened Wings","has":"$harpy gte 6 and $birdFly gte 1","text":"Can glide from high locations. Can fly where the wind is willing."},
  {"cat":"General Traits","name":"Wings","has":"!($harpy gte 6 and $birdFly gte 1) and ($angel gte 6 or $fallenangel gte 2 or $demon gte 6 or $harpy gte 6)","text":"Can glide from high locations."},
  {"cat":"General Traits","name":"Meek","has":"$submissive gte 1150 and $submissive lt 1500","text":"Unlocks the Moan action."},
  {"cat":"General Traits","name":"Submissive","has":"$submissive gte 1500","text":"Unlocks the Moan action."},
  {"cat":"General Traits","name":"Bratty","has":"$submissive lte 850 and $submissive gt 500","text":"Unlocks the Demand action."},
  {"cat":"General Traits","name":"Defiant","has":"$submissive lte 500","text":"Unlocks the Demand action."},
  {"cat":"General Traits","name":"Innocent","has":"$innocencestate is 1","text":"You're flattered that so many people want to spend time with you."},
  {"cat":"General Traits","name":"Guilty Masochist","has":"$masochism_level is 1","text":"Provides a small resistance to most sources of pain."},
  {"cat":"General Traits","name":"Masochist","has":"$masochism_level is 2","text":"Provides resistance to most sources of pain."},
  {"cat":"General Traits","name":"Hardened Masochist","has":"$masochism_level is 3","text":"Provides strong resistance to most sources of pain."},
  {"cat":"General Traits","name":"Drooling Masochist","has":"$masochism_level is 4","text":"Provides incredible resistance to most sources of pain."},
  {"cat":"General Traits","name":"Guilty Sadist","has":"$sadism_level is 1","text":"Your defiant acts inflict a little more pain."},
  {"cat":"General Traits","name":"Sadist","has":"$sadism_level is 2","text":"Your defiant acts inflict more pain."},
  {"cat":"General Traits","name":"Hardened Sadist","has":"$sadism_level is 3","text":"Your defiant acts inflict much more pain."},
  {"cat":"General Traits","name":"Vengeful Sadist","has":"$sadism_level is 4","text":"Your defiant acts are far more dangerous."},
  {"cat":"General Traits","name":"Farmer","has":"$farm_stage gte 6","text":"You know your way around a barn."},
  {"cat":"General Traits","name":"Knowledge: Islander language","has":"$islander_language gte 100","text":"You can understand and speak the tongue of the islanders."},
  {"cat":"General Traits","name":"Knowledge: Quicksand","has":"$quicksand gte 5","text":"You know how to react when stuck in the stuff."},
  {"cat":"General Traits","name":"Ancient Arts","has":"$hc?.wraith","text":"You've learned techniques lost to the past."},
  {"cat":"General Traits","name":"Mirror Madness","has":"$asylum_mirror gte 5","text":"Looking in a mirror lowers awareness and trauma once a day."},
  {"cat":"General Traits","name":"Eyes in the Night","has":"$asylum_tunnels gte 6","text":"Lower allure in the forest at night."},
  {"cat":"Medicinal Traits","name":"Hair Growth Formula","has":"_pills and _pills[\"Hair Growth Formula\"] and _pills[\"Hair Growth Formula\"].doseTaken","text":"() =&gt; {\n\t\t\t\t\t\treturn `A hair growth formula has been applied, to encourage faster hair growth. ${_pills[\"Hair Growth Formula\"].doseTaken} day${_pills[\"Hair Growth Formula\"].dose"},
  {"cat":"Medicinal Traits","name":"Anti-Parasite Cream","has":"_pills and _pills[\"Anti-Parasite Cream\"] and _pills[\"Anti-Parasite Cream\"].doseTaken","text":"() =&gt; {\n\t\t\t\t\t\treturn `A parasite-repelling cream, preventing further internal parasite impregnation. ${_pills[\"Anti-Parasite Cream\"].doseTaken} day${_pills[\"Anti-Parasite Cream\""},
  {"cat":"Medicinal Traits","name":"Fertility booster","has":"_pills and _pills[\"fertility booster\"] and _pills[\"fertility booster\"].doseTaken","text":"() =&gt; {\n\t\t\t\t\t\tlet result = `You have ${_pills[\"fertility booster\"].doseTaken gte 2 ? \"overdosed on pills\" : \"taken a pill\"} that `;\n\t\t\t\t\t\tlet multiple = false;\n\t\t\t\t\t\tlet hasEffe"},
  {"cat":"Medicinal Traits","name":"Contraceptive","has":"_pills and _pills[\"contraceptive\"] and _pills[\"contraceptive\"].doseTaken","text":"() =&gt; {\n\t\t\t\t\t\tlet result = `You have ${_pills[\"contraceptive\"].doseTaken gte 2 ? \"overdosed on pills\" : \"taken a pill\"} that `;\n\t\t\t\t\t\tlet multiple = false;\n\t\t\t\t\t\tlet hasEffect ="},
  {"cat":"Medicinal Traits","name":"Penis blocker pills","has":"_pills and _pills[\"penis blocker\"] and _pills[\"penis blocker\"].doseTaken","text":"() =&gt; {\n\t\t\t\t\t\tlet result = `You have taken a pill that`;\n\t\t\t\t\t\tif ($player.penisExist) {\n\t\t\t\t\t\t\tresult += \" prevents the re-sizing of your penis.\";\n\t\t\t\t\t\t} else {\n\t\t\t\t\t\t\tresult "},
  {"cat":"Medicinal Traits","name":"Penis growth pills","has":"_pills and _pills[\"penis growth\"] and _pills[\"penis growth\"].doseTaken","text":"() =&gt; {\n\t\t\t\t\t\tlet result = `You have ${_pills[\"penis growth\"].doseTaken gte 2 ? \"overdosed on\" : \"taken\"} pills that `;\n\t\t\t\t\t\tif ($player.penisExist) {\n\t\t\t\t\t\t\tresult += \" encour"},
  {"cat":"Medicinal Traits","name":"Penis reduction pills","has":"_pills and _pills[\"penis reduction\"] and _pills[\"penis reduction\"].doseTaken","text":"() =&gt; {\n\t\t\t\t\t\tlet result = `You have ${_pills[\"penis reduction\"].doseTaken gte 2 ? \"overdosed on\" : \"taken\"} pills that `;\n\t\t\t\t\t\tif ($player.penisExist) {\n\t\t\t\t\t\t\tresult += \" enc"},
  {"cat":"Medicinal Traits","name":"Breast blocker pills","has":"_pills and _pills[\"breast blocker\"] and _pills[\"breast blocker\"].doseTaken","text":"\"You have taken a pill that prevents the re-sizing of your breasts.\""},
  {"cat":"Medicinal Traits","name":"Breast growth pills","has":"_pills and _pills[\"breast growth\"] and _pills[\"breast growth\"].doseTaken","text":"`You have ${_pills and _pills[\"breast growth\"].doseTaken gte 2 ? \"overdosed on\" : \"taken\"} a pill that encourages the growth of your breasts.`"},
  {"cat":"Medicinal Traits","name":"Breast reduction pills","has":"_pills and _pills[\"breast reduction\"] and _pills[\"breast reduction\"].doseTaken","text":"`You have ${_pills and _pills[\"breast reduction\"].doseTaken gte 2 ? \"overdosed on\" : \"taken\"} a pill that encourages the shrinking of your breasts.`"},
  {"cat":"Medicinal Traits","name":"Bottom blocker pills","has":"_pills and _pills[\"bottom blocker\"] and _pills[\"bottom blocker\"].doseTaken","text":"\"You have taken a pill that prevents the re-sizing of your bottom.\""},
  {"cat":"Medicinal Traits","name":"Bottom growth pills","has":"_pills and _pills[\"bottom growth\"] and _pills[\"bottom growth\"].doseTaken","text":"`You have ${_pills and _pills[\"bottom growth\"].doseTaken gte 2 ? \"overdosed on\" : \"taken\"} a pill that encourages the growth of your bottom.`"},
  {"cat":"Medicinal Traits","name":"Bottom reduction pills","has":"_pills and _pills[\"bottom reduction\"] and _pills[\"bottom reduction\"].doseTaken","text":"`You have ${_pills and _pills[\"bottom reduction\"].doseTaken gte 2 ? \"overdosed on\" : \"taken\"} a pill that encourages the shrinking of your bottom.`"},
  {"cat":"Special Traits","name":"Hedonist／Orgasm Addict","has":"$orgasmtrait gte 1","text":"\"The number of orgasms you have had has left a lasting physiological effect. Climaxing is more difficult but pleasurable orgasms relieve more stress and painful orgasms no longer i"},
  {"cat":"Special Traits","name":"Asphyxiophilia","has":"$choketrait gte 1","text":"\"You've come to love the feeling of lack of oxygen. Getting choked makes sex more pleasurable.\""},
  {"cat":"Special Traits","name":"Cumoisseur／Cum Dump","has":"$ejactrait gte 1","text":"\"You've become accustomed to the scent of ejaculate and can take advantage of its calming effect. Your stress is reduced hourly depending on how much slime and semen covers you.\""},
  {"cat":"Special Traits","name":"Graceful／Plaything","has":"$molesttrait gte 1","text":"\"You've learned to better cope with psychological trauma. Being molested no longer removes your sense of control (rape still does).\""},
  {"cat":"Special Traits","name":"Survivor／Fucktoy","has":"$rapetrait gte 1","text":"\"You've been raped so much that you've learned how to cope. Trauma increases more slowly.\""},
  {"cat":"Special Traits","name":"Tamer／Bitch","has":"$bestialitytrait gte 1","text":"\"Animals have tried to &lt;&lt;if $settings.pregnancySpeechEnabled&gt;&gt;breed&lt;&lt;else&gt;&gt;mate&lt;&lt;/if&gt;&gt; with you so often that you're used to it. Trauma increase"},
  {"cat":"Special Traits","name":"Witch／Prey","has":"$tentacletrait gte 1","text":"\"Many tentacles have had their way with your body. Trauma increases more slowly when attacked by tentacles.\""},
  {"cat":"Special Traits","name":"Daredevil／Tasty","has":"$voretrait gte 1","text":"\"You've found your way into the belly of many a creature. They'll have a harder time swallowing you as they savour your taste.\""},
  {"cat":"Special Traits","name":"Milk Enthusiast／Milk Addict","has":"$milkdranktrait gte 1","text":"\"You take full advantage of the nutrition in fresh breast milk. Drinking it invigorates your body, improving physique.\""},
  {"cat":"School Traits","name":"Passable Science","has":"$sciencetrait is 1","text":"\"Pain is slightly easier to cope with.\""},
  {"cat":"School Traits","name":"Decent Science","has":"$sciencetrait is 2","text":"\"Pain is moderately easier to cope with.\""},
  {"cat":"School Traits","name":"Good Science","has":"$sciencetrait is 3","text":"\"Pain is easier to cope with.\""},
  {"cat":"School Traits","name":"Excellent Science","has":"$sciencetrait is 4","text":"\"Pain is much easier to cope with.\""},
  {"cat":"School Traits","name":"Passable Maths","has":"$mathstrait is 1","text":"\"You make 25% more from tips and negotiated fees.\""},
  {"cat":"School Traits","name":"Decent Maths","has":"$mathstrait is 2","text":"\"You make 50% more from tips and negotiated fees.\""},
  {"cat":"School Traits","name":"Good Maths","has":"$mathstrait is 3","text":"\"You make 75% more from tips and negotiated fees.\""},
  {"cat":"School Traits","name":"Excellent Maths","has":"$mathstrait is 4","text":"\"You make 100% more from tips and negotiated fees.\""},
  {"cat":"School Traits","name":"Passable English","has":"$englishtrait is 1","text":"\"Speech actions (plead, moan, demand, apologise, mock, tease, ask to be more rough) are twice as effective.\""},
  {"cat":"School Traits","name":"Decent English","has":"$englishtrait is 2","text":"\"Speech actions (plead, moan, demand, apologise, mock, tease, ask to be more rough) are three times as effective.\""},
  {"cat":"School Traits","name":"Good English","has":"$englishtrait is 3","text":"\"Speech actions (plead, moan, demand, apologise, mock, tease, ask to be more rough) are four times as effective.\""},
  {"cat":"School Traits","name":"Excellent English","has":"$englishtrait is 4","text":"\"Speech actions (plead, moan, demand, apologise, mock, tease, ask to be more rough) are five times as effective.\""},
  {"cat":"School Traits","name":"Passable History","has":"$historytrait is 1","text":"\"You know there are secret paths around town.\""},
  {"cat":"School Traits","name":"Decent History","has":"$historytrait is 2","text":"\"You know of a few secret paths around town.\""},
  {"cat":"School Traits","name":"Good History","has":"$historytrait is 3","text":"\"You know of several secret paths around town.\""},
  {"cat":"School Traits","name":"Excellent History","has":"$historytrait is 4","text":"\"You know of many secret paths around town.\""},
  {"cat":"School Traits","name":"Okay at school","has":"$schooltrait is 1","text":"\"Your performance at school has improved your self-esteem, slightly increasing your daily trauma decay.\""},
  {"cat":"School Traits","name":"Decent at school","has":"$schooltrait is 2","text":"\"Your performance at school has improved your self-esteem, moderately increasing your daily trauma decay.\""},
  {"cat":"School Traits","name":"Good at school","has":"$schooltrait is 3","text":"\"Your performance at school has improved your self-esteem, increasing your daily trauma decay.\""},
  {"cat":"School Traits","name":"Excellent at school","has":"$schooltrait is 4","text":"\"Your performance at school has improved your self-esteem, greatly increasing your daily trauma decay.\""},
  {"cat":"School Traits","name":"Science Fair Winner","has":"$scienceprojectwon is 1","text":"\"You have been publicly recognised for your detailed and informative science project.\""},
  {"cat":"School Traits","name":"Maths Competition Winner","has":"$mathsprojectwon is 1","text":"\"You have been publicly recognised for your insightful solution to such a challenging mathematics problem.\""},
  {"cat":"School Traits","name":"Stage Play Performer","has":"$englishPlayWell is 1","text":"\"Your star performance during the student stage play elevated the production to great heights and much acclaim.\""},
  {"cat":"Trauma Traits","name":"Suppressed Insomnia／Insomnia／Controlled Insomnia","has":"$sleeptrouble gte 1","text":"\"Sleep less effective.\""},
  {"cat":"Trauma Traits","name":"Nightmares／Controlled Nightmares","has":"$nightmares gte 1","text":"\"Sleep is stressful.\""},
  {"cat":"Trauma Traits","name":"Anxiety Disorder／Controlled Anxiety Disorder","has":"$anxiety gte 1","text":"\"Stress won't automatically decrease over time.\""},
  {"cat":"Trauma Traits","name":"Severe Anxiety Disorder／Controlled Severe Anxiety Disorder","has":"$anxiety gte 2","text":"\"Stress increases over time.\""},
  {"cat":"Trauma Traits","name":"Flashbacks／Controlled Flashbacks","has":"$flashbacks gte 1","text":"\"May relive nasty experiences.\""},
  {"cat":"Trauma Traits","name":"Panic Attacks／Controlled Panic Attacks","has":"$panicattacks gte 1","text":"\"Chance of paralysis.\""},
  {"cat":"Trauma Traits","name":"Severe Panic Attacks／Controlled Severe Panic Attacks","has":"$panicattacks gte 2","text":"\"Chance of uncontrollable violent outbursts.\""},
  {"cat":"Trauma Traits","name":"Hallucinations／Controlled Hallucinations","has":"$hallucinations gte 1","text":"\"More dangers during encounters.\""},
  {"cat":"Trauma Traits","name":"Severe Hallucinations／Controlled Severe Hallucinations","has":"$hallucinations gte 2","text":"\"More dangerous world.\""},
  {"cat":"Trauma Traits","name":"Visibly Disturbed","has":"$dissociation gte 1","text":"\"There's something wrong with you, and people can tell.\""},
  {"cat":"Trauma Traits","name":"Dissociation／Controlled Dissociation","has":"$dissociation gte 2","text":"\"Nothing feels real.\""},
  {"cat":"NPC Traits","name":"Robin's Protector","has":"$robinpaid gte 1","text":"\"Robin is dependent on you. You need to be strong. Increases daily trauma decay.\""},
  {"cat":"NPC Traits","name":"Stockholm Syndrome: Eden","has":"$syndromeeden gte 1","text":"\"It must be lonely living on your own in the woods.\""},
  {"cat":"NPC Traits","name":"Stockholm Syndrome: Kylar","has":"$syndromekylar gte 1 and (C.npc.Kylar.state isnot \"prison\" or $location is \"prison\")","text":"\"Everyone deserves a friend.\""},
  {"cat":"NPC Traits","name":"Stockholm Syndrome: Wolves／Stockholm Syndrome: Wolf People","has":"$syndromewolves gte 1","text":"() =&gt; V.settings.bestialityEnabled ? \"They're just cute animals.\" : \"They're just cute monsters.\""},
  {"cat":"NPC Traits","name":"Stockholm Syndrome: Great Hawk","has":"$syndromebird gte 1","text":"() =&gt; V.greathawkmonster === 2 || !V.settings.bestialityEnabled ? \"&lt;&lt;nnpc_He 'Great Hawk'&gt;&gt; only wants a mate.\" : \"It only wants a mate.\""},
  {"cat":"NPC Traits","name":"Avery's Saviour","has":"$avery_fate is \"saved\"","text":"\"You saved Avery's life. Rage decreases daily.\""},
  {"cat":"Hypnosis Traits","name":"Hypnotic Suggestion","has":"$hypnosis_traits.suggestion is 1","text":"\"Doctor Harper told you to do something, but it's a bit hazy.\""},
  {"cat":"Hypnosis Traits","name":"Bewitched Suggestion","has":"$hypnosis_traits.suggestion is 2","text":"\"Doctor Harper told you to do something, but you have trouble remembering what.\""},
  {"cat":"Hypnosis Traits","name":"Beguiled Suggestion","has":"$hypnosis_traits.suggestion is 3","text":"\"Doctor Harper told you to do something, but you can't remember what.\""},
  {"cat":"Hypnosis Traits","name":"Mesmeric Suggestion","has":"$hypnosis_traits.suggestion is 4","text":"\"Doctor Harper told you to do something, but your mind is blank.\""},
  {"cat":"Hypnosis Traits","name":"Sublime Suggestion","has":"$hypnosis_traits.suggestion is 5","text":"\"Doctor Harper told you to do something, but you can't remember anything at all.\""},
  {"cat":"Hypnosis Traits","name":"Hypnotic Yearning","has":"$hypnosis_traits.scream is 1","text":"\"May beg for rougher treatment instead of screaming.\""},
  {"cat":"Hypnosis Traits","name":"Bewitched Yearning","has":"$hypnosis_traits.scream is 2","text":"\"Will sometimes beg for rougher treatment instead of screaming.\""},
  {"cat":"Hypnosis Traits","name":"Beguiled Yearning","has":"$hypnosis_traits.scream is 3","text":"\"Will usually beg for rougher treatment instead of screaming.\""},
  {"cat":"Hypnosis Traits","name":"Mesmeric Yearning","has":"$hypnosis_traits.scream is 4","text":"\"Will often beg for rougher treatment instead of screaming.\""},
  {"cat":"Hypnosis Traits","name":"Sublime Yearning","has":"$hypnosis_traits.scream is 5","text":"\"Will beg for rougher treatment instead of screaming.\""},
  {"cat":"Hypnosis Traits","name":"Hypnotic Flaunting","has":"$hypnosis_traits.cover is 1","text":"\"May flaunt your body parts instead of covering them.\""},
  {"cat":"Hypnosis Traits","name":"Bewitched Flaunting","has":"$hypnosis_traits.cover is 2","text":"\"Will sometimes flaunt your body parts instead of covering them.\""},
  {"cat":"Hypnosis Traits","name":"Beguiled Flaunting","has":"$hypnosis_traits.cover is 3","text":"\"Will usually flaunt your body parts instead of covering them.\""},
  {"cat":"Hypnosis Traits","name":"Mesmeric Flaunting","has":"$hypnosis_traits.cover is 4","text":"\"Will often flaunt your body parts instead of covering them.\""},
  {"cat":"Hypnosis Traits","name":"Sublime Flaunting","has":"$hypnosis_traits.cover is 5","text":"\"Will flaunt your body parts instead of covering them.\""},
  {"cat":"Hypnosis Traits","name":"Hypnotic Deviancy","has":"$hypnosis_traits.deviancy is 1","text":"\"May provoke beasts at the start of encounters.\""},
  {"cat":"Hypnosis Traits","name":"Bewitched Deviancy","has":"$hypnosis_traits.deviancy is 2","text":"\"Will sometimes provoke beasts at the start of encounters.\""},
  {"cat":"Hypnosis Traits","name":"Beguiled Deviancy","has":"$hypnosis_traits.deviancy is 3","text":"\"Will usually provoke beasts at the start of encounters.\""},
  {"cat":"Hypnosis Traits","name":"Mesmeric Deviancy","has":"$hypnosis_traits.deviancy is 4","text":"\"Will often provoke beasts at the start of encounters.\""},
  {"cat":"Hypnosis Traits","name":"Sublime Deviancy","has":"$hypnosis_traits.deviancy is 5","text":"\"Will provoke beasts at the start of encounters.\""},
  {"cat":"Hypnosis Traits","name":"Bewitched","has":"$hc?.bewitched","text":"\"Your Angel.\""},
  {"cat":"Hypnosis Traits","name":"familiar collar／Hypnotic Devotion／Hypnotic Curiosity","has":"V.hypnosis_traits.devotion === 1","text":"\"You find your mind wandering to the forest every now and then. Gwylan's requests feel strangely compelling.\""},
  {"cat":"Hypnosis Traits","name":"familiar collar／Bewitched Devotion／Bewitched Curiosity","has":"V.hypnosis_traits.devotion === 2","text":"\"Gwylan's presence makes you feel safe. &lt;&lt;nnpc_His 'Gwylan'&gt;&gt; requests are hard to resist. Beneficial hypnosis traits last longer.\""},
  {"cat":"Hypnosis Traits","name":"familiar collar／Beguiled Devotion／Beguiled Curiosity","has":"V.hypnosis_traits.devotion === 3","text":"\"Gwylan's presence is comforting. &lt;&lt;nnpc_His 'Gwylan'&gt;&gt; requests are harder to resist. Beneficial hypnosis traits last longer. School grades do not decay.\""},
  {"cat":"Hypnosis Traits","name":"familiar collar／Mesmeric Devotion／Mesmeric Curiosity","has":"V.hypnosis_traits.devotion === 4","text":"\"Gwylan's presence makes you feel warm. &lt;&lt;nnpc_His 'Gwylan'&gt;&gt; requests are even harder to resist. Anyone else's attempts to hypnotise you might fail. Beneficial hypnosi"},
  {"cat":"Hypnosis Traits","name":"familiar collar／Sublime Devotion／Sublime Curiosity","has":"V.hypnosis_traits.devotion === 5","text":"\"Gwylan makes you feel whole. &lt;&lt;nnpc_His 'Gwylan'&gt;&gt; requests are &lt;span class='red'&gt;impossible&lt;/span&gt; to resist. Anyone else's attempts to hypnotise you will"},
  {"cat":"Hypnosis Traits","name":"familiar collar／Frenzied Devotion／Frenzied Curiosity","has":"V.hypnosis_traits.devotion &gt;= 6","text":"\"???\""},
  {"cat":"Hypnosis Traits","name":"Hypnotic Peace","has":"V.hypnosis_traits.peace gte 1","text":"\"You are at peace with your inner self. Hiding transformation parts no longer inflicts trauma.\""},
  {"cat":"Hypnosis Traits","name":"Hypnotic Silence","has":"V.hypnosis_traits.silence gte 1","text":"\"Your thoughts are solitary and tranquil. Ear slimes are temporarily silenced.\""},
  {"cat":"Hypnosis Traits","name":"Hypnotic Slumber","has":"V.hypnosis_traits.slumber gte 1","text":"\"Sleep is more restful when traumatised, and the 'insomnia' trait is suppressed, if present.\""},
  {"cat":"Hypnosis Traits","name":"Hypnotic Ignorance／Hypnotic Insight","has":"V.hypnosis_traits.insight gte 1","text":"\"High awareness no longer causes hallucinations. Low awareness causes hallucinations instead.\""},
  {"cat":"Acceptance Traits","name":"() =&gt; {\n\t\t\t\t\t\tconst penisSize = setup.penisSizes[$player.penissize].toUpperFirst();\n\t\t\t\t\t\treturn `Acceptance: ${penisSize} Penis`;\n\t\t\t\t\t}","has":"$acceptance_penis_small gte 1000 and $player.penissize lte 3","text":"\"You're proud of your small penis.\""},
  {"cat":"Acceptance Traits","name":"Acceptance: Tomgirl","has":"$acceptance_tomgirl gte 100 and $acceptance_penis_small gte 1000 and $player.penissize lte 2","text":"\"You're proud of becoming a tomgirl.\""},
  {"cat":"Acceptance Traits","name":"() =&gt; {\n\t\t\t\t\t\tconst penisSize = setup.penisSizes[$player.penissize].toUpperFirst();\n\t\t\t\t\t\treturn `Acceptance: ${penisSize} Penis`;\n\t\t\t\t\t}","has":"$acceptance_penis_big gte 1000 and $player.penissize gte 6","text":"\"You're proud of your enormous penis.\""},
  {"cat":"Acceptance Traits","name":"Acceptance: Flat Chest","has":"$acceptance_breasts_tiny gte 1000 and $player.breastsize lte 0 and $player.sex is \"f\"","text":"\"You're proud of your flat chest.\""},
  {"cat":"Acceptance Traits","name":" Breasts／Flat Chest","has":"$acceptance_breasts_small gte 1000 and between($player.breastsize","text":"\"You're proud of your small breasts.\""},
  {"cat":"Acceptance Traits","name":"() =&gt; {\n\t\t\t\t\t\tconst breastSize = setup.breastsizes[$player.breastsize].toUpperFirst();\n\t\t\t\t\t\treturn `Acceptance: ${breastSize} Breasts`;\n\t\t\t\t\t}","has":"$acceptance_breasts_big gte 1000 and $player.breastsize gte 8","text":"\"You're proud of your huge breasts.\""},
  {"cat":"Acceptance Traits","name":"Acceptance: Pregnant Belly／Acceptance: Pregnant Looking Belly","has":"$acceptance_pregnancy gte 1000 and playerBellySize() gte 8","text":"() =&gt; playerAwareTheyArePregnant() ? \"You're proud of your lifebearing belly.\" : \"You're proud of your large belly.\""},
  {"cat":"???","name":"Elk-scarred","has":"$auriga_scar is 1","text":"\"An invisible wound hangs over your heart. Trauma and awareness increase over time. Purity decreases over time.\""},
  {"cat":"???","name":"Elk-marked","has":"$auriga_scar is 2","text":"\"A crackling wound surrounds your heart. You're harder to notice, and to recognise as human.\""},
  {"cat":"???","name":"Elk-bitten","has":"$auriga_scar is 3","text":"\"A hole threatens to swallow your black heart. Something seeks to escape.\""},
  {"cat":"???","name":"Elk-ruptured","has":"$auriga_scar is 4","text":"\"A rupture severs your black, unbeating heart. Damnation is imminent.\""},
  {"cat":"???","name":"Elk-spawned","has":"$auriga_scar gte 5","text":"\"Damnation.\""},
];

/* ============ v1.8.0 特质管理（替代 v1.7.0 玩家属性/模组属性区）
   数据源：① VANILLA_TRAITS_RAW（本体 traits widget 提取：cat/name/has）
          ② discoverModTraits()（maplebirch.temporary.traitLists 运行时注入的模组特质，装了显示、没装隐藏）
   能力：拥有判定（has 表达式求值）／ 获取+移除（has 全部条件变量写满足，主变量写回不满足）／ 数值可改（数值比较变量）
   ============ */
var curPlayerFilter = "";
var TRAIT_ZH_CAT = {
	"General Traits": "一般特质", "Medicinal Traits": "药物特质", "Special Traits": "特殊特质",
	"School Traits": "学校特质", "Trauma Traits": "创伤特质", "NPC Traits": "NPC特质",
	"Hypnosis Traits": "催眠特质", "Acceptance Traits": "接纳特质", "???": "麋鹿印记"
};
var TRAIT_ZH = {
	"Virgin": "童贞", "Chastity Vow": "贞洁誓言", "Broken Vow": "破誓",
	"Rite of Promise": "承诺仪式", "Broken Promise": "破碎的承诺", "Temple Burden": "神殿之担",
	"Purity Boost": "纯洁增幅", "Impurity Boost": "污秽增幅", "Crossdresser": "异装癖",
	"Lustful": "色情脑", "Green Thumb": "园艺大师", "Dendrophile": "植物恋人",
	"Plant Lover": "植物爱好者", "Nectar Addict": "花蜜上瘾", "Hair Growth Formula": "生发配方",
	"Anti-Parasite Cream": "抗寄生虫霜", "Fertility booster": "生育促进剂", "Contraceptive": "避孕药",
	"Penis blocker pills": "阴茎阻断药", "Penis growth pills": "阴茎增大药", "Penis reduction pills": "阴茎缩小药",
	"Breast blocker pills": "胸部阻断药", "Breast growth pills": "胸部增大药", "Breast reduction pills": "胸部缩小药",
	"Bottom blocker pills": "臀部阻断药", "Bottom growth pills": "臀部增大药", "Bottom reduction pills": "臀部缩小药",
	"Hedonist": "享乐主义者", "Orgasm Addict": "高潮成瘾", "Asphyxiophilia": "窒息癖",
	"Cumoisseur": "精液鉴赏家", "Cum Dump": "精液容器", "Graceful": "优雅", "Plaything": "玩物",
	"Survivor": "幸存者", "Fucktoy": "性玩具", "Tamer": "驯兽师", "Bitch": "母狗",
	"Witch": "女巫", "Prey": "猎物", "Daredevil": "胆大妄为", "Tasty": "美味",
	"Milk Enthusiast": "乳汁爱好者", "Milk Addict": "乳汁成瘾",
	"Passable Science": "及格的科学成绩", "Decent Science": "尚可的科学成绩", "Good Science": "良好的科学成绩", "Excellent Science": "优异的科学成绩",
	"Passable Maths": "及格的数学成绩", "Decent Maths": "尚可的数学成绩", "Good Maths": "良好的数学成绩", "Excellent Maths": "优异的数学成绩",
	"Passable English": "及格的语文成绩", "Decent English": "尚可的语文成绩", "Good English": "良好的语文成绩", "Excellent English": "优异的语文成绩",
	"Passable History": "及格的历史成绩", "Decent History": "尚可的历史成绩", "Good History": "良好的历史成绩", "Excellent History": "优异的历史成绩",
	"Okay at school": "在校表现尚可", "Decent at school": "在校表现不错", "Good at school": "在校表现良好", "Excellent at school": "在校表现优秀",
	"Science Fair Winner": "科学博览会冠军", "Maths Competition Winner": "数学竞赛冠军", "Stage Play Performer": "舞台剧演员",
	"Suppressed Insomnia": "被压制的失眠", "Nightmares": "噩梦", "Controlled Nightmares": "受控的噩梦",
	"Anxiety Disorder": "焦虑症", "Controlled Anxiety": "受控的焦虑", "Controlled Anxiety Disorder": "受控的焦虑症",
	"Severe Anxiety Disorder": "严重焦虑症", "Controlled Severe Anxiety Disorder": "受控的严重焦虑症",
	"Controlled Severe Anxiety": "受控的严重焦虑", "Flashbacks": "闪回", "Controlled Flashbacks": "受控的闪回",
	"Panic Attacks": "惊恐发作", "Controlled Panic Attacks": "受控的惊恐发作", "Severe Panic Attacks": "严重惊恐发作",
	"Controlled Severe Panic": "受控的严重惊恐", "Controlled Severe Panic Attacks": "受控的严重惊恐发作",
	"Hallucinations": "幻觉", "Controlled Hallucinations": "受控的幻觉",
	"Severe Hallucinations": "严重幻觉", "Controlled Severe Hallucinations": "受控的严重幻觉",
	"Visibly Disturbed": "明显不安", "Dissociation": "解离", "Controlled Dissociation": "受控的解离",
	"Robin's Protector": "同舟共济：罗宾", "Stockholm Syndrome: Eden": "斯德哥尔摩综合征：伊甸",
	"Stockholm Syndrome: Kylar": "斯德哥尔摩综合征：凯拉尔", "Stockholm Syndrome: Wolves": "斯德哥尔摩综合征：狼群",
	"Stockholm Syndrome: Wolf People": "斯德哥尔摩综合征：狼人", "Stockholm Syndrome: Great Hawk": "斯德哥尔摩综合征：大鹰",
	"Avery's Saviour": "艾弗利的救星",
	"Hypnotic Suggestion": "催眠暗示", "Bewitched Suggestion": "蛊惑暗示", "Beguiled Suggestion": "迷惑暗示",
	"Mesmeric Suggestion": "催眠师暗示", "Sublime Suggestion": "崇高暗示",
	"Hypnotic Yearning": "催眠渴望", "Bewitched Yearning": "蛊惑渴望", "Beguiled Yearning": "迷惑渴望",
	"Mesmeric Yearning": "催眠师渴望", "Sublime Yearning": "崇高渴望",
	"Hypnotic Flaunting": "催眠炫耀", "Bewitched Flaunting": "蛊惑炫耀", "Beguiled Flaunting": "迷惑炫耀",
	"Mesmeric Flaunting": "催眠师炫耀", "Sublime Flaunting": "崇高炫耀",
	"Hypnotic Deviancy": "催眠异变", "Bewitched Deviancy": "蛊惑异变", "Beguiled Deviancy": "迷惑异变",
	"Mesmeric Deviancy": "催眠师异变", "Sublime Deviancy": "崇高异变",
	"Bewitched": "被蛊惑", "Hypnotic Peace": "催眠平静", "Hypnotic Silence": "催眠沉默",
	"Hypnotic Slumber": "催眠沉睡", "Hypnotic Ignorance": "催眠无知", "Hypnotic Insight": "催眠洞察",
	"Hypnotic Devotion": "催眠虔信", "Bewitched Devotion": "蛊惑虔信", "Beguiled Devotion": "迷惑虔信",
	"Mesmeric Devotion": "催眠师虔信", "Sublime Devotion": "崇高虔信", "Frenzied Devotion": "狂乱虔信",
	"Hypnotic Curiosity": "催眠好奇", "Bewitched Curiosity": "蛊惑好奇", "Beguiled Curiosity": "迷惑好奇",
	"Mesmeric Curiosity": "催眠师好奇", "Sublime Curiosity": "崇高好奇", "Frenzied Curiosity": "狂乱好奇",
	"familiar collar": "催眠项圈",
	"Acceptance: Tomgirl": "接纳：假小子", "Acceptance: Flat Chest": "接纳：平胸", "Acceptance: Pregnant": "接纳：怀孕",
	"Breasts": "胸部", "Flat Chest": "平胸", "Penis": "阴茎", "Pregnant Belly": "怀孕的肚子", "Pregnant Looking Belly": "看起来怀孕的肚子",
	"Acceptance: Pregnant Belly": "接纳：怀孕的肚子", "Acceptance: Pregnant Looking Belly": "接纳：看起来怀孕的肚子",
	"Elk-scarred": "麋鹿伤痕", "Elk-marked": "麋鹿印记", "Elk-bitten": "麋鹿撕咬", "Elk-ruptured": "麋鹿撕裂", "Elk-spawned": "麋鹿之嗣",
	"Wolf": "狼", "Cat": "猫", "Cow": "牛", "Harpy": "鸟妖", "Bird": "鸟", "Fox": "狐",
	"Fangs": "獠牙", "Sharp Eyes": "锐利双眼", "Heterochromia": "异色瞳", "Sturdy Horns": "坚固之角",
	"Mate For Life": "终身伴侣", "Pregnant": "怀孕", "First Time Mother": "初为人母", "Second Time Mother": "再次为人母",
	"Mother": "母亲", "Broodmother": "多产母亲", "Gaia": "盖亚", "Parasite Broodmother": "寄生多产母亲",
	"Parasite Mother": "寄生母亲", "Lactating": "哺乳期", "Milk Factory": "乳液狂飙", "Sperm Bank": "精子银行",
	"Possessed": "附身", "Insomnia": "失眠", "Controlled Insomnia": "受控的失眠",
	"Ear slime focus": "耳粘液专注", "Bull": "公牛", "Vixen": "狐女", "Incubus": "梦魔", "Succubus": "魅魔",
	"Strong Wings": "强健之翼", "Thoroughly Preened Wings": "焕然新羽",
	"Thrill of the Chase": "追逐的快感", "Fallen Angel": "堕落天使", "Iron Will": "铁意志",
	"Angel": "天使", "Radiant": "圣光璀璨", "Dark Horns": "暗黑之角", "Compound Horns": "复合之角", "Wings": "翅膀",
	"Meek": "温顺", "Submissive": "顺从", "Bratty": "叛逆", "Defiant": "反抗", "Innocent": "天真无邪",
	"Masochist": "受虐狂", "Guilty Masochist": "愧疚的受虐狂", "Hardened Masochist": "坚硬的受虐狂", "Drooling Masochist": "流口水的受虐狂",
	"Sadist": "施虐狂", "Guilty Sadist": "愧疚的施虐狂", "Hardened Sadist": "坚硬的施虐狂", "Vengeful Sadist": "复仇的施虐狂",
	"Farmer": "农夫",
	"Knowledge: Islander language": "知识：海岛语言", "Knowledge: Quicksand": "知识：流沙",
	"Ancient Arts": "上古技艺", "Mirror Madness": "镜中疯狂", "Eyes in the Night": "夜之眼"
};
/* 本体特质 has 表达式编译缓存（懒编译：判定函数 + 条件变量清单 + 可写数值清单） */
var VANILLA_TRAITS_CACHE = null;
function safeGetObj(root, path) {
	var cur = root, parts = String(path).split(".");
	for (var i = 0; i < parts.length; i++) {
		if (cur === null || cur === undefined) { return undefined; }
		cur = cur[parts[i]];
	}
	return cur;
}
function traitEval(V, C, expr) {
	try {
		if (!expr) { return false; }
		var js = String(expr)
			.replace(/\bisnot\b/g, "!==").replace(/\bis\b/g, "===")
			.replace(/\bgte\b/g, ">=").replace(/\bgt\b/g, ">")
			.replace(/\blte\b/g, "<=").replace(/\blt\b/g, "<")
			.replace(/\band\b/g, "&&").replace(/\bor\b/g, "||");
		/* $a.b.c → V.a.b.c（带可选链 ?. 的原样保留） */
		js = js.replace(/\$([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)(\?\.)/g, 'safeGet(V,"$1")$2');
		js = js.replace(/\$([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)/g, 'safeGet(V,"$1")');
		/* _pills 局部变量 = sexStats.pills.pills */
		js = js.replace(/_pills/g, 'safeGet(V,"sexStats.pills.pills")');
		/* C.npc.X.y */
		js = js.replace(/\bC\.npc\.([A-Za-z_]\w*)\.([A-Za-z_]\w*)/g, 'safeGet(C,"npc.$1.$2")');
		/* 函数调用（playerIsPregnant() 等全局函数）→ globalThis 兜底；排除已生成的 safeGet/globalThis */
		js = js.replace(/([A-Za-z_]\w*)\s*\(/g, function (m0, name) {
			if (name === "safeGet" || name === "globalThis") { return m0; }
			return 'globalThis["' + name + '"](';
		});
		var fn = new Function("V", "C", "safeGet", "return (" + js + ");");
		return !!fn(V, C, safeGetObj);
	} catch (e) { return false; }
}
/* 解析 has 表达式：找出所有 "$var op value" 比较段与 includes 段 */
function parseTraitHas(expr) {
	var out = { vars: [], includes: null, complex: false };
	if (!expr) { return out; }
	var re = /\$([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s+(gte|gt|lte|lt|is|isnot)\s+(true|false|undefined|"[^"]*"|'[^']*'|\d+)/g;
	var m;
	while ((m = re.exec(expr)) !== null) {
		out.vars.push({ path: m[1], op: m[2], val: m[3] });
	}
	var mi = expr.match(/includes\(\s*"([^"]+)"\s*\)/);
	if (mi) { out.includes = mi[1]; }
	if (/playerIsPregnant|playerAwareTheyArePregnant|playerNormalPregnancyTotal|playerBellySize|between\(|toUpperFirst/.test(expr)) {
		out.complex = true;
	}
	return out;
}
function zhTraitName(en) {
	if (TRAIT_ZH[en]) { return TRAIT_ZH[en]; }
	var s = String(en);
	/* 函数源码型 name（traits widget 里 name 为函数文本）：提取 return 模板再映射 */
	if (/^\s*\(\s*\)\s*=>/.test(s) || /^\s*function\b/.test(s)) {
		var m = s.match(/return\s*`([^`]*)`/);
		if (m) { s = m[1]; } else { return "（函数型特质）"; }
	}
	/* 模板插值关键词：Acceptance 系列函数名 "${penisSize}/${breastSize}"（不依赖前缀键） */
	if (/\$\{penisSize\}/.test(s)) { return "接纳：阴茎"; }
	if (/\$\{breastSize\}/.test(s)) { return "接纳：胸部"; }
	/* A/B 多段（全角／与半角/ 分隔，同格并存的两个特质名）逐段映射 */
	var parts = s.split(/[／\/]/);
	if (parts.length > 1) {
		var zh = [];
		parts.forEach(function (p) {
			var t = String(p).trim();
			if (t) { zh.push(zhTraitName(t)); }
		});
		return zh.join(" / ");
	}
	/* ":" 前缀 + 插值名："Temple Burden: $temple_burden%" / "Rite of Promise: ..." */
	var i = s.indexOf(":");
	if (i > 0) {
		var head = s.slice(0, i).trim();
		var tail = s.slice(i + 1).trim();
		if (TRAIT_ZH[head]) {
			return TRAIT_ZH[head] + (tail ? "：" + zhTraitName(tail) : "");
		}
	}
	if (TRAIT_ZH[s]) { return TRAIT_ZH[s]; }
	return s;
}
/* 动态显示名：name 字符串内 $var 替换为当前值；函数表达式取候选英文名转中文 */
function traitDisplayName(t, V) {
	var nm = t.name;
	if (typeof nm === "function") {
		try { nm = nm(); } catch (e) { nm = String(t.name); }
	}
	nm = String(nm);
	nm = nm.replace(/\$([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)/g, function (_, p) {
		var v = safeGetObj(V, p);
		return (v === undefined || v === null) ? "?" : String(v);
	});
	/* 拆出候选英文名做中文映射：形如 "A/B" 或 "A - B" 的取两端 */
	var out = zhTraitName(nm);
	return out;
}
/* 强制获得标记（v1.8.3）：has 无可写条件变量的特质（复杂表达式/函数判定）无法通过写变量满足，
   点「获取」时直接记入 V.mbCE_forcedTraits，面板内视为已获得；可移除（从标记列表删除）。 */
function forcedTraitKey(t) {
	return (t.cat ? String(t.cat) : "?") + "\u0001" + String(t.name || "");
}
function isForcedTrait(V, t) {
	try {
		var fl = V.mbCE_forcedTraits;
		return Array.isArray(fl) && fl.indexOf(forcedTraitKey(t)) !== -1;
	} catch (e) { return false; }
}
function traitOwned(t, V, C) {
	if (isForcedTrait(V, t)) { return true; }
	if (t.hasFn) { try { return !!t.hasFn(); } catch (e) { return false; } }
	return traitEval(V, C, t.has);
}
/* 获取特质：has 全部比较变量写满足值；includes 目标 push 进数组；无可写条件 → 强制获得标记 */
function grantTrait(t, V, C) {
	var info = parseTraitHas(t.has);
	var wrote = [];
	if (info.includes) {
		var arr = safeGetObj(V, "backgroundTraits");
		if (!Array.isArray(arr)) {
			try { V.backgroundTraits = []; arr = V.backgroundTraits; } catch (e) { arr = null; }
		}
		if (arr && arr.indexOf(info.includes) === -1) { arr.push(info.includes); wrote.push("backgroundTraits+" + info.includes); }
	}
	info.vars.forEach(function (v) {
		var vv = String(v.val).replace(/["']/g, "");
		/* isnot + 非布尔/数字字符串值（如 "none"/"prospective"）：无法推断满足值，跳过不写（防写坏） */
		if (v.op === "isnot" && vv !== "true" && vv !== "false" && vv !== "undefined" && isNaN(parseFloat(vv))) { return; }
		var w = traitWriteSatisfy(V, v.path, v.op, v.val);
		if (w) { wrote.push(w); }
	});
	/* 无可写条件（复杂表达式/函数判定/isnot 字符串值）→ 直接获得：记入强制标记 */
	if (!wrote.length) {
		try {
			if (!V.mbCE_forcedTraits || !Array.isArray(V.mbCE_forcedTraits)) { V.mbCE_forcedTraits = []; }
			var fk = forcedTraitKey(t);
			if (V.mbCE_forcedTraits.indexOf(fk) === -1) {
				V.mbCE_forcedTraits.push(fk);
				wrote.push("mbCE_forcedTraits+" + (t.name || fk));
			} else {
				wrote.push("mbCE_forcedTraits+" + (t.name || fk) + "(已有)");
			}
		} catch (e) { wrote.push("(强制获得失败) " + (e && e.message ? e.message : e)); }
	}
	return wrote;
}
/* 移除特质：先清强制获得标记（若有）；再主变量（第一个比较变量）写回不满足值 */
function revokeTrait(t, V, C) {
	var info = parseTraitHas(t.has);
	var wrote = [];
	if (isForcedTrait(V, t)) {
		try {
			var fl = V.mbCE_forcedTraits;
			var idx = fl.indexOf(forcedTraitKey(t));
			if (idx !== -1) { fl.splice(idx, 1); wrote.push("mbCE_forcedTraits-" + (t.name || forcedTraitKey(t))); }
		} catch (e) {}
	}
	if (info.includes) {
		var arr = safeGetObj(V, "backgroundTraits");
		if (Array.isArray(arr)) {
			var idx2 = arr.indexOf(info.includes);
			if (idx2 !== -1) { arr.splice(idx2, 1); wrote.push("backgroundTraits-" + info.includes); }
		}
	}
	if (info.vars.length) {
		var v0 = info.vars[0];
		var w = traitWriteUnsatisfy(V, v0.path, v0.op, v0.val);
		if (w) { wrote.push(w); }
	}
	return wrote;
}
function traitWriteSatisfy(V, path, op, valRaw) {
	var num = (String(valRaw) === "true" || String(valRaw) === "false") ? null : parseFloat(String(valRaw).replace(/["']/g, ""));
	/* 十二巡修复：isnot 语义是「不等于」——满足 isnot true → 写 false；isnot false → 写 true；
	   isnot undefined → 写 1；isnot N → 写 N-1。此前与 is 共用分支导致布尔写反 */
	if (op === "isnot") {
		if (String(valRaw) === "true") { setPathVal(V, path, false); return path + "=false"; }
		if (String(valRaw) === "false") { setPathVal(V, path, true); return path + "=true"; }
		if (String(valRaw) === "undefined") { setPathVal(V, path, 1); return path + "=1"; }
		setPathVal(V, path, num - 1); return path + "=" + (num - 1);
	}
	if (String(valRaw) === "true") { setPathVal(V, path, true); return path + "=true"; }
	if (String(valRaw) === "false") { setPathVal(V, path, false); return path + "=false"; }
	if (String(valRaw) === "undefined") { return null; }
	if (isNaN(num)) { setPathVal(V, path, String(valRaw).replace(/["']/g, "")); return path + "=" + String(valRaw).replace(/["']/g, ""); }
	if (op === "lte") { setPathVal(V, path, num); return path + "=" + num; }
	if (op === "lt") { setPathVal(V, path, num - 1); return path + "=" + (num - 1); }
	/* 四巡自查修复：gt（严格大于）条件满足值必须是 num+1——此前与 gte/is 共用写 num，
	   写后 "x > num" 恒 false → 获取按钮显示已写但判定仍「未获得」
	   （原版受影响特质：Purity Boost $featsPurityBoost gt 0、Bratty $submissive lte 850 and gt 500） */
	if (op === "gt") { setPathVal(V, path, num + 1); return path + "=" + (num + 1); }
	setPathVal(V, path, num); return path + "=" + num;
}
function traitWriteUnsatisfy(V, path, op, valRaw) {
	var num = (String(valRaw) === "true" || String(valRaw) === "false") ? null : parseFloat(String(valRaw).replace(/["']/g, ""));
	/* 十二巡修复：移除时让 isnot 条件变 false——isnot true → 写 true；isnot false → 写 false；
	   isnot undefined → 写 undefined（属性值为 undefined 时 undefined !== undefined 为 false）；isnot N → 写 N */
	if (op === "isnot") {
		if (String(valRaw) === "true") { setPathVal(V, path, true); return path + "=true"; }
		if (String(valRaw) === "false") { setPathVal(V, path, false); return path + "=false"; }
		if (String(valRaw) === "undefined") { setPathVal(V, path, undefined); return path + "=undefined"; }
		setPathVal(V, path, num); return path + "=" + num;
	}
	if (String(valRaw) === "true") { setPathVal(V, path, false); return path + "=false"; }
	if (String(valRaw) === "false") { setPathVal(V, path, true); return path + "=true"; }
	if (isNaN(num)) { setPathVal(V, path, ""); return path + '=""'; }
	if (op === "lte") { setPathVal(V, path, num + 1); return path + "=" + (num + 1); }
	if (op === "lt") { setPathVal(V, path, num); return path + "=" + num; }
	setPathVal(V, path, 0); return path + "=0";
}
function setPathVal(V, path, val) {
	var parts = String(path).split(".");
	var cur = V;
	for (var i = 0; i < parts.length - 1; i++) {
		if (cur[parts[i]] === undefined || cur[parts[i]] === null || typeof cur[parts[i]] !== "object") { cur[parts[i]] = {}; }
		cur = cur[parts[i]];
	}
	cur[parts[parts.length - 1]] = val;
}
/* 编译本体特质表（懒执行） */
function compileVanillaTraits() {
	if (VANILLA_TRAITS_CACHE) { return VANILLA_TRAITS_CACHE; }
	var out = [];
	VANILLA_TRAITS_RAW.forEach(function (t) {
		var info = parseTraitHas(t.has);
		var nm = String(t.name || "").replace(/^"|"$/g, "");
		/* 数值可改清单：数字比较变量（如 temple_burden / sciencetrait） */
		var values = [];
		info.vars.forEach(function (v) {
			var num = parseFloat(String(v.val).replace(/["']/g, ""));
			if (!isNaN(num) && (v.op === "gte" || v.op === "is" || v.op === "gt")) {
				values.push({ path: v.path, op: v.op, val: num });
			}
		});
		out.push({ cat: t.cat, name: nm, has: t.has, parsed: info, values: values });
	});
	VANILLA_TRAITS_CACHE = out;
	return out;
}
/* 运行时发现模组特质：maplebirch.temporary.traitLists（MLI traits.inject 解析后的注入表） */
function discoverModTraits() {
	var out = [];
	try {
		var mb = resolveMB();
		var lists = mb && mb.temporary && mb.temporary.traitLists;
		if (!Array.isArray(lists)) { return out; }
		lists.forEach(function (cat) {
			if (!cat || !Array.isArray(cat.traits)) { return; }
			cat.traits.forEach(function (t) {
				if (!t || !t.name) { return; }
				var hasStr = (typeof t.has === "string") ? t.has : "";
				var parsed = parseTraitHas(hasStr);
				/* 双巡优化①：模组特质数字比较变量同样生成「可改数值」清单（仿 compileVanillaTraits），
				   使模组注入特质的数字条件也能直接改数值/回退——数据层 traitWriteValue/undo 已通用 */
				var values = [];
				parsed.vars.forEach(function (v) {
					var num = parseFloat(String(v.val).replace(/["']/g, ""));
					if (!isNaN(num) && (v.op === "gte" || v.op === "is" || v.op === "gt")) {
						values.push({ path: v.path, op: v.op, val: num });
					}
				});
				out.push({
					cat: String(cat.title || "模组特质"),
					name: (typeof t.name === "function") ? t.name() : String(t.name),
					text: (typeof t.text === "function") ? String(t.text()) : String(t.text || ""),
					/* v1.8.11：保留 has 字符串——字符串判定可复用 grant/revoke 写变量直接获得/移除；
					   函数判定保留 hasFn，走强制获得标记路径 */
					has: hasStr,
					hasFn: (typeof t.has === "function") ? t.has : null,
					parsed: parsed,
					values: values,
					mod: true
				});
			});
		});
	} catch (e) {}
	return out;
}
/* v1.8.3：同系列不同阶段特质合并（如受虐狂 4 档 / 施虐狂 4 档 / 各科成绩 4 档）——
   识别依据：同一分类下 has 表达式只含一个数字比较变量（is/gte/gt N），同变量归为一组，按阈值排序。
   渲染为「阶段下拉 + 应用 + 跳至最高 + 回退初始」，对齐 Mod作弊 子页阶段控件。 */
var TRAIT_SERIES_CN = {
	"masochism_level": "受虐狂", "sadism_level": "施虐狂",
	"sciencetrait": "科学成绩", "mathstrait": "数学成绩", "englishtrait": "语文成绩",
	"historytrait": "历史成绩", "schooltrait": "在校表现"
};
function groupTraitSeries(vanilla) {
	var groups = {};
	vanilla.forEach(function (t) {
		var v = t.parsed && t.parsed.vars;
		if (!v || v.length !== 1) { return; }
		var v0 = v[0];
		if ((v0.op !== "is" && v0.op !== "gte" && v0.op !== "gt") || isNaN(parseFloat(String(v0.val).replace(/["']/g, "")))) { return; }
		var key = t.cat + "\u0001" + v0.path;
		(groups[key] = groups[key] || []).push({ t: t, path: v0.path, val: parseFloat(String(v0.val).replace(/["']/g, "")) });
	});
	var out = [];
	Object.keys(groups).forEach(function (k) {
		var g = groups[k];
		if (g.length >= 2) {
			g.sort(function (a, b) { return a.val - b.val; });
			out.push({ cat: g[0].t.cat, path: g[0].path, series: g });
		}
	});
	out.sort(function (a, b) { return a.series[0].val - b.series[0].val; });
	return out;
}
function traitSeriesName(series) {
	var base = TRAIT_SERIES_CN[series.path];
	if (base) { return base; }
	return traitDisplayName(series.series[0].t, getV());
}
/* 系列行渲染：系列名 + 阶段下拉（无/各档位）+ 应用 + 跳至最高 + 回退初始 */
function renderTraitSeriesRow(body, series, V) {
	var V2 = V || getV();
	var seriesName = traitSeriesName(series);
	var cur = safeGetObj(V2, series.path);
	var curNum = (typeof cur === "number" && isFinite(cur)) ? cur : null;
	var curTier = -1, i;
	for (i = 0; i < series.series.length; i++) {
		if (series.series[i].val === curNum) { curTier = i; break; }
	}
	var sel = el("select", "mce-sel");
	/* 注意：HTMLSelectElement.type 是只读 getter，不能赋值（赋了真实浏览器抛
	   "Cannot set property type of #<HTMLSelectElement>"）；select 也不需要 type */
	var opt0 = el("option", "", "无（未获得）");
	opt0.value = "0";
	sel.appendChild(opt0);
	series.series.forEach(function (item, idx) {
		var o = el("option", "", traitDisplayName(item.t, V2) + "（" + item.val + "）");
		o.value = String(item.val);
		sel.appendChild(o);
	});
	sel.value = String(curTier >= 0 ? series.series[curTier].val : 0);
	var lbl = el("span", "mce-row-lbl", seriesName + "（当前 " + (curTier >= 0 ? traitDisplayName(series.series[curTier].t, V2) : "无") + "）");
	var bApp = el("button", "", "应用"); bApp.type = "button";
	bApp.addEventListener("click", function () {
		var v = parseFloat(sel.value);
		if (isNaN(v)) { v = 0; }
		var res = traitWriteValue(series.series[0].t, V2, series.path, String(v));
		actPlayer(res);
	});
	var bMax = el("button", "", "跳至最高"); bMax.type = "button";
	bMax.addEventListener("click", function () {
		var v = series.series[series.series.length - 1].val;
		var res = traitWriteValue(series.series[0].t, V2, series.path, String(v));
		actPlayer(res);
	});
	var bInit = el("button", "", "回退初始"); bInit.type = "button";
	bInit.addEventListener("click", function () {
		/* 回退初始 = 写 0（无阶段），不依赖留痕（保证从未改过也能回退） */
		var res = traitWriteValue(series.series[0].t, V2, series.path, "0");
		actPlayer(res);
	});
	var row = el("div", "mce-row");
	row.appendChild(lbl); row.appendChild(sel); row.appendChild(bApp); row.appendChild(bMax); row.appendChild(bInit);
	body.appendChild(row);
}
/* 特质管理区渲染：原版分类（静态表）+ 模组特质分类（运行时发现） */
function renderTraitsSection(pane, V, C) {
	var wrap = el("div", "mce-grp");
	wrap.appendChild(el("div", "mce-grp-t", "★ 特质管理：可直接获取/移除，有数值的可直接更改（含其他模组注入的特质，自动发现）。已按分类折叠，点击分类标题展开；行首 ☆ 点击可收藏置顶"));
	var vanilla = compileVanillaTraits();
	var modTraits = discoverModTraits();
	var q = (curPlayerFilter || "").toLowerCase();
	var seenV = {}, seenM = {}, groups = {};
	/* v1.8.12 收藏置顶组：收藏的特质优先显示在最前（含模组特质） */
	var FAV_CAT = "★ 已收藏";
	/* v1.8.12 功能13：收藏集合局部缓存——一次扫描替代逐行 indexOf 查询（几十个特质行的重复数组查找） */
	var favCache = getFavTraits(V).slice();
	function isFav(t) {
		var k = favTraitKey(t);
		return favCache.indexOf(k) !== -1;
	}
	/* 可折叠分类组：标题可点，body 默认收起（data-collapsed=1，CSS 隐藏） */
	/* v1.8.15 九巡：懒渲染——初始收起的组不建行（行闭包进 g.pending），展开才建行，面板开合/切页显著减 DOM */
	function buildLazyRows(g) {
		if (!g || !g.pending || g.pending.length === 0) { return; }
		var pend = g.pending;
		g.pending = [];
		pend.forEach(function (fn) { try { fn(); } catch (e) {} });
	}
	function bodyFor(zhCat, note) {
		if (groups[zhCat]) { return groups[zhCat]; }
		var grp = el("div", "mce-grp");
		grp.setAttribute("data-tcat", zhCat);
		/* 恢复展开时箭头同步 ▾（bodyFor 内读取 mbCEUiState，head 文案一次成型） */
		var restoreOpen = mbCEUiState.collapsed[zhCat] === 0;
		var head = el("div", "mce-grp-t mce-collapse-head", (restoreOpen ? "▾ " : "▸ ") + zhCat);
		var body = el("div", "mce-grp-body");
		/* v1.8.12 持久化：恢复上次折叠状态（0=展开，1=收起；未记录默认收起）；箭头同步 ▸/▾ */
		var collapsedNow = mbCEUiState.collapsed[zhCat] === 0 ? false : true;
		body.setAttribute("data-collapsed", collapsedNow ? "1" : "0");
		head.addEventListener("click", function () {
			var open = body.getAttribute("data-collapsed") !== "1";
			body.setAttribute("data-collapsed", open ? "1" : "0");
			head.textContent = (open ? "▸ " : "▾ ") + zhCat + (groups[zhCat].count > 0 ? "（" + groups[zhCat].count + "）" : "") + groups[zhCat].note;
			/* 懒渲染：展开瞬间补建行（open=点击前展开态，点击前收起(!open) → 点击后展开 → 补建） */
			if (!open) { buildLazyRows(groups[zhCat]); }
			/* v1.8.12 持久化：记录点击后状态（点击后展开 = !open） */
			mbCEUiCollapsed(zhCat, !open);
		});
		grp.appendChild(head);
		grp.appendChild(body);
		if (zhCat === FAV_CAT && wrap.firstChild) {
			/* 收藏组置顶：插到头部工具行之后（工具行常驻最顶） */
			wrap.insertBefore(grp, wrap.firstChild.nextSibling);
		}
		else { wrap.appendChild(grp); }
		var g = { head: head, body: body, count: 0, note: note || "", pending: [] };
		groups[zhCat] = g;
		return g;
	}
	/* v1.8.12 二轮优化：折叠工具行——全部展开 / 全部收起（点击时 groups 已渲染完成） */
	var toolRow = el("div", "mce-row");
	toolRow.appendChild(el("span", "mce-row-lbl", "折叠工具："));
	var bAllOpen = el("button", "", "全部展开"); bAllOpen.type = "button";
	bAllOpen.title = "展开特质管理区全部分类";
	bAllOpen.addEventListener("click", function () {
		Object.keys(groups).forEach(function (k) {
			var g = groups[k];
			g.body.setAttribute("data-collapsed", "0");
			g.head.textContent = "▾ " + k + "（" + g.count + "）" + g.note;
			buildLazyRows(g); /* 懒渲染：全部展开时补建所有行 */
			mbCEUiCollapsed(k, true);
		});
	});
	var bAllClose = el("button", "", "全部收起"); bAllClose.type = "button";
	bAllClose.title = "收起特质管理区全部分类";
	bAllClose.addEventListener("click", function () {
		Object.keys(groups).forEach(function (k) {
			var g = groups[k];
			g.body.setAttribute("data-collapsed", "1");
			g.head.textContent = "▸ " + k + "（" + g.count + "）" + g.note;
			mbCEUiCollapsed(k, false);
		});
	});
	toolRow.appendChild(bAllOpen);
	toolRow.appendChild(bAllClose);
	wrap.appendChild(toolRow);
	/* 系列识别：同变量多档位特质 → 合并为一行（阶段下拉），不再逐条平铺 */
	var seriesGroups = groupTraitSeries(vanilla);
	var seriesKeys = {};
	seriesGroups.forEach(function (s) {
		s.series.forEach(function (item) { seriesKeys[item.t.cat + "\u0001" + String(item.t.name || "")] = true; });
	});
	/* 原版按分类分组渲染（同分类同中文名去重：原版 widget 多段/函数名同语义只显示一行） */
	vanilla.forEach(function (t) {
		if (seriesKeys[t.cat + "\u0001" + String(t.name || "")]) { return; }
		var nameZh = traitDisplayName(t, V);
		if (q && nameZh.toLowerCase().indexOf(q) === -1 && String(t.name || "").toLowerCase().indexOf(q) === -1) { return; }
		var key = t.cat + "\u0001" + nameZh;
		if (seenV[key]) { return; }
		seenV[key] = true;
		var zhCat = TRAIT_ZH_CAT[t.cat] || t.cat;
		var g = bodyFor(isFav(t) ? FAV_CAT : zhCat, isFav(t) ? " · 收藏置顶（点击☆取消）" : "");
		g.count++;
		g.pending.push(function () { renderTraitRow(g.body, t, V, C, false); }); /* 懒渲染：收起组只记账不建行 */
	});
	/* 系列行渲染（放入所属分类组；搜索时按系列名过滤） */
	seriesGroups.forEach(function (s) {
		var seriesName = traitSeriesName(s);
		if (q && seriesName.toLowerCase().indexOf(q) === -1) { return; }
		var zhCat = TRAIT_ZH_CAT[s.cat] || s.cat;
		var g = bodyFor(zhCat, "");
		g.count++;
		g.pending.push(function () { renderTraitSeriesRow(g.body, s, V); }); /* 懒渲染 */
	});
	/* 模组特质分类（按 title 分组，同分类同中文名去重） */
	modTraits.forEach(function (t) {
		var nameZh = traitDisplayName(t, V);
		if (q && nameZh.toLowerCase().indexOf(q) === -1 && t.cat.toLowerCase().indexOf(q) === -1) { return; }
		var key = t.cat + "\u0001" + nameZh;
		if (seenM[key]) { return; }
		seenM[key] = true;
		var zhCat = TRAIT_ZH_CAT[t.cat] ? TRAIT_ZH_CAT[t.cat] + "（模组）" : (t.cat + "（模组）");
		var g = bodyFor(isFav(t) ? FAV_CAT : zhCat, isFav(t) ? " · 收藏置顶（点击☆取消）" : " · 模组注入（自动发现，可直接获取/移除）");
		g.count++;
		g.pending.push(function () { renderTraitRow(g.body, t, V, C, true); }); /* 懒渲染 */
	});
	/* 组标题统一补数量（箭头按当前展开状态：0=展开 ▾，1=收起 ▸；持久化恢复时保持一致性） */
	Object.keys(groups).forEach(function (k) {
		var g = groups[k];
		var open = g.body.getAttribute("data-collapsed") !== "1";
		g.head.textContent = (open ? "▾ " : "▸ ") + k + "（" + g.count + "）" + g.note;
	});
	/* 懒渲染：展开状态的分组初始即建行（收起的组保持空，等点击展开才建）。
	   搜索态（q 非空）下强制所有组展开并建行——否则匹配行落在收起组里不可见（搜索结果丢失）。
	   仅改 DOM 收起标记，不写入持久化折叠状态，搜索结束后恢复默认收起 */
	Object.keys(groups).forEach(function (k) {
		var g = groups[k];
		if (q) {
			g.body.setAttribute("data-collapsed", "0");
			g.head.textContent = "▾ " + k + "（" + g.count + "）" + g.note;
		}
		if (q || g.body.getAttribute("data-collapsed") !== "1") { buildLazyRows(g); }
	});
	/* v1.8.12 二轮优化：折叠状态残留键清理（仅全量渲染时——搜索过滤下未显示分类会被误删） */
	if (!q) {
		var alive = {};
		Object.keys(groups).forEach(function (k) { alive[k] = true; });
		var stale = false;
		Object.keys(mbCEUiState.collapsed).forEach(function (k) {
			if (!alive[k]) { delete mbCEUiState.collapsed[k]; stale = true; }
		});
		if (stale) { mbCEUiSave({ collapsed: mbCEUiState.collapsed }); }
	}
	pane.appendChild(wrap);
}
function renderTraitRow(grp, t, V, C, isMod) {
	var owned = traitOwned(t, V, C);
	var nameZh = traitDisplayName(t, V);
	var row = el("div", "mce-row");
	/* v1.8.12 收藏置顶：☆ 收藏 / ★ 已收藏（数据存 V.mbCE_favTraits，CSS 类渲染兼容无 DOM 环境） */
	var favNow = isFavTrait(t, V);
	var bF = el("button", "mce-favstar" + (favNow ? " mce-fav" : ""), favNow ? "★" : "☆");
	bF.type = "button";
	bF.title = favNow ? "取消收藏（该特质不再置顶）" : "收藏（该特质置顶到「★ 已收藏」组）";
	bF.addEventListener("click", function () {
		var res = toggleFavTrait(t, V);
		actPlayer(res);
	});
	row.appendChild(bF);
	row.appendChild(el("span", "mce-row-lbl", (owned ? "● " : "○ ") + nameZh + (isMod ? "（模组）" : "")));
	/* 描述（函数/模板源码型描述不展示，避免源码泄漏） */
	var desc = isMod ? t.text : String(t.text || "");
	desc = String(desc || "");
	if (/^\s*\(?\s*\)\s*=>/.test(desc) || /^\s*function\b/.test(desc) || (desc.length > 300 && desc.indexOf("`") !== -1)) { desc = ""; }
	if (desc) {
		row.appendChild(el("span", "mce-hint", String(desc).slice(0, 90) + (String(desc).length > 90 ? "…" : "")));
	}
	/* 获取 / 移除：原版与模组注入特质均可（v1.8.11 模组特质不再只读——
	   字符串判定写变量直接获得/移除，函数判定走强制获得标记） */
	var bG = el("button", "", owned ? "移除" : "获取");
	bG.type = "button";
	bG.addEventListener("click", function () {
		var res;
		if (owned) {
			var w = revokeTrait(t, V, C);
			res = { ok: w.length > 0, message: w.length ? "已移除「" + nameZh + "」：" + w.join("、") : "该特质无可移除的条件变量" };
		} else {
			var w2 = grantTrait(t, V, C);
			res = { ok: w2.length > 0, message: w2.length ? "已获取「" + nameZh + "」：" + w2.join("、") : "该特质无可写条件（只读展示）" };
		}
		actPlayer(res);
	});
	row.appendChild(bG);
	/* 数值可改（数字比较变量）：写入走 player-self 留痕通道 + 回退
	   （原版与模组注入特质均可用——discoverModTraits 已为模组特质生成 values 清单） */
	t.values.forEach(function (v) {
		var cur = safeGetObj(V, v.path);
		var num = (typeof cur === "number") ? cur : 0;
		var inp = el("input", "mce-inp");
		inp.type = "text"; inp.inputmode = "decimal"; inp.value = String(num);
		inp.placeholder = "+N / -N 相对";
		inp.title = "支持相对调整：+100 / -20；直接输入数字为绝对值";
		var bS = el("button", "", "改数值"); bS.type = "button";
		bS.addEventListener("click", function () {
			var res = traitWriteValue(t, V, v.path, inp.value);
			actPlayer(res);
		});
		var bU = el("button", "", "回退"); bU.type = "button";
		bU.addEventListener("click", function () {
			var res = undoCheatModValue("player-self", "trait:" + v.path);
			actPlayer(res);
		});
		row.appendChild(inp); row.appendChild(bS); row.appendChild(bU);
	});
	grp.appendChild(row);
}
/* v1.8.12 特质收藏（数据层）：V.mbCE_favTraits 数组，key=cat\u0001name，收藏项渲染置顶 */
function favTraitKey(t) {
	return String(t && (t.cat || t.kind || "")) + "\u0001" + String(t && (t.name || ""));
}
function getFavTraits(V) {
	try {
		var v = V || getV();
		if (v && Array.isArray(v.mbCE_favTraits)) { return v.mbCE_favTraits; }
	} catch (e) {}
	return [];
}
function isFavTrait(t, V) {
	try { return getFavTraits(V).indexOf(favTraitKey(t)) !== -1; } catch (e) { return false; }
}
function toggleFavTrait(t, V) {
	try {
		var v = V || getV();
		if (!v) { return { ok: false, message: "存档变量不可用" }; }
		if (!Array.isArray(v.mbCE_favTraits)) { v.mbCE_favTraits = []; }
		var k = favTraitKey(t);
		var idx = v.mbCE_favTraits.indexOf(k);
		if (idx !== -1) { v.mbCE_favTraits.splice(idx, 1); return { ok: true, fav: false, message: "已取消收藏" }; }
		v.mbCE_favTraits.push(k);
		return { ok: true, fav: true, message: "已收藏（置顶显示）" };
	} catch (e) { return { ok: false, message: "操作异常：" + (e && e.message ? e.message : e) }; }
}

function traitWriteValue(t, V, path, raw) {
	var num = parseFloat(raw);
	if (isNaN(num)) { return { ok: false, message: "请输入数字（当前值 " + (safeGetObj(V, path) === undefined ? "?" : safeGetObj(V, path)) + "）" }; }
	var before = safeGetObj(V, path);
	/* v1.8.12：保留原始字符串传给 cheatWriteValue，使 +N / -N 相对语法生效（parseFloat 仅作合法性校验） */
	var res = cheatWriteValue("player-self", "trait:" + path, "value_set", path, raw, "number");
	if (!res || !res.ok) { return { ok: false, message: "写入失败：" + (res && res.message ? res.message : "未知错误") }; }
	var after = safeGetObj(V, path);
	return { ok: true, message: "「" + traitDisplayName(t, V) + "」数值 " + path + "：" + (before === undefined ? "?" : before) + " → " + after + "（可回退）" };
}
/* 兼容导出（v1.7.x 老 API 保留，UI 已迁移至特质管理）：模组属性判定（数据层） */
function isModOnlyRoot(k) {
	if (!k) { return false; }
	if (k.indexOf("mbCE_") === 0) { return false; }
	if (ORIGINAL_V_ROOT_KEYS.indexOf(k) !== -1) { return false; }
	if (CHEAT_VANILLA_ROOTS.indexOf(k) !== -1) { return false; }
	return true;
}
function renderPlayerEdit() {
	/* 十巡：渲染时从持久化状态恢复搜索词（搜索框 input 事件已写入 mbCEUiState.filter；
	   此前只写不读，刷新/重开面板后搜索词丢失） */
	curPlayerFilter = (typeof mbCEUiState !== "undefined" && mbCEUiState && mbCEUiState.filter) ? String(mbCEUiState.filter) : "";
	var pane = root.querySelector('[data-pane="mods"]');
	if (!pane) { return; }
	var st = pane.scrollTop; /* 五巡：重建后保持滚动位置（快速面板/特质区长列表操作不跳顶） */
	pane.textContent = "";
	var back = el("button", "", "← 返回模组列表");
	back.type = "button";
	back.addEventListener("click", function () { renderModCheats(); });
	pane.appendChild(back);
	pane.appendChild(el("div", "mce-hint", "【玩家自己 · 属性与特质】游戏属性面板数值快捷编辑 + 全部特质管理（含其他模组注入的特质，自动发现）。中文键名仅用于显示，写入仍用原键名。"));
	var frow = el("div", "mce-row");
	frow.appendChild(el("span", "mce-row-lbl", "关键词过滤："));
	var finp = el("input", "mce-inp");
	finp.type = "text";
	finp.value = curPlayerFilter || "";
	finp.addEventListener("input", function () {
		curPlayerFilter = finp.value;
		mbCEUiSave({ filter: finp.value });
		/* v1.8.12 功能13：搜索输入 250ms 防抖，避免逐键全量重建特质区 */
		mceSchedule(renderPlayerEdit, 250, "search");
	});
	frow.appendChild(finp);
	pane.appendChild(frow);
	var qwrap = el("div", "mce-grp");
	qwrap.appendChild(el("div", "mce-grp-t", "★ 游戏属性面板（颜色分级）快捷编辑：直接改面板显示的核心属性/技能/性技能/成绩/武器"));
	renderQuickPanel(qwrap);
	pane.appendChild(qwrap);
	var V = getV();
	if (!V) { pane.appendChild(el("div", "mce-err", "存档变量不可用。")); return; }
	var C = null;
	try { if (typeof C !== "undefined" && C) { C = window.C || C; } } catch (e) {}
	renderTraitsSection(pane, V, C);
	pane.scrollTop = st; /* 五巡：恢复滚动位置 */
}


