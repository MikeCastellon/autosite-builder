// How It Works tab for a design without starter steps (Bold & Sporty):
// the section is on only while copy.howSteps holds a step, "Add" saves the
// business type's suggested steps (no claims) for the owner to edit, and the
// help never speaks of starter steps there.
import { describe, it, expect } from 'vitest';
import { howItWorksSteps } from '../templates/kit/howItWorks.js';
import { defaultHowSteps } from '../../../lib/templateFallbacks.js';
import { howStepsStarters } from '../editorCapabilities.js';
import { howStepsOn, howStepsStart, HOW_STEPS_HELP } from './howStepsEdit.js';

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
