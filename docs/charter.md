# Project charter

## Purpose

Give students and teachers dependable music practice tools regardless of their ability to pay or install software. tUno is a personal project and community service, with a deliberately manageable scope shaped by everyday teaching and practice needs.

## People and workflows

- A student opens a tuner, sees understandable pitch feedback, and practices with a reference tone or metronome.
- A band director projects readable controls and feedback during rehearsal.
- A teacher moves through student check-ins with stable-pitch evaluation, feedback, and optional automatic advancement. This workflow should remain optional, without requiring rosters for ordinary practice.

## Commitments

- Core practice tools are free to users, with no subscription, account, or paid activation required.
- Microphone processing stays on the device. Core practice does not depend on a remote service.
- Offline operation is a product requirement. Maintain both a hosted, downloadable app and an offline-only portable HTML release; verify both on real devices.
- Prioritize inexpensive school hardware, readable feedback, keyboard access, and reduced-motion support.
- Aim for open-source, independently hostable releases with intentional dependencies and redistributable assets.
- Keep maintenance sustainable. Add features when they support a concrete musical workflow and can be tested.
- Student records, if introduced, remain optional and local, with explicit backup and restore.

## Identity

The name is **tUno**, honoring Uno, the founder's departed dog. The capital U becomes a tuning fork in the visual identity. Preserve the ordinary text spelling in accessible labels, documentation, and search. Logo artwork is a later design task.

## Initial scope

- A single-note tuner with reference calibration and concert/written pitch.
- A metronome with adjustable BPM, tap tempo, meter selection, audible accents, and visual beat identification that clearly shows the current beat and downbeat.
- Common subdivisions: undivided beats, eighth notes, triplets, and sixteenth notes in simple meter; clear dotted-quarter beat grouping and eighth-note pulses in compound meters such as 6/8.
- Sustained reference tones with independent volume control.

These tools should work together in a readable practice surface. Label the tempo beat unit explicitly so meter and subdivision changes are musically understandable. Visual beat identification must remain understandable without relying on color alone.

Teacher check-ins are an important follow-on workflow and an architectural consideration from the start. Full roster migration, recording, realistic instrument libraries, ensemble pitch separation, cloud accounts, and cross-device synchronization are outside the first prototype.

## Open decisions

- Choose a source license, review upstream provenance, and document asset attribution.
- Establish the minimum supported device/browser versions and practical pitch range from testing.

## Success

A student can start practicing without paying or creating an account; a teacher can use the tools reliably on actual school hardware; a cached or downloaded supported release works without a network. Project continuation should not depend on one person's proprietary service account.
