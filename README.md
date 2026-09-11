# Parallax Avatar Project

Prototype for a glasses-free depth illusion with a real-time 3D avatar.

The target concept combines:

- head or eye-position tracking;
- a calibrated physical display plane;
- head-coupled, off-axis projection;
- a real-time avatar in Unreal Engine;
- later: speech-to-text, an LLM, text-to-speech, lip sync and gaze control.

## Repository layout

- `docs/` — architecture and analysis notes for the new project.
- `reference/TheParallaxView/` — original Unity/iOS reference project by
  ALGOMYSTIC AB / Peder Norrby.
- `avatar/` — reserved for the future Unreal Engine prototype.

The reference repository is kept separate so that its history and upstream
remote remain intact. Its software code is MIT-licensed. The included art
assets have separate non-commercial restrictions and should not be reused in a
commercial prototype.

## Proposed first milestone

Render a simple calibration room and placeholder head on a normal monitor.
A webcam-based tracker supplies one estimated eye position. Moving the user's
head must change the off-axis view so that the monitor behaves like a window
into the virtual room.

MetaHuman, voice and AI integration should follow only after projection,
tracking stability and latency have been validated.

See [docs/the-parallax-view-analysis.md](docs/the-parallax-view-analysis.md)
and [docs/architecture.md](docs/architecture.md).
