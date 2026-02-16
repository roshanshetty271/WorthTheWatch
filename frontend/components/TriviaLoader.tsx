"use client";

import { useState, useEffect } from "react";

const MOVIE_FACTS = [
    // ─── MIND-BLOWING ────────────────────────────────────
    "The Matrix code is actually sushi recipes scanned from a cookbook.",
    "The horse head in The Godfather was 100% real. The prop department got it from a dog food factory.",
    "Michael Myers' mask in Halloween is just a $2 William Shatner mask painted white.",
    "Paranormal Activity cost $15,000 to make and grossed $193 million.",
    "Christopher Nolan grew 500 acres of real corn for Interstellar — then sold it for a profit.",
    "Tom Hanks wasn't paid for Forrest Gump. He took profit points instead and made $40 million.",
    "The carpet in The Shining is the same pattern used in Sid's house in Toy Story.",
    "Titanic's runtime (2hr 40min) is the exact time it took the real ship to sink.",
    "NASA uses Armageddon in their training program — to spot scientific errors. They found 168.",
    "The budget for Paranormal Activity was less than the catering budget for a single day on Avatar.",

    // ─── ACTORS BEING INSANE ─────────────────────────────
    "Leonardo DiCaprio actually cut his hand in Django Unchained and kept acting. That blood is real.",
    "Viggo Mortensen broke two toes kicking the helmet in Lord of the Rings. That scream is genuine pain.",
    "Jim Carrey was 100% in character as Andy Kaufman for 4 months straight during Man on the Moon. Nobody could stand him.",
    "Christian Bale based his American Psycho performance entirely on Tom Cruise interviews.",
    "Tom Cruise broke his ankle jumping between buildings in Mission: Impossible Fallout — and finished the take.",
    "Daniel Radcliffe destroyed 160 pairs of glasses during the Harry Potter films.",
    "Gal Gadot was five months pregnant while filming reshoots for Wonder Woman.",
    "Robin Williams improvised so much in Aladdin that the film was disqualified for Best Adapted Screenplay.",
    "Gene Kelly performed the Singin' in the Rain title number with a 103°F fever.",
    "Ryan Gosling got cast in The Notebook because the director wanted someone 'not handsome.'",

    // ─── BEHIND THE SCENES CHAOS ─────────────────────────
    "The chestburster scene in Alien was a surprise to the actors. Their horror was completely real.",
    "James Cameron drew the nude sketch of Rose in Titanic himself. He's left-handed, so the scene was flipped.",
    "David Fincher made the actors do 99 takes for the opening scene of The Social Network.",
    "Christopher Nolan doesn't allow chairs on his sets. Anne Hathaway confirmed it.",
    "The skeletons in Poltergeist's pool scene were real human skeletons. They were cheaper than plastic ones.",
    "Kubrick made Shelley Duvall redo the baseball bat scene in The Shining 127 times. She was genuinely breaking down.",
    "The Blair Witch Project actors were actually starved and sleep-deprived. Their frustration was real.",
    "Charlie Sheen stayed awake for 48 hours to look wasted for his 5-second cameo in Ferris Bueller's Day Off.",
    "Steven Spielberg finished his college degree in 2002 — and submitted Schindler's List as his student film.",
    "Alfred Hitchcock bought every copy of the Psycho novel so no one would know the twist ending.",

    // ─── MONEY & BOX OFFICE ──────────────────────────────
    "Will Smith turned down Neo in The Matrix to do Wild Wild West. He calls it his biggest regret.",
    "Matt Damon turned down Avatar. He would have made $250 million.",
    "The Lion King (1994) was considered Disney's 'B team' project. Everyone wanted to work on Pocahontas instead.",
    "Toto the dog earned $125/week in The Wizard of Oz — more than each Munchkin actor.",
    "Samuel L. Jackson has a contract clause that lets him play golf during any film shoot.",
    "The Shawshank Redemption flopped at the box office but became the #1 rated movie on IMDb through DVD rentals.",
    "Disney almost went bankrupt making Snow White. Hollywood called it 'Disney's Folly.'",
    "John Travolta turned down the role of Forrest Gump. Twice.",
    "OJ Simpson was almost cast as the Terminator but Cameron thought he was 'too nice' to play a killer.",
    "Sean Connery wore a toupee in every single James Bond movie.",

    // ─── TV SHOWS ────────────────────────────────────────
    "Bryan Cranston actually learned to cook meth-grade crystals for Breaking Bad. The DEA supervised.",
    "The Walking Dead's zombie extras had to attend 'zombie school' to learn how to move properly.",
    "Friends almost got cancelled after Season 1. NBC gave it one more shot and it ran for 10 years.",
    "The Office's Steve Carell was told the show was cancelled, so he left. Then NBC renewed it anyway.",
    "Game of Thrones' Battle of the Bastards used 500 extras, 70 horses, and took 25 days to film.",
    "Stranger Things' Eleven originally died at the end of Season 1. Fan reaction changed it.",
    "The Sopranos' ending was so controversial that HBO's switchboard crashed from angry callers.",
    "Bob Odenkirk had a heart attack on set of Better Call Saul and was technically dead for 18 minutes.",
    "Squid Game was rejected by every studio for 10 years before Netflix picked it up. It became their biggest show ever.",
    "The entire first season of True Detective was shot in chronological order, which is almost unheard of.",

    // ─── ANIMATION SECRETS ───────────────────────────────
    "Pixar kept live rats in their studio hallways to study their movement for Ratatouille.",
    "Encanto's Bruno was almost named Oscar, but Disney legal vetoed it — they didn't want 'We Don't Talk About Oscar.'",
    "In reality, it would take 26.5 million balloons to lift Carl's house in Up. The movie used 10,297.",
    "The Pizza Planet truck appears in almost every single Pixar movie.",
    "Wall-E was named after Walt Elias Disney (his full name).",
    "Frozen's 'Let It Go' was so good it made Disney rewrite the entire movie to make Elsa the hero instead of the villain.",
    "Shrek was originally voiced by Chris Farley. He recorded 80-90% of the dialogue before he passed away.",
    "The Lion King's 'Be Prepared' was Scar's only villain song because Jeremy Irons blew out his voice recording it.",
    "Toy Story was almost cancelled. Disney hated the first cut so much they called it 'unwatchable.'",
    "Aladdin's pants were modeled after MC Hammer's parachute pants.",

    // ─── SOUND & MUSIC ───────────────────────────────────
    "The T-Rex roar in Jurassic Park is a baby elephant mixed with a tiger and an alligator.",
    "The Wilhelm Scream sound effect has been used in over 400 movies and TV shows since 1951.",
    "The lightsaber sound in Star Wars is a TV set humming combined with a film projector motor.",
    "The automatic doors on Star Trek make their sound from a paper envelope being pulled from a sleeve.",
    "Hans Zimmer composed Interstellar's score without knowing the movie's plot. Nolan only told him it was about 'a father's love.'",
    "The Inception 'BWAAAAM' sound is actually a slowed-down Edith Piaf song from the movie itself.",
    "Jaws almost had no score. Spielberg laughed when John Williams first played the two-note theme.",
    "Disney's The Lion King roar sounds are actually tigers — real lion roars weren't dramatic enough.",
    "The rain in Singin' in the Rain was mixed with milk so it would show up on black-and-white camera.",
    "R2-D2 spoke fluent English in the original Star Wars script. And he was a jerk.",
];

export default function TriviaLoader() {
    const [index, setIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Pick a random starting fact
        setIndex(Math.floor(Math.random() * MOVIE_FACTS.length));

        const intervalId = setInterval(() => {
            setIsVisible(false);

            setTimeout(() => {
                setIndex((prev) => (prev + 1) % MOVIE_FACTS.length);
                setIsVisible(true);
            }, 600);
        }, 7000); // 7 seconds per fact

        return () => clearInterval(intervalId);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-[80px] px-4 w-full">
            <div
                className={`relative transition-all duration-700 ease-in-out text-center max-w-lg mx-auto ${isVisible
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-3"
                    }`}
            >
                {/* Header */}
                <div className="mb-3 flex items-center justify-center gap-3 opacity-50">
                    <div className="h-px w-8 bg-gradient-to-r from-transparent to-accent-gold/50" />
                    <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-accent-gold">
                        Did You Know?
                    </span>
                    <div className="h-px w-8 bg-gradient-to-l from-transparent to-accent-gold/50" />
                </div>

                {/* The Fact */}
                <p className="text-sm md:text-base text-white/70 leading-relaxed">
                    {MOVIE_FACTS[index]}
                </p>
            </div>
        </div>
    );
}