// How It Works tab for a design without starter steps (Bold & Sporty):
// the section is on only while copy.howSteps holds a step, "Add" saves the
// business type's suggested steps (no claims) for the owner to edit, and the
// help never speaks of starter steps there.
import { describe, it, expect } from 'vitest';
import { howItWorksSteps } from '../templates/kit/howItWorks.js';
import { defaultHowSteps } from '../../../lib/templateFallbacks.js';
import { howStepsStarters } from '../editorCapabilities.js';
import { howStepsOn, howStepsStart, HOW_STEPS_HELP, howStepKey, howStepRemoveImages, howStepWithoutImages } from './howStepsEdit.js';
import { howStepPhotos, HOW_STEP_IMAGE_KEY } from '../templates/kit/howItWorks.js';

describe('howStepsEdit', () => {
  it('is on exactly when the kit band is', () => {
    for (const v of [undefined, null, '', 'x', 3, {}, []]) {
      expect(howStepsOn({ howSteps: v })).toBe(false);
      expect(howItWorksSteps(v)).toBeNull();
    }
    expect(howStepsOn({ howSteps: [{}] })).toBe(true);
    expect(howItWorksSteps([{}])).not.toBeNull();
    expect(howStepsOn(null)).toBe(false);
  });

  it('starts from the business type\'s suggested steps, fresh copies the band shows', () => {
    const steps = howStepsStart('mobile_detailing');
    expect(steps).toEqual(defaultHowSteps('mobile_detailing'));
    steps[0].title = 'Changed';
    expect(howStepsStart('mobile_detailing')[0].title).not.toBe('Changed');
    expect(howItWorksSteps(howStepsStart('detailing_shop')).steps.length).toBeGreaterThan(0);
  });

  it('never speaks of starter steps, and only Bold & Sporty uses it', () => {
    for (const text of Object.values(HOW_STEPS_HELP)) expect(text).not.toMatch(/starter/i);
    expect(howStepsStarters('detailing_sporty')).toBe(false);
    for (const id of ['mobile_sudsy', 'carwash_bubble', 'tint_obsidian', 'unknown']) expect(howStepsStarters(id)).toBe(true);
  });
});

describe('How It Works step photos (images.howStep<i>)', () => {
  const url = (n) => `https://example.test/s${n}.jpg`;

  it('keys a photo by the step\'s place in copy.howSteps', () => {
    expect(howStepKey(0)).toBe('howStep0');
    expect(HOW_STEP_IMAGE_KEY.test('howStep12')).toBe(true);
    expect(HOW_STEP_IMAGE_KEY.test('howStep')).toBe(false);
    expect(HOW_STEP_IMAGE_KEY.test('gallery0')).toBe(false);
  });

  it('lines photos up with the steps the page shows, a blank step in between moving none', () => {
    const steps = [{ title: 'A' }, {}, { desc: 'C' }, 'not a step'];
    expect(howStepPhotos(steps, { howStep0: url(0), howStep1: url(1), howStep2: url(2), howStep3: url(3) })).toEqual([url(0), url(2)]);
    expect(howItWorksSteps(steps).steps).toHaveLength(2);
    expect(howStepPhotos(steps, { howStep2: url(2) })).toEqual(['', url(2)]);
    expect(howStepPhotos(steps, { howStep0: null, howStep2: '  ' })).toEqual(['', '']);
    expect(howStepPhotos(null, {})).toEqual([]);
    expect(howStepPhotos(steps, null)).toEqual(['', '']);
  });

  it('moves the later photos up when a step is removed, leaving every other image alone', () => {
    const images = { about: 'a', gallery0: 'g', showcase0: 's', howStep0: url(0), howStep1: url(1), howStep2: url(2), howStep3: null };
    expect(howStepRemoveImages(images, 1)).toEqual({ about: 'a', gallery0: 'g', showcase0: 's', howStep0: url(0), howStep1: url(2) });
    expect(howStepRemoveImages(images, 0)).toEqual({ about: 'a', gallery0: 'g', showcase0: 's', howStep0: url(1), howStep1: url(2) });
    expect(howStepRemoveImages(images, 5)).toEqual({ about: 'a', gallery0: 'g', showcase0: 's', howStep0: url(0), howStep1: url(1), howStep2: url(2) });
    expect(howStepRemoveImages(null, 0)).toEqual({});
  });

  it('drops every step photo when the section goes', () => {
    expect(howStepWithoutImages({ about: 'a', howStep0: url(0), howStep4: url(4) })).toEqual({ about: 'a' });
    expect(howStepWithoutImages(undefined)).toEqual({});
  });
});
