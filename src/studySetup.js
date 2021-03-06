/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "getStudySetup" }]*/

/**
 *  Overview:
 *
 *  - constructs a well-formatted `studySetup` for use by `browser.study.setup`
 *  - mostly declarative, except that some fields are set at runtime
 *    asynchronously.
 *
 *  Advanced features:
 *  - testing overrides from preferences
 *  - expiration time
 *  - some user defined endings.
 *  - study defined 'shouldAllowEnroll' logic.
 */

/** Base for studySetup, as used by `browser.study.setup`.
 *
 * Will be augmented by 'getStudySetup'
 */
const baseStudySetup = {
  // used for activeExperiments tagging (telemetryEnvironment.setActiveExperiment)
  activeExperimentName: browser.runtime.id,

  // use either "shield" or "pioneer" telemetry semantics and data pipelines
  studyType: "pioneer",

  // telemetry
  telemetry: {
    // Actually submit the pings to Telemetry. [default if omitted: false]
    send: true,
    // Marks pings with testing=true. Set flag to `true` for pings are meant to be seen by analysts [default if omitted: false]
    removeTestingFlag: true,
    // Keep an internal telemetry archive. Useful for verifying payloads of Pioneer studies without risking actually sending any unencrypted payloads [default if omitted: false]
    internalTelemetryArchive: false,
  },

  // endings with urls
  endings: {
    /** standard endings */
    "user-disable": {
      baseUrls: [],
    },
    ineligible: {
      baseUrls: [],
    },
    expired: {
      baseUrls: [],
    },
  },

  // Weightings for the study variations
  weightedVariations: [
    {
      name: "pioneer",
      weight: 1,
    },
  ],

  // maximum time that the study should run, from the first run
  expire: {
    days: 7 * 5, // 5 weeks
  },
};

async function isCurrentlyEligible(studySetup) {
  const dataPermissions = await browser.study.getDataPermissions();
  if (studySetup.studyType === "shield") {
    allowed = dataPermissions.shield;
  }
  if (studySetup.studyType === "pioneer") {
    allowed = dataPermissions.pioneer;
  }
  // Users with private browsing on autostart are not eligible
  if (await browser.privacyContext.permanentPrivateBrowsing()) {
    await browser.taarStudyMonitor.log(
      "Permanent private browsing, exiting study",
    );
    allowed = false;
  }
  return allowed;
}

/**
 * Determine, based on common and study-specific criteria, if enroll (first run)
 * should proceed.
 *
 * False values imply that *during first run only*, we should endStudy(`ineligible`)
 *
 * Add your own enrollment criteria as you see fit.
 *
 * (Guards against Normandy or other deployment mistakes or inadequacies).
 *
 * This implementation caches in local storage to speed up second run.
 *
 * @param {object} studySetup A complete study setup object
 * @returns {Promise<boolean>} answer An boolean answer about whether the user should be
 *       allowed to enroll in the study
 */
/*
async function cachingFirstRunShouldAllowEnroll(studySetup) {
  // Cached answer.  Used on 2nd run
  const localStorageResult = await browser.storage.local.get(
    "allowedEnrollOnFirstRun",
  );
  if (localStorageResult.allowedEnrollOnFirstRun === true) return true;

  // First run, we must calculate the answer.
  // If false, the study will endStudy with 'ineligible' during `setup`
  const allowed = await isCurrentlyEligible(studySetup);
  // could have other reasons to be eligible, such add-ons, prefs

  // cache the answer
  await browser.storage.local.set({ allowedEnrollOnFirstRun: allowed });
  return allowed;
}
*/

/**
 * Augment declarative studySetup with any necessary async values
 *
 * @return {object} studySetup A complete study setup object
 */
async function getStudySetup() {
  // shallow copy
  const studySetup = Object.assign({}, baseStudySetup);

  // Since our eligibility criterias are not dependent on the state of the first run only
  // but rather should be checked on every browser launch, we skip the use
  // of cachingFirstRunShouldAllowEnroll
  // studySetup.allowEnroll = await cachingFirstRunShouldAllowEnroll(studySetup);
  studySetup.allowEnroll = await isCurrentlyEligible(studySetup);

  const testingOverrides = await browser.study.getTestingOverrides();
  studySetup.testing = {
    variationName: testingOverrides.variationName,
    firstRunTimestamp: testingOverrides.firstRunTimestamp,
    expired: testingOverrides.expired,
  };
  // TODO: Possible add testing override for studySetup.telemetry.internalTelemetryArchive

  return studySetup;
}
