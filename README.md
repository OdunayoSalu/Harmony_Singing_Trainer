# Harmony Singing Trainer

A mobile-friendly web app to practice singing diatonic intervals within a random major key. Built for Chrome on iPhone. Uses Smplr for piano samples and the Web Audio API for mic-based pitch feedback.

## Features
- Settings page with multi-select intervals, directions, degrees, question count, auto-proceed, tempos, and show-question-degree toggle.
- Game page with Start Playing (requests mic + calibration), replay calibration/question, new/restart/stop set, next question, and collapsible inline settings.
- Tuner-style pitch feedback: needle shows cents flat/sharp relative to the target. Octave-equivalent acceptance.
- Key calibration: I–IV–V–I chords at chord tempo, then the major scale at scale tempo.
- Uses Smplr `SplendidGrandPiano` instrument streamed from CDN.

## Development
This is a static site. Use any static server and open `index.html`:

- VS Code Live Server
- Python: `python -m http.server`
- Node: `npx http-server`

Then open on your iPhone via your LAN URL in Chrome.

## Assets
Place a file named `Correct.mp3` in `Assets/Correct.mp3` to play a congratulation sound when non–auto-proceed. If missing, a short beep fallback is used.

## Notes for iOS
- Audio context must resume on user gesture (press Start Playing)
- Mic permissions are requested at Start Playing. Deny/allow in the browser prompt.
- For the best pitch detection, try to sing in a quiet room and keep the phone mic unobstructed.

## Credits
- [Smplr](https://github.com/danigb/smplr) – sampled instruments for the Web Audio API.
