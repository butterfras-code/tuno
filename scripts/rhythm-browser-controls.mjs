/** Select a pending length through the learner's customization dialog. */
export async function selectExerciseLength(page, value) {
  await page.getByRole('button', { name: 'Choose rhythms', exact: true }).click();
  await page.getByRole('tab', { name: 'Custom', exact: true }).click();
  await page.locator(`[data-setting="exercise-length"] input[value="${value}"]`).check();
  await page.getByRole('button', { name: 'Use preset', exact: true }).click();
}
