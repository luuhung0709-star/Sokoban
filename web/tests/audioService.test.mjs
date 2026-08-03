import test from 'node:test';
import assert from 'node:assert/strict';

/** Stands in for the browser's Audio element. Records what was asked of it. */
class FakeAudio {
  static made = [];

  constructor(src) {
    this.src = src;
    this.loop = false;
    this.volume = 1;
    this.preload = '';
    this.plays = 0;
    this.pauses = 0;
    FakeAudio.made.push(this);
  }

  play() { this.plays++; return Promise.resolve(); }
  pause() { this.pauses++; }
  cloneNode() { return new FakeAudio(this.src); }
}

globalThis.Audio = FakeAudio;

const { AudioService } = await import('../src/audio/audioService.js');

/** A stand-in for ProgressStore holding just the two switches. */
const fakeProgress = () => ({ musicOn: true, sfxOn: true });

function setup() {
  FakeAudio.made = [];
  const progress = fakeProgress();
  const audio = new AudioService(progress);
  // The music loop is the last one the constructor builds.
  const music = FakeAudio.made.at(-1);
  return { audio, progress, music };
}

test('unlock starts the music when it is switched on', () => {
  const { audio, music } = setup();

  audio.unlock();

  assert.equal(music.plays, 1);
});

test('unlock stays silent when the music is switched off', () => {
  const { audio, progress, music } = setup();
  progress.musicOn = false;

  audio.unlock();

  assert.equal(music.plays, 0);
});

test('switching the music off pauses the loop, on resumes it', () => {
  const { audio, music } = setup();
  audio.unlock();

  audio.musicOn = false;
  assert.equal(music.pauses, 1);

  audio.musicOn = true;
  assert.equal(music.plays, 2);
});

test('the two switches are independent — no music, still footsteps', () => {
  const { audio, music } = setup();
  audio.unlock();
  audio.musicOn = false;

  const before = FakeAudio.made.length;
  audio.play('step');

  assert.equal(music.pauses, 1, 'the music really did stop');
  assert.equal(FakeAudio.made.length, before + 1, 'and a step clip was still cloned and played');
});

test('switching effects off silences play but leaves the music alone', () => {
  const { audio, music } = setup();
  audio.unlock();

  audio.sfxOn = false;
  const before = FakeAudio.made.length;
  audio.play('step');

  assert.equal(FakeAudio.made.length, before, 'no clip should have been made');
  assert.equal(music.pauses, 0, 'the music switch was not touched');
});

test('the switches are written straight through to progress', () => {
  const { audio, progress } = setup();

  audio.musicOn = false;
  audio.sfxOn = false;

  assert.equal(progress.musicOn, false);
  assert.equal(progress.sfxOn, false);
});
