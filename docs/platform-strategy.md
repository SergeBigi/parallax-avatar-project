# Platform strategy

## Phase 1: Windows 11 proof of concept

The initial proof of concept runs in a current browser on a Windows 11 laptop.
Three.js owns rendering and the off-axis projection. MediaPipe processes the
integrated webcam and supplies a single-viewer eye-position estimate. The first
implementation remains fully usable in a mouse simulation mode and without
MetaHuman, cloud speech services or special display hardware.

Initial development environment:

- Microsoft Edge or Google Chrome;
- Node.js 20.19 or newer for the local development server;
- Git;
- a webcam capable of stable 30 fps capture;
- a normal laptop display or an external monitor.

The first performance budget is 60 rendered frames per second and 20–30
tracking updates per second. Tracking, filtering and rendering latency must be
measured separately before adding the production avatar and conversation
pipeline. Unreal Engine, Visual Studio and Git LFS are introduced only if the
high-fidelity rendering path is selected after the browser PoC.

## Phase 2: portable target evaluation

The portable target is deliberately not selected yet. Two technically
different deployment paths must be evaluated after the Windows geometry and
tracking have been validated.

### Native tablet application

A native Android or iPadOS build can keep tracking, projection and rendering on
the device. This is the closest match to the original TheParallaxView concept.
The target device must expose its front camera to the application and sustain
the required face tracking and rendering rate. A lightweight avatar or lower
rendering quality may be required instead of the desktop MetaHuman setup.

### Smart-display thin client

An Echo Show must be treated as a separate feasibility case, not as a normal
Android tablet. The likely architecture is a thin display client receiving a
rendered stream from another device. The concept is only viable if the target
model and application surface provide sufficiently low-latency access to a
viewer position. Without camera/head-pose access, head-coupled parallax cannot
be implemented correctly on the Echo Show itself.

## Portability rules

- Keep tracking behind an `IHeadTracker`-style interface.
- Keep the projection kernel independent of camera SDKs, avatar assets and UI.
- Express calibration data in metres in a display-centred coordinate system.
- Do not place API keys or device-specific secrets in project assets.
- Separate high-fidelity desktop avatar assets from a mobile asset profile.
- Prefer C++ and text configuration for core behavior; use binary Blueprint
  assets for scene wiring and presentation only.
- Keep the conversation backend independent from the render client so that it
  can run locally, on another computer or as a service.

## Platform decision gate

Select the portable target only after Stage 2 of the architecture roadmap.
Measure the following on candidate devices:

1. front-camera/head-tracking access;
2. X/Y/Z tracking stability and latency;
3. sustained rendering frame rate and thermal behavior;
4. avatar quality at the available GPU and memory budget;
5. audio round-trip latency;
6. deployment and application-distribution restrictions.
