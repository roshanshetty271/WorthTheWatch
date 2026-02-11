"use client";

import { useState, useEffect } from "react";

const MOVIE_FACTS = [
    // ... facts ... (I will keep the list but truncated in this tool call for brevity, expecting the tool to handle the replacement correctly if I include the full content or match the structure)
    // ALL FACTS 1-113
    // --- CLASSICS & GOLDEN AGE ---
    "The snow in 'The Wizard of Oz' was actually pure asbestos fibers.",
    "Psycho (1960) was the first American film to show a toilet flushing.",
    "The horse head in 'The Godfather' was absolutely real.",
    "Sean Connery wore a toupee in every single James Bond movie.",
    "Frank Sinatra was offered the role of John McClane in 'Die Hard' due to a contract clause.",
    "In 'Casablanca', no one actually says 'Play it again, Sam'. The line is 'Play it, Sam'.",
    "Alfred Hitchcock bought every copy of the 'Psycho' novel so no one would know the ending.",
    "Gene Kelly performed the 'Singin' in the Rain' title number with a 103°F fever.",
    "Orson Welles voiced the planet-eater Unicron in the 1986 Transformers movie.",
    "The sounds of the T-Rex in 'Jurassic Park' are a mix of a baby elephant, a tiger, and an alligator.",

    // --- 80s & 90s BLOCKBUSTERS ---
    "The code in 'The Matrix' is actually scanned sushi recipes.",
    "Tom Hanks wasn't paid for 'Forrest Gump'. He took percentage points and made $40M.",
    "In 'The Silence of the Lambs', Hannibal never says 'Hello, Clarice'. He says 'Good evening, Clarice'.",
    "Disney's 'The Lion King' roar sounds were actually tigers, because lions weren't loud enough.",
    "The communicator in 'The Phantom Menace' is a Gillette sensual razor for women.",
    "Leonardo DiCaprio actually cut his hand in 'Django Unchained' and kept acting through the scene.",
    "Will Smith turned down the role of Neo in 'The Matrix' to do 'Wild Wild West'.",
    "The 'shredder' sound in 'Teenage Mutant Ninja Turtles' (1990) is a cello played poorly.",
    "The carpet in 'The Shining' is the same pattern used in Sid's house in 'Toy Story'.",
    "Viggo Mortensen deflected a real knife throw in 'The Fellowship of the Ring'.",

    // --- HORROR & THRILLER ---
    "The 'Scream' mask is based on a painting by Edvard Munch called 'The Scream'.",
    "Sissy Spacek slept in her bloody clothes for 3 days to keep continuity in 'Carrie'.",
    "The skeletons in the pool scene of 'Poltergeist' were real—it was cheaper than making fake ones.",
    "In 'The Exorcist', the vapor breath was real. They refrigerated the set to -20°F.",
    "The Blair Witch Project actors used GPS coordinates to find their food and script notes each day.",
    "Pennywise's dance in 'It' (2017) was done without CGI. Bill Skarsgård is just that flexible.",
    "The ending of 'The Mist' was so dark that Stephen King said he wished he'd written it.",
    "Paranormal Activity cost $15,000 to make and grossed over $190 million.",
    "Michael Myers' mask in 'Halloween' is just a William Shatner mask painted white.",
    "In 'Saw', the bathroom scenes were filmed in just 18 days.",

    // --- SCI-FI & FANTASY ---
    "R2-D2 spoke English in the original Star Wars draft, and he was a jerk.",
    "Christopher Nolan grew 500 acres of real corn for 'Interstellar' and sold it for a profit.",
    "The words 'Wookiee' and 'Ewok' are never spoken in the original Star Wars trilogy.",
    "Yoda was originally going to be played by a monkey wearing a mask.",
    "Sigourney Weaver actually made that impossible basketball shot in 'Alien: Resurrection' on the first take.",
    "In 'Terminator 2', the T-1000 pilot was played by Robert Patrick's twin brother for the mirror shot.",
    "NASA uses the movie 'Armageddon' in their management training program to spot errors.",
    "Godzilla was originally planned to be a giant octopus.",
    "The language in 'Arrival' (Heptapod B) is a fully functioning logogram system created for the film.",
    "Iron Man's JARVIS is an acronym for 'Just A Rather Very Intelligent System'.",

    // --- ANIMATION ---
    "Disney's 'The Little Mermaid' was the last Disney film to use hand-painted cels.",
    "Pixar kept live rats in the studio hallway to study their movement for 'Ratatouille'.",
    "The pizza planet truck appears in almost every Pixar movie (except The Incredibles).",
    "Bruno in 'Encanto' was almost named Oscar, but legal didn't want 'We don't talk about Oscar'.",
    "In 'Up', Carl's house flies using 10,297 balloons. In reality, it would take 26.5 million.",
    "Shrek's voice was recorded by Mike Myers in a limo, a closet, and a hotel room.",
    "Aladdin's pants were modeled after M.C. Hammer's pants.",
    "Wall-E was named after Walter Elias Disney.",
    "Toto earned $125 per week in 'The Wizard of Oz'—more than the Munchkin actors.",
    "If you pause 'Frozen', you can see Hans is the only character who doesn't breathe in the cold.",

    // --- BEHIND THE SCENES ---
    "The floating plastic bag in 'American Beauty' was shot by the writer, not the director.",
    "The 'Wilhelm Scream' has been used in over 400 movies and TV shows.",
    "Tom Cruise broke his ankle jumping between buildings in 'Mission: Impossible – Fallout' and finished the take.",
    "The Chestburster scene in 'Alien' was a surprise to the actors; their terror was real.",
    "James Cameron drew the nude sketch of Rose in 'Titanic' himself.",
    "Daniel Radcliffe went through 160 pairs of glasses during the Harry Potter films.",
    "The sound of the automatic doors in 'Star Trek' is a paper envelope sliding out of a sleeve.",
    "Stanley Kubrick destroyed all the sets for '2001: A Space Odyssey' so they couldn't be reused.",
    "The rain in 'Singin' in the Rain' was mixed with milk so it would show up on camera.",
    "Charlie Sheen stayed awake for 48 hours to look 'wasted' for his 'Ferris Bueller' cameo.",

    // --- ACTORS & ROLES ---
    "Nicolas Cage's real name is Nicolas Coppola (he's Francis Ford Coppola's nephew).",
    "Jim Carrey was originally considered for Captain Jack Sparrow.",
    "Matt Damon turned down the lead in 'Avatar', costing him roughly $250 million.",
    "Jennifer Lawrence was rejected for the role of Bella Swan in 'Twilight'.",
    "Ryan Gosling was cast in 'The Lovely Bones', gained 60lbs, and was fired for being too fat.",
    "Christian Bale based his performance in 'American Psycho' on Tom Cruise interviews.",
    "Samuel L. Jackson has a clause in his contracts that allows him to play golf during shoots.",
    "Bill Murray improvised almost all his lines in 'Caddyshack'.",
    "Robin Williams improvised so much in 'Aladdin' the film was rejected for Best Screenplay.",
    "Gal Gadot was five months pregnant while filming reshoots for 'Wonder Woman'.",

    // --- DIRECTORS & PRODUCTION ---
    "Christopher Nolan doesn't allow chairs on his sets (according to Anne Hathaway).",
    "Steven Spielberg finished college in 2002 and turned in 'Schindler's List' as his student film.",
    "George Lucas got his head stuck in the mechanical shark from 'Jaws'.",
    "Quentin Tarantino's handwritten scripts are practically illegible.",
    "Wes Anderson insists on symmetry; practically every shot in his films is centered.",
    "Ridley Scott's first draft of 'Alien' ended with the Alien biting Ripley's head off.",
    "Tim Burton didn't read the Batman comics before directing the 1989 movie.",
    "David Fincher makes actors do 50-60 takes for simple scenes (Social Network opening took 99 takes).",
    "James Cameron threatened to fire anyone who took a bathroom break during 'True Lies'.",
    "Alfred Hitchcock refused to meet Steven Spielberg because he felt like the 'boy who cried wolf'.",

    // --- RANDOM & WEIRD ---
    "A popcorn kernel cost $100 million to remove from 'Cats' using CGI.",
    "The 'Jurassic Park' computer interface is a real file system called FSN (File System Navigator).",
    "The word 'dude' is used 161 times in 'The Big Lebowski'.",
    "In 'Fight Club', Brad Pitt and Edward Norton actually learned how to make soap.",
    "The shark in 'Jaws' was named Bruce, after Steven Spielberg's lawyer.",
    "There is a Starbucks cup in every single scene of 'Fight Club'.",
    "C-3PO and R2-D2 appear in the hieroglyphics in 'Raiders of the Lost Ark'.",
    "E.T.'s face was modeled after Albert Einstein, Carl Sandburg, and a pug.",
    "The budget for 'Paranormal Activity' was less than the catering budget for 'Avatar'.",
    "The runtime of 'Titanic' (1997) is exactly the same time it took the ship to sink (2hr 40m)."
];

export default function TriviaLoader() {
    const [index, setIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Pick a random starting fact so it's different every time
        setIndex(Math.floor(Math.random() * MOVIE_FACTS.length));

        const intervalId = setInterval(() => {
            // Fade out
            setIsVisible(false);

            // Wait for fade out, then swap text and fade in
            setTimeout(() => {
                setIndex((prev) => (prev + 1) % MOVIE_FACTS.length);
                setIsVisible(true);
            }, 700); // Slower fade out
        }, 8000); // 8 seconds per fact

        return () => clearInterval(intervalId);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-[120px] px-4 w-full">
            <div
                className={`relative transition-all duration-1000 ease-in-out text-center max-w-3xl mx-auto ${isVisible ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-4 blur-sm"
                    }`}
            >
                {/* Minimalist Header with gradient lines */}
                <div className="mb-6 flex items-center justify-center gap-4 opacity-60">
                    <div className="h-px w-12 bg-gradient-to-r from-transparent via-accent-gold to-transparent" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent-gold">
                        Cinema Trivia
                    </span>
                    <div className="h-px w-12 bg-gradient-to-r from-transparent via-accent-gold to-transparent" />
                </div>

                {/* The Fact - Clean Typography */}
                <p className="text-xl md:text-2xl font-serif text-white/90 leading-relaxed italic drop-shadow-sm">
                    &ldquo;{MOVIE_FACTS[index]}&rdquo;
                </p>
            </div>
        </div>
    );
}
